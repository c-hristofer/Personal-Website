import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  DAY_KEYS,
  DAY_LABELS,
  DAY_SHORT_LABELS,
  createDefaultDayNames,
  createEmptyPlanDays,
  createEmptyIntervalPlans,
  createEmptyCardioPlans,
} from '../../workout/constants';
import { getWeekInfo, getWeekLabel, getPreviousWeekId } from '../../workout/date';
import {
  computeWeekExerciseSummaries,
  savePlan,
  saveWeightsForDay,
  subscribeToCompletions,
  subscribeToPlan,
  subscribeToSettings,
  subscribeToWeights,
  updateCompletion,
  updateSettings,
  upsertWorkoutHistory,
} from '../../workout/service';
import {
  applyDeloadToValue,
  computeDeloadState,
  formatWeightValue,
  isNumericWeight,
  parseNumericWeight,
  reverseDeloadValue,
} from '../../workout/utils';
import { getStoredRememberMe, persistRememberMe } from '../../utils/remember-me';
import { applyPersistencePreference } from '../../utils/auth-persistence';
import '../../styles/style.css';

const ExerciseStatus = ({ status }) => {
  if (status === 'saving') {
    return <span className="workout-status workout-status--saving">Saving…</span>;
  }
  if (status === 'saved') {
    return <span className="workout-status workout-status--saved" aria-live="polite">Saved</span>;
  }
  if (status === 'error') {
    return <span className="workout-status workout-status--error">Retry needed</span>;
  }
  return null;
};

const clonePlan = (days = {}) => JSON.parse(JSON.stringify(days));
const cloneIntervals = (plans = {}) => JSON.parse(JSON.stringify(plans));
const cloneCardioPlans = (plans = {}) => JSON.parse(JSON.stringify(plans));

const parseDurationSeconds = (value) => {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  const raw = value.toString().trim();
  if (!raw) return 0;
  if (raw.includes(':')) {
    const parts = raw.split(':').map((part) => Number(part) || 0);
    let seconds = 0;
    let multiplier = 1;
    while (parts.length) {
      const segment = parts.pop();
      if (Number.isFinite(segment)) {
        seconds += segment * multiplier;
      }
      multiplier *= 60;
    }
    return Math.max(0, seconds);
  }
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber)) {
    return Math.max(0, Math.floor(asNumber));
  }
  return 0;
};

const formatSeconds = (value) => {
  const seconds = Math.max(0, Math.floor(value || 0));
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

const formatDurationLabel = (value) => {
  const total = Math.max(0, Number(value) || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
};

const getIntervalPlanTotalSeconds = (plan) => {
  if (!plan || !Array.isArray(plan.segments)) return 0;
  return plan.segments.reduce((total, segment) => {
    const durationSeconds = parseDurationSeconds(segment?.duration || '');
    const repeat = Math.max(1, Number(segment?.repeat) || 1);
    return total + durationSeconds * repeat;
  }, 0);
};

const hasIntervalPlanContent = (plan) =>
  Boolean(plan?.title) || (Array.isArray(plan?.segments) && plan.segments.length > 0);

const hasCardioPlanContent = (plan) =>
  Boolean(plan?.title || plan?.duration || plan?.notes);

const convertIntervalSegments = (segments = []) => {
  if (!Array.isArray(segments)) {
    return [];
  }
  return segments.map((segment) => {
    let totalSeconds = parseDurationSeconds(segment?.duration || '');
    if (!totalSeconds && (segment?.minutes || segment?.seconds)) {
      totalSeconds = parseDurationSeconds(`${segment?.minutes || 0}:${segment?.seconds || 0}`);
    }
    const minutes = segment?.minutes !== undefined
      ? segment.minutes.toString()
      : totalSeconds
        ? Math.floor(totalSeconds / 60).toString()
        : '';
    const seconds = segment?.seconds !== undefined
      ? segment.seconds.toString().padStart(2, '0')
      : totalSeconds
        ? (totalSeconds % 60).toString().padStart(2, '0')
        : '';
    const duration = totalSeconds ? formatSeconds(totalSeconds) : (segment?.duration ? segment.duration.toString() : '');
    return {
      label: (segment?.label || '').toString(),
      duration,
      minutes,
      seconds,
      repeat: segment?.repeat !== undefined ? segment.repeat.toString() : '1',
    };
  });
};

const convertIntervalPlans = (plans = {}) => {
  const clone = cloneIntervals(plans);
  Object.keys(clone).forEach((dayKey) => {
    const dayPlans = Array.isArray(clone[dayKey]) ? clone[dayKey] : [];
    clone[dayKey] = dayPlans.map((plan) => ({
      id: plan.id,
      title: plan.title || '',
      segments: convertIntervalSegments(plan.segments || []),
    }));
  });
  return clone;
};

const createIntervalPlanItem = () => ({
  id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `interval-${Date.now()}`,
  title: '',
  segments: [],
});

const createCardioPlanItem = () => ({
  id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `cardio-${Date.now()}`,
  title: '',
  duration: '',
  notes: '',
});

const createEmptyDayOrder = () => DAY_KEYS.reduce((acc, dayKey) => {
  acc[dayKey] = [];
  return acc;
}, {});

const normalizeDayOrder = (
  order = {},
  days = {},
  intervalPlans = {},
  cardioPlans = {},
  options = {},
) => {
  const normalized = {};
  const includeEmpty = Boolean(options.includeEmpty);
  DAY_KEYS.forEach((dayKey) => {
    const exercises = Array.isArray(days[dayKey]) ? days[dayKey] : [];
    const exerciseIds = exercises.map((exercise) => exercise?.id).filter(Boolean);
    const intervalList = Array.isArray(intervalPlans?.[dayKey]) ? intervalPlans[dayKey] : [];
    const cardioList = Array.isArray(cardioPlans?.[dayKey]) ? cardioPlans[dayKey] : [];
    const intervalIds = intervalList.map((item) => item?.id).filter(Boolean);
    const cardioIds = cardioList.map((item) => item?.id).filter(Boolean);
    const existing = Array.isArray(order[dayKey]) ? order[dayKey] : [];
    const items = [];
    const usedExercises = new Set();
    const usedIntervals = new Set();
    const usedCardio = new Set();

    existing.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      if (item.type === 'exercise' && item.id && exerciseIds.includes(item.id) && !usedExercises.has(item.id)) {
        items.push({ type: 'exercise', id: item.id });
        usedExercises.add(item.id);
        return;
      }
      if (item.type === 'interval') {
        const id = item.id || intervalIds[0];
        const plan = intervalList.find((entry) => entry?.id === id);
        const hasContent = plan ? hasIntervalPlanContent(plan) : false;
        if (id && intervalIds.includes(id) && !usedIntervals.has(id) && (includeEmpty || hasContent)) {
          items.push({ type: 'interval', id });
          usedIntervals.add(id);
        }
        return;
      }
      if (item.type === 'cardio') {
        const id = item.id || cardioIds[0];
        const plan = cardioList.find((entry) => entry?.id === id);
        const hasContent = plan ? hasCardioPlanContent(plan) : false;
        if (id && cardioIds.includes(id) && !usedCardio.has(id) && (includeEmpty || hasContent)) {
          items.push({ type: 'cardio', id });
          usedCardio.add(id);
        }
      }
    });

    exerciseIds.forEach((id) => {
      if (!usedExercises.has(id)) {
        items.push({ type: 'exercise', id });
        usedExercises.add(id);
      }
    });

    intervalList.forEach((plan) => {
      const id = plan?.id;
      if (!id || usedIntervals.has(id)) return;
      const hasContent = Boolean(plan?.title) || (plan?.segments || []).length > 0;
      if (includeEmpty || hasContent) {
        items.push({ type: 'interval', id });
        usedIntervals.add(id);
      }
    });
    cardioList.forEach((plan) => {
      const id = plan?.id;
      if (!id || usedCardio.has(id)) return;
      const hasContent = Boolean(plan?.title || plan?.duration || plan?.notes);
      if (includeEmpty || hasContent) {
        items.push({ type: 'cardio', id });
        usedCardio.add(id);
      }
    });

    normalized[dayKey] = items;
  });
  return normalized;
};

const defaultExercise = () => ({
  id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `ex-${Date.now()}`,
  name: 'New exercise',
  sets: 3,
  reps: '10',
});

function WorkoutHub() {
  const auth = getAuth();
  const navigate = useNavigate();
  const [authState, setAuthState] = useState({ user: null, loading: true });
  const [plan, setPlan] = useState({
    days: createEmptyPlanDays(),
    dayNames: createDefaultDayNames(),
    intervalPlans: createEmptyIntervalPlans(),
    cardioPlans: createEmptyCardioPlans(),
    dayOrder: createEmptyDayOrder(),
  });
  const [weights, setWeights] = useState({});
  const [settings, setSettings] = useState(null);
  const [completions, setCompletions] = useState({ dayData: {} });
  const [weekInfo, setWeekInfo] = useState(() => getWeekInfo());
  const [selectedDay, setSelectedDay] = useState(() => getWeekInfo().dayKey);
  const [initialDayResolved, setInitialDayResolved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(null);
  const [planError, setPlanError] = useState('');
  const [planSaving, setPlanSaving] = useState(false);
  const [weightStatuses, setWeightStatuses] = useState({});
  const weightTimers = useRef({});
  const weightsSnapshot = useRef({});
  const [timerState, setTimerState] = useState({
    dayKey: null,
    intervalId: null,
    segments: [],
    currentIndex: 0,
    remaining: 0,
    isRunning: false,
    title: '',
  });
  const audioContextRef = useRef(null);
  const archiveStateRef = useRef({ weekId: null, running: false });

  useEffect(() => {
    weightsSnapshot.current = weights;
  }, [weights]);

  const unlockAudioContext = useCallback(() => {
    const AudioContextCtor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AudioContextCtor) return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }, []);

  const playIntervalChime = useCallback(() => {
    const ctx = unlockAudioContext();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    const gain = ctx.createGain();
    gain.gain.value = 0.2;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    oscillator.start(now);
    oscillator.stop(now + 0.5);
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([120, 80, 120]);
    }
  }, [unlockAudioContext]);

  useEffect(() => {
    if (!timerState.isRunning || !timerState.segments.length) {
      return undefined;
    }
    const id = setInterval(() => {
      setTimerState((prev) => {
        if (!prev.isRunning) return prev;
        if (prev.remaining > 1) {
          return { ...prev, remaining: prev.remaining - 1 };
        }
        playIntervalChime();
        const nextIndex = prev.currentIndex + 1;
        if (nextIndex >= prev.segments.length) {
          return { ...prev, isRunning: false, remaining: 0, currentIndex: prev.currentIndex };
        }
        return {
          ...prev,
          currentIndex: nextIndex,
          remaining: prev.segments[nextIndex].durationSeconds,
        };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerState.isRunning, timerState.segments.length, playIntervalChime]);

  useEffect(() => {
    setTimerState((prev) => ({ ...prev, isRunning: false }));
  }, [selectedDay]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthState({ user, loading: false });
    });
    return () => unsub();
  }, [auth]);

  useEffect(() => {
    const interval = setInterval(() => {
      setWeekInfo(getWeekInfo());
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const user = authState.user;
    if (!user) {
      setPlan({
        days: createEmptyPlanDays(),
        dayNames: createDefaultDayNames(),
        intervalPlans: createEmptyIntervalPlans(),
        cardioPlans: createEmptyCardioPlans(),
        dayOrder: createEmptyDayOrder(),
      });
      setWeights({});
      setSettings(null);
      setCompletions({ dayData: {} });
      setIsEditing(false);
      return;
    }
    const unsubPlan = subscribeToPlan(user.uid, (data) => {
      setPlan(data);
      if (!isEditing) {
        setEditDraft(null);
      }
    });
    const unsubWeights = subscribeToWeights(user.uid, (data) => {
      setWeights(data);
    });
    const unsubSettings = subscribeToSettings(user.uid, (data) => {
      setSettings(data);
    });
    return () => {
      unsubPlan();
      unsubWeights();
      unsubSettings();
    };
  }, [authState.user, isEditing]);

  useEffect(() => {
    const user = authState.user;
    if (!user || !weekInfo.weekId) {
      setCompletions({ dayData: {} });
      return;
    }
    const unsub = subscribeToCompletions(user.uid, weekInfo.weekId, (data) => {
      setCompletions(data);
    });
    return () => unsub();
  }, [authState.user, weekInfo.weekId]);

  useEffect(() => {
    if (!settings || initialDayResolved) {
      return;
    }
    if (settings.defaultDayView === 'last' && settings.lastSelectedDay) {
      setSelectedDay(settings.lastSelectedDay);
    } else {
      setSelectedDay(weekInfo.dayKey);
    }
    setInitialDayResolved(true);
  }, [settings, initialDayResolved, weekInfo.dayKey]);

  useEffect(() => {
    if (!settings) return;
    if (settings.defaultDayView === 'today') {
      setSelectedDay(weekInfo.dayKey);
    }
  }, [settings?.defaultDayView, weekInfo.dayKey]);

  useEffect(() => {
    if (!authState.user || !plan?.days || !weekInfo.weekId || !settings) {
      return;
    }
    const previousWeekId = getPreviousWeekId(weekInfo.weekId);
    if (!previousWeekId) return;
    if (settings.lastArchivedWeekId === previousWeekId) return;
    if (archiveStateRef.current.running && archiveStateRef.current.weekId === previousWeekId) {
      return;
    }
    archiveStateRef.current = { weekId: previousWeekId, running: true };
    const runArchive = async () => {
      try {
        const exerciseSummaries = computeWeekExerciseSummaries(plan.days, weights);
        await upsertWorkoutHistory(authState.user.uid, previousWeekId, {
          unitSystem: settings.unitSystem || 'lbs',
          exerciseSummaries,
        });
        await updateSettings(authState.user.uid, {
          lastArchivedWeekId: previousWeekId,
          lastArchivedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Failed to archive workout history', error);
      } finally {
        archiveStateRef.current = { weekId: previousWeekId, running: false };
      }
    };
    runArchive();
  }, [authState.user, plan?.days, settings, weekInfo.weekId, weights]);

  const handleSelectDay = (dayKey) => {
    setSelectedDay(dayKey);
    if (authState.user) {
      updateSettings(authState.user.uid, { lastSelectedDay: dayKey }).catch(() => {});
    }
  };

  const handleStartEditing = () => {
    setPlanError('');
    setPlanSaving(false);
    setEditDraft({
      days: clonePlan(plan.days),
      dayNames: { ...plan.dayNames },
      intervalPlans: convertIntervalPlans(plan.intervalPlans),
      cardioPlans: cloneCardioPlans(plan.cardioPlans),
      dayOrder: normalizeDayOrder(plan.dayOrder, plan.days, plan.intervalPlans, plan.cardioPlans, { includeEmpty: true }),
    });
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setEditDraft(null);
    setIsEditing(false);
  };

  const handlePlanChange = (dayKey, exerciseIndex, field, value) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const nextDays = clonePlan(prev.days);
      const dayExercises = Array.isArray(nextDays[dayKey]) ? [...nextDays[dayKey]] : [];
      const target = { ...dayExercises[exerciseIndex], [field]: value };
      dayExercises[exerciseIndex] = target;
      nextDays[dayKey] = dayExercises;
      return { ...prev, days: nextDays };
    });
  };

  const handleAddExercise = (dayKey) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const nextDays = clonePlan(prev.days);
      const dayExercises = Array.isArray(nextDays[dayKey]) ? [...nextDays[dayKey]] : [];
      const newExercise = defaultExercise();
      dayExercises.push(newExercise);
      nextDays[dayKey] = dayExercises;
      const nextOrder = normalizeDayOrder(prev.dayOrder, nextDays, prev.intervalPlans, prev.cardioPlans, { includeEmpty: true });
      const dayOrder = Array.isArray(nextOrder[dayKey]) ? [...nextOrder[dayKey]] : [];
      const lastExerciseOffset = [...dayOrder].reverse().findIndex((item) => item.type === 'exercise');
      if (lastExerciseOffset === -1) {
        dayOrder.unshift({ type: 'exercise', id: newExercise.id });
      } else {
        const insertAt = dayOrder.length - lastExerciseOffset;
        dayOrder.splice(insertAt, 0, { type: 'exercise', id: newExercise.id });
      }
      nextOrder[dayKey] = dayOrder;
      return { ...prev, days: nextDays, dayOrder: nextOrder };
    });
  };

  const handleAddIntervalItem = (dayKey) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const plans = cloneIntervals(prev.intervalPlans || {});
      const dayPlans = Array.isArray(plans[dayKey]) ? [...plans[dayKey]] : [];
      const newPlan = createIntervalPlanItem();
      dayPlans.push(newPlan);
      plans[dayKey] = dayPlans;
      const nextOrder = normalizeDayOrder(prev.dayOrder, prev.days, plans, prev.cardioPlans, { includeEmpty: true });
      const dayOrder = Array.isArray(nextOrder[dayKey]) ? [...nextOrder[dayKey]] : [];
      dayOrder.push({ type: 'interval', id: newPlan.id });
      nextOrder[dayKey] = dayOrder;
      return { ...prev, intervalPlans: plans, dayOrder: nextOrder };
    });
  };

  const handleAddCardioItem = (dayKey) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const plans = cloneCardioPlans(prev.cardioPlans || {});
      const dayPlans = Array.isArray(plans[dayKey]) ? [...plans[dayKey]] : [];
      const newPlan = createCardioPlanItem();
      dayPlans.push(newPlan);
      plans[dayKey] = dayPlans;
      const nextOrder = normalizeDayOrder(prev.dayOrder, prev.days, prev.intervalPlans, plans, { includeEmpty: true });
      const dayOrder = Array.isArray(nextOrder[dayKey]) ? [...nextOrder[dayKey]] : [];
      dayOrder.push({ type: 'cardio', id: newPlan.id });
      nextOrder[dayKey] = dayOrder;
      return { ...prev, cardioPlans: plans, dayOrder: nextOrder };
    });
  };

  const handleRemoveIntervalItem = (dayKey, intervalId) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const plans = cloneIntervals(prev.intervalPlans || {});
      const dayPlans = Array.isArray(plans[dayKey]) ? [...plans[dayKey]] : [];
      plans[dayKey] = dayPlans.filter((plan) => plan.id !== intervalId);
      const nextOrder = normalizeDayOrder(prev.dayOrder, prev.days, plans, prev.cardioPlans, { includeEmpty: true });
      nextOrder[dayKey] = (nextOrder[dayKey] || []).filter(
        (item) => item.type !== 'interval' || item.id !== intervalId,
      );
      return { ...prev, intervalPlans: plans, dayOrder: nextOrder };
    });
  };

  const handleRemoveCardioItem = (dayKey, cardioId) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const plans = cloneCardioPlans(prev.cardioPlans || {});
      const dayPlans = Array.isArray(plans[dayKey]) ? [...plans[dayKey]] : [];
      plans[dayKey] = dayPlans.filter((plan) => plan.id !== cardioId);
      const nextOrder = normalizeDayOrder(prev.dayOrder, prev.days, prev.intervalPlans, plans, { includeEmpty: true });
      nextOrder[dayKey] = (nextOrder[dayKey] || []).filter(
        (item) => item.type !== 'cardio' || item.id !== cardioId,
      );
      return { ...prev, cardioPlans: plans, dayOrder: nextOrder };
    });
  };

  const handleRemoveExercise = (dayKey, index) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const nextDays = clonePlan(prev.days);
      const dayExercises = Array.isArray(nextDays[dayKey]) ? [...nextDays[dayKey]] : [];
      const removed = dayExercises[index];
      dayExercises.splice(index, 1);
      nextDays[dayKey] = dayExercises;
      const nextOrder = normalizeDayOrder(prev.dayOrder, nextDays, prev.intervalPlans, prev.cardioPlans, { includeEmpty: true });
      if (removed?.id) {
        nextOrder[dayKey] = (nextOrder[dayKey] || []).filter(
          (item) => item.type !== 'exercise' || item.id !== removed.id,
        );
      }
      return { ...prev, days: nextDays, dayOrder: nextOrder };
    });
  };

  const handleReorderItem = (dayKey, index, direction) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const nextOrder = normalizeDayOrder(prev.dayOrder, prev.days, prev.intervalPlans, prev.cardioPlans, { includeEmpty: true });
      const dayOrder = Array.isArray(nextOrder[dayKey]) ? [...nextOrder[dayKey]] : [];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= dayOrder.length) {
        return prev;
      }
      const temp = dayOrder[index];
      dayOrder[index] = dayOrder[targetIndex];
      dayOrder[targetIndex] = temp;
      nextOrder[dayKey] = dayOrder;
      return { ...prev, dayOrder: nextOrder };
    });
  };

  const handleDayNameChange = (dayKey, value) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        dayNames: {
          ...prev.dayNames,
          [dayKey]: value,
        },
      };
    });
  };

  const handleIntervalTitleChange = (dayKey, intervalId, value) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const plans = cloneIntervals(prev.intervalPlans || {});
      const dayPlans = Array.isArray(plans[dayKey]) ? [...plans[dayKey]] : [];
      plans[dayKey] = dayPlans.map((plan) =>
        plan.id === intervalId ? { ...plan, title: value } : plan,
      );
      return { ...prev, intervalPlans: plans };
    });
  };

  const handleIntervalSegmentChange = (dayKey, intervalId, index, field, value) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const plans = cloneIntervals(prev.intervalPlans || {});
      const dayPlans = Array.isArray(plans[dayKey]) ? [...plans[dayKey]] : [];
      plans[dayKey] = dayPlans.map((plan) => {
        if (plan.id !== intervalId) return plan;
        const segments = Array.isArray(plan.segments) ? [...plan.segments] : [];
        segments[index] = { ...segments[index], [field]: value };
        if (field === 'duration') {
          const seconds = parseDurationSeconds(value);
          segments[index].minutes = Math.floor(seconds / 60).toString();
          segments[index].seconds = (seconds % 60).toString().padStart(2, '0');
        }
        if (field === 'minutes' || field === 'seconds') {
          const minutes = Number(segments[index].minutes) || 0;
          const seconds = Number(segments[index].seconds) || 0;
          const total = Math.max(0, minutes * 60 + seconds);
          segments[index].duration = formatSeconds(total);
          segments[index].minutes = Math.floor(total / 60).toString();
          segments[index].seconds = (total % 60).toString().padStart(2, '0');
        }
        if (field === 'repeat') {
          const repeatValue = Math.max(1, Number(value) || 1);
          segments[index].repeat = repeatValue.toString();
        }
        return { ...plan, segments };
      });
      return { ...prev, intervalPlans: plans };
    });
  };

  const handleAddIntervalSegment = (dayKey, intervalId) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const plans = cloneIntervals(prev.intervalPlans || {});
      const dayPlans = Array.isArray(plans[dayKey]) ? [...plans[dayKey]] : [];
      plans[dayKey] = dayPlans.map((plan) => {
        if (plan.id !== intervalId) return plan;
        const segments = Array.isArray(plan.segments) ? [...plan.segments] : [];
        segments.push({ label: '', duration: '', repeat: '1' });
        return { ...plan, segments };
      });
      return { ...prev, intervalPlans: plans };
    });
  };

  const handleRemoveIntervalSegment = (dayKey, intervalId, index) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const plans = cloneIntervals(prev.intervalPlans || {});
      const dayPlans = Array.isArray(plans[dayKey]) ? [...plans[dayKey]] : [];
      plans[dayKey] = dayPlans.map((plan) => {
        if (plan.id !== intervalId) return plan;
        const segments = Array.isArray(plan.segments) ? [...plan.segments] : [];
        segments.splice(index, 1);
        return { ...plan, segments };
      });
      return { ...prev, intervalPlans: plans };
    });
  };

  const handleCardioChange = (dayKey, cardioId, field, value) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const plans = cloneCardioPlans(prev.cardioPlans || {});
      const dayPlans = Array.isArray(plans[dayKey]) ? [...plans[dayKey]] : [];
      plans[dayKey] = dayPlans.map((plan) =>
        plan.id === cardioId ? { ...plan, [field]: value } : plan,
      );
      return { ...prev, cardioPlans: plans };
    });
  };

  const startIntervalTimer = (dayKey, intervalId) => {
    unlockAudioContext();
    const intervalPlan = (plan.intervalPlans?.[dayKey] || []).find((item) => item.id === intervalId);
    if (!intervalPlan) return;
    const segments = (intervalPlan.segments || [])
      .flatMap((segment) => {
        const repeat = Math.max(1, Number(segment.repeat) || 1);
        const durationSeconds = parseDurationSeconds(segment.duration);
        if (!durationSeconds) return [];
        return Array.from({ length: repeat }, () => ({
          label: segment.label || '',
          durationSeconds,
        }));
      })
      .filter((segment) => segment.durationSeconds > 0);
    if (!segments.length) {
      return;
    }
    setTimerState({
      dayKey,
      intervalId,
      segments,
      currentIndex: 0,
      remaining: segments[0].durationSeconds,
      isRunning: true,
      title: intervalPlan.title || 'Interval Timer',
    });
  };

  const pauseIntervalTimer = () => {
    setTimerState((prev) => ({ ...prev, isRunning: false }));
  };

  const resumeIntervalTimer = () => {
    if (!timerState.segments.length) return;
    unlockAudioContext();
    setTimerState((prev) => ({ ...prev, isRunning: true }));
  };

  const resetIntervalTimer = () => {
    setTimerState((prev) => ({
      ...prev,
      isRunning: false,
      remaining: 0,
      currentIndex: 0,
      dayKey: null,
      intervalId: null,
      segments: [],
    }));
  };

  const skipIntervalSegment = () => {
    setTimerState((prev) => {
      if (!prev.segments.length) return prev;
      const nextIndex = prev.currentIndex + 1;
      if (nextIndex >= prev.segments.length) {
        return { ...prev, isRunning: false, currentIndex: prev.segments.length - 1, remaining: 0 };
      }
      return {
        ...prev,
        currentIndex: nextIndex,
        remaining: prev.segments[nextIndex].durationSeconds,
      };
    });
  };

  const restartOrRewindInterval = () => {
    setTimerState((prev) => {
      if (!prev.segments.length) return prev;
      const currentSegment = prev.segments[prev.currentIndex];
      if (!currentSegment) return prev;
      const elapsed = currentSegment.durationSeconds - prev.remaining;
      if (elapsed > 2) {
        return {
          ...prev,
          remaining: currentSegment.durationSeconds,
        };
      }
      if (prev.currentIndex === 0) {
        return { ...prev, remaining: currentSegment.durationSeconds };
      }
      const previousIndex = prev.currentIndex - 1;
      return {
        ...prev,
        currentIndex: previousIndex,
        remaining: prev.segments[previousIndex].durationSeconds,
      };
    });
  };

  const validatePlan = (days) => {
    const errors = [];
    DAY_KEYS.forEach((dayKey) => {
      (days[dayKey] || []).forEach((exercise, idx) => {
        if (!exercise.name?.trim()) {
          errors.push(`${DAY_LABELS[dayKey]} exercise ${idx + 1} needs a name.`);
        }
        if (!Number.isInteger(Number(exercise.sets)) || Number(exercise.sets) <= 0) {
          errors.push(`${exercise.name || 'Exercise'} must have sets > 0.`);
        }
        if (!exercise.reps || !exercise.reps.toString().trim()) {
          errors.push(`${exercise.name || 'Exercise'} needs a reps description.`);
        }
      });
    });
    return errors;
  };

  const handleSavePlan = async () => {
    if (!authState.user || !editDraft) return;
    const validationErrors = validatePlan(editDraft.days || {});
    if (validationErrors.length) {
      setPlanError(validationErrors.join(' '));
      return;
    }
    setPlanSaving(true);
    setPlanError('');
    try {
      const sanitizedDays = {};
      const sanitizedDayNames = {};
      const sanitizedIntervals = {};
      const sanitizedCardio = {};
      DAY_KEYS.forEach((dayKey) => {
        sanitizedDays[dayKey] = (editDraft.days?.[dayKey] || []).map((exercise) => ({
          id: exercise.id || defaultExercise().id,
          name: exercise.name.trim(),
          sets: Number(exercise.sets),
          reps: (exercise.reps ?? '').toString().trim(),
        }));
        const rawName = (editDraft.dayNames?.[dayKey] || '').trim();
        sanitizedDayNames[dayKey] = rawName || DAY_LABELS[dayKey];
        const intervalPlans = Array.isArray(editDraft.intervalPlans?.[dayKey])
          ? editDraft.intervalPlans[dayKey]
          : [];
        sanitizedIntervals[dayKey] = intervalPlans.map((plan, index) => ({
          id: plan.id || `interval-${dayKey}-${index + 1}`,
          title: (plan.title || '').trim(),
          segments: Array.isArray(plan.segments)
            ? plan.segments
                .map((segment) => ({
                  label: (segment?.label || '').trim(),
                  duration: (() => {
                    if (segment?.duration) return segment.duration.toString().trim();
                    const totalSeconds = parseDurationSeconds(`${segment?.minutes || 0}:${segment?.seconds || 0}`);
                    if (totalSeconds) {
                      return formatSeconds(totalSeconds);
                    }
                    return '';
                  })(),
                  minutes: segment?.minutes || '',
                  seconds: segment?.seconds || '',
                  repeat: segment?.repeat || '1',
                }))
                .filter((segment) => segment.label || segment.duration)
            : [],
        }));
        const cardioPlans = Array.isArray(editDraft.cardioPlans?.[dayKey])
          ? editDraft.cardioPlans[dayKey]
          : [];
        sanitizedCardio[dayKey] = cardioPlans.map((plan, index) => ({
          id: plan.id || `cardio-${dayKey}-${index + 1}`,
          title: (plan.title || '').trim(),
          duration: (plan.duration || '').trim(),
          notes: (plan.notes || '').trim(),
        }));
      });
      await savePlan(authState.user.uid, {
        days: sanitizedDays,
        dayNames: sanitizedDayNames,
        intervalPlans: sanitizedIntervals,
        cardioPlans: sanitizedCardio,
        dayOrder: editDraft.dayOrder,
      });
      setIsEditing(false);
      setEditDraft(null);
    } catch (error) {
      setPlanError(error.message);
    } finally {
      setPlanSaving(false);
    }
  };

  const queueWeightSave = (dayKey, exerciseId) => {
    if (!authState.user) return;
    setWeightStatuses((prev) => ({ ...prev, [exerciseId]: 'saving' }));
    const timerKey = `${dayKey}-${exerciseId}`;
    if (weightTimers.current[timerKey]) {
      clearTimeout(weightTimers.current[timerKey]);
    }
    weightTimers.current[timerKey] = setTimeout(async () => {
      try {
        const dayPayload = weightsSnapshot.current[dayKey];
        const exercises = dayPayload?.exercises || {};
        await saveWeightsForDay(authState.user.uid, dayKey, exercises);
        setWeightStatuses((prev) => ({ ...prev, [exerciseId]: 'saved' }));
      } catch (error) {
        console.error('Failed to save weights', error);
        setWeightStatuses((prev) => ({ ...prev, [exerciseId]: 'error' }));
      }
    }, 600);
  };

  useEffect(() => {
    return () => {
      Object.values(weightTimers.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const handleWeightChange = (exerciseId, setIndex, rawValue, options = {}) => {
    const value = typeof rawValue === 'string' ? rawValue : (rawValue ?? '').toString();
    const trimmed = value.trim();
    let storedValue = trimmed;
    if (trimmed === '') {
      storedValue = '';
    } else {
      const numericValue = parseNumericWeight(trimmed);
      if (numericValue !== null) {
        let baseValue = numericValue;
        if (options.isDeloadedInput && isDeloadWeek) {
          const reversed = reverseDeloadValue(numericValue, deloadState.deloadPercent);
          if (Number.isFinite(reversed)) {
            baseValue = reversed;
          }
        }
        const formatted = formatWeightValue(baseValue);
        storedValue = formatted || '';
      } else {
        storedValue = trimmed;
      }
    }
    setWeights((prev) => {
      const next = { ...prev };
      const dayData = next[selectedDay] ? { ...next[selectedDay] } : {};
      const exercisesMap = dayData.exercises ? { ...dayData.exercises } : {};
      const exerciseData = exercisesMap[exerciseId]
        ? { ...exercisesMap[exerciseId] }
        : { setWeights: [] };
      const setWeightsArray = Array.isArray(exerciseData.setWeights)
        ? [...exerciseData.setWeights]
        : [];
      setWeightsArray[setIndex] = storedValue;
      exerciseData.setWeights = setWeightsArray;
      exerciseData.updatedAt = new Date().toISOString();
      exercisesMap[exerciseId] = exerciseData;
      dayData.exercises = exercisesMap;
      dayData.dayKey = selectedDay;
      next[selectedDay] = dayData;
      return next;
    });
    queueWeightSave(selectedDay, exerciseId);
  };

  const handleToggleExerciseComplete = async (exerciseId, totalSets, nextValue) => {
    if (!authState.user) return;
    const completedSets = Array.from({ length: totalSets }, () => nextValue);
    try {
      await updateCompletion(authState.user.uid, weekInfo.weekId, selectedDay, exerciseId, {
        completed: nextValue,
        completedSets,
      });
    } catch (error) {
      console.error('Failed to update completion', error);
    }
  };

  const handleToggleIntervalComplete = async (dayKey, intervalId) => {
    if (!authState.user) return;
    try {
      const existing = completions.dayData?.[dayKey]?.intervalPlans?.[intervalId];
      const legacy = completions.dayData?.[dayKey]?.intervalPlan;
      const nextValue = !(existing?.completed || (legacy?.completed && !existing));
      await updateCompletion(authState.user.uid, weekInfo.weekId, dayKey, { type: 'interval', id: intervalId }, {
        completed: nextValue,
      });
    } catch (error) {
      console.error('Failed to update interval completion', error);
    }
  };

  const handleToggleCardioComplete = async (dayKey, cardioId) => {
    if (!authState.user) return;
    try {
      const existing = completions.dayData?.[dayKey]?.cardioPlans?.[cardioId];
      const legacy = completions.dayData?.[dayKey]?.cardioPlan;
      const nextValue = !(existing?.completed || (legacy?.completed && !existing));
      await updateCompletion(authState.user.uid, weekInfo.weekId, dayKey, { type: 'cardio', id: cardioId }, {
        completed: nextValue,
      });
    } catch (error) {
      console.error('Failed to update cardio completion', error);
    }
  };

  const dayExercises = useMemo(() => plan.days?.[selectedDay] || [], [plan, selectedDay]);
  const dayOrder = useMemo(
    () => normalizeDayOrder(plan.dayOrder, plan.days, plan.intervalPlans, plan.cardioPlans)[selectedDay] || [],
    [plan.dayOrder, plan.days, plan.intervalPlans, plan.cardioPlans, selectedDay]
  );
  const dayWeights = weights[selectedDay]?.exercises || {};
  const dayCompletion = completions.dayData?.[selectedDay]?.exercises || {};
  const intervalCompletionMap = completions.dayData?.[selectedDay]?.intervalPlans || {};
  const cardioCompletionMap = completions.dayData?.[selectedDay]?.cardioPlans || {};
  const legacyIntervalCompletion = completions.dayData?.[selectedDay]?.intervalPlan || null;
  const legacyCardioCompletion = completions.dayData?.[selectedDay]?.cardioPlan || null;
  const deloadState = useMemo(
    () => computeDeloadState(settings, weekInfo.weekId),
    [settings, weekInfo.weekId]
  );
  const isDeloadWeek = deloadState.isDeloadWeek;
  const dayIntervalPlans = useMemo(
    () => Array.isArray(plan.intervalPlans?.[selectedDay]) ? plan.intervalPlans[selectedDay] : [],
    [plan.intervalPlans, selectedDay],
  );
  const dayCardioPlans = useMemo(
    () => Array.isArray(plan.cardioPlans?.[selectedDay]) ? plan.cardioPlans[selectedDay] : [],
    [plan.cardioPlans, selectedDay],
  );
  const hasIntervalContent = useMemo(
    () => dayIntervalPlans.some((planItem) => hasIntervalPlanContent(planItem)),
    [dayIntervalPlans],
  );
  const hasCardioContent = useMemo(
    () => dayCardioPlans.some((planItem) => hasCardioPlanContent(planItem)),
    [dayCardioPlans],
  );

  const progress = useMemo(() => {
    const intervalPlansWithContent = dayIntervalPlans.filter((planItem) => hasIntervalPlanContent(planItem));
    const cardioPlansWithContent = dayCardioPlans.filter((planItem) => hasCardioPlanContent(planItem));
    const totals = dayExercises.reduce(
      (acc, exercise) => {
        acc.totalExercises += 1;
        if (dayCompletion[exercise.id]?.completed) {
          acc.completedExercises += 1;
        }
        return acc;
      },
      { completedExercises: 0, totalExercises: 0 }
    );
    intervalPlansWithContent.forEach((planItem, index) => {
      totals.totalExercises += 1;
      const completion = intervalCompletionMap[planItem.id]
        || (legacyIntervalCompletion && intervalPlansWithContent.length === 1 ? legacyIntervalCompletion : null);
      if (completion?.completed) {
        totals.completedExercises += 1;
      }
    });
    cardioPlansWithContent.forEach((planItem, index) => {
      totals.totalExercises += 1;
      const completion = cardioCompletionMap[planItem.id]
        || (legacyCardioCompletion && cardioPlansWithContent.length === 1 ? legacyCardioCompletion : null);
      if (completion?.completed) {
        totals.completedExercises += 1;
      }
    });
    const pct = totals.totalExercises === 0
      ? 0
      : Math.round((totals.completedExercises / totals.totalExercises) * 100);
    return { ...totals, pct };
  }, [
    dayExercises,
    dayCompletion,
    dayIntervalPlans,
    dayCardioPlans,
    intervalCompletionMap,
    cardioCompletionMap,
    legacyIntervalCompletion,
    legacyCardioCompletion,
  ]);

  if (authState.loading) {
    return (
      <main className="workout-page">
        <p>Loading workout data…</p>
      </main>
    );
  }

  if (!authState.user) {
    return (
      <main className="workout-auth-page">
        <WorkoutAuthPanel auth={auth} />
      </main>
    );
  }

  const pageClassName = `workout-page${isDeloadWeek ? ' workout-page--deload' : ''}`;
  const deloadBannerVisible = deloadState.deloadEnabled && isDeloadWeek;
  const dayNickname = plan.dayNames?.[selectedDay]?.trim();
  const headerTitle = dayNickname || 'Workout';
  const dayLabel = DAY_LABELS[selectedDay] || 'Today';

  return (
    <main className={pageClassName}>
      <header className="workout-hero workout-hero--with-actions">
        <div className="workout-hero__content">
            <h1>{headerTitle}</h1>
          <p className="help-text">
            {dayLabel} • Week of {getWeekLabel(weekInfo)} • Progress {progress.pct}%
          </p>
        </div>
        <div className="workout-hero__actions">
          <button
            type="button"
            className="workout-hero__icon-btn"
            onClick={() => navigate('/workout/data')}
            aria-label="Workout data"
          >
            <img src="/icons/chart.svg" alt="" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="workout-hero__icon-btn"
            onClick={() => navigate('/workout/settings')}
            aria-label="Workout settings"
          >
            <img src="/icons/gear.svg" alt="" aria-hidden="true" />
          </button>
        </div>
      </header>
      {deloadBannerVisible && (
        <DeloadBanner percent={deloadState.deloadPercent} />
      )}

      <section className="workout-panel workout-panel--controls">
        <div className="workout-toolbar">
          <div className="workout-toolbar__day">
            <DaySelector
              selectedDay={selectedDay}
              onSelect={handleSelectDay}
              onReset={() => handleSelectDay(weekInfo.dayKey)}
            />
            {isDeloadWeek && (
              <span className="deload-pill" aria-live="polite">
                Deload active
              </span>
            )}
          </div>
        </div>
        <div className="workout-progress">
          <div className="workout-progress__bar">
            <div className="workout-progress__fill" style={{ width: `${progress.pct}%` }} />
          </div>
          <span>{progress.completedExercises} / {progress.totalExercises} exercises complete</span>
        </div>
      </section>

      {isEditing && editDraft ? (
        <EditPanel
          dayKey={selectedDay}
          dayName={editDraft.dayNames?.[selectedDay] || ''}
          days={editDraft.days}
          intervalPlans={editDraft.intervalPlans?.[selectedDay] || []}
          cardioPlans={editDraft.cardioPlans?.[selectedDay] || []}
          dayOrder={editDraft.dayOrder}
          onChange={handlePlanChange}
          onAdd={handleAddExercise}
          onAddInterval={handleAddIntervalItem}
          onAddCardio={handleAddCardioItem}
          onRemove={handleRemoveExercise}
          onRemoveInterval={handleRemoveIntervalItem}
          onRemoveCardio={handleRemoveCardioItem}
          onReorder={handleReorderItem}
          onDayNameChange={handleDayNameChange}
          onIntervalTitleChange={handleIntervalTitleChange}
          onIntervalSegmentChange={handleIntervalSegmentChange}
          onIntervalSegmentAdd={handleAddIntervalSegment}
          onIntervalSegmentRemove={handleRemoveIntervalSegment}
          onCardioChange={handleCardioChange}
          onSave={handleSavePlan}
          onCancel={handleCancelEditing}
          saving={planSaving}
          error={planError}
        />
      ) : (
        <>
          {dayExercises.length === 0 && !hasIntervalContent && !hasCardioContent && (
            <p className="help-text">No exercises yet. Switch to edit mode to design this day.</p>
          )}
          {dayOrder.map((item, index) => {
            if (item.type === 'exercise') {
              const exercise = dayExercises.find((entry) => entry.id === item.id);
              if (!exercise) return null;
              return (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  weights={dayWeights[exercise.id]?.setWeights || []}
                  unit={settings?.unitSystem || 'lbs'}
                  completion={dayCompletion[exercise.id]}
                  onWeightChange={handleWeightChange}
                  onToggleExerciseComplete={handleToggleExerciseComplete}
                  status={weightStatuses[exercise.id]}
                  deloadState={deloadState}
                />
              );
            }
            if (item.type === 'interval') {
              const intervalPlan = dayIntervalPlans.find((planItem) => planItem.id === item.id);
              if (!intervalPlan || !hasIntervalPlanContent(intervalPlan)) return null;
              const completion = intervalCompletionMap[intervalPlan.id]
                || (legacyIntervalCompletion && dayIntervalPlans.length === 1 ? legacyIntervalCompletion : {});
              return (
                <Fragment key={`interval-${intervalPlan.id}`}>
                  <IntervalPlanView
                    plan={intervalPlan}
                    onStart={() => startIntervalTimer(selectedDay, intervalPlan.id)}
                    onToggleComplete={() => handleToggleIntervalComplete(selectedDay, intervalPlan.id)}
                    isComplete={!!completion.completed}
                  />
                  <IntervalTimerPlayer
                    timer={timerState}
                    intervalId={intervalPlan.id}
                    onPause={pauseIntervalTimer}
                    onResume={resumeIntervalTimer}
                    onReset={resetIntervalTimer}
                    onSkip={skipIntervalSegment}
                    onRestart={restartOrRewindInterval}
                    activeDay={selectedDay}
                  />
                </Fragment>
              );
            }
            if (item.type === 'cardio') {
              const cardioPlan = dayCardioPlans.find((planItem) => planItem.id === item.id);
              if (!cardioPlan || !hasCardioPlanContent(cardioPlan)) return null;
              const completion = cardioCompletionMap[cardioPlan.id]
                || (legacyCardioCompletion && dayCardioPlans.length === 1 ? legacyCardioCompletion : {});
              return (
                <CardioPlanView
                  key={`cardio-${cardioPlan.id}`}
                  plan={cardioPlan}
                  onToggleComplete={() => handleToggleCardioComplete(selectedDay, cardioPlan.id)}
                  isComplete={!!completion.completed}
                />
              );
            }
            return null;
          })}
          {!isEditing && (
            <div className="workout-edit-cta">
              <button className="btn" onClick={handleStartEditing}>
                Edit plan
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function WorkoutAuthPanel({ auth }) {
  const [mode, setMode] = useState('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => getStoredRememberMe());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const applied = await applyPersistencePreference(auth, rememberMe ? 'local' : 'session');
      if (applied !== 'local' && rememberMe) {
        setRememberMe(false);
        persistRememberMe(false);
      }
      if (mode === 'sign-in') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (password !== confirmPassword) {
          throw new Error('Passwords must match.');
        }
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="todo-auth">
      <section className="todo-auth__intro">
        <h1>Workout Planner</h1>
        <p>Log lifts, plan deloads, and stay accountable with synced workouts across every device.</p>
      </section>

      <section className="todo-auth__panel">
        <div className="todo-auth__tabs">
          <button
            type="button"
            className={mode === 'sign-in' ? 'is-active' : ''}
            onClick={() => setMode('sign-in')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === 'create' ? 'is-active' : ''}
            onClick={() => setMode('create')}
          >
            Create account
          </button>
        </div>

        <form className="todo-auth__form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            />
          </label>
          {mode === 'create' && (
            <label>
              Confirm password
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </label>
          )}
          <label className="remember-toggle" data-active={rememberMe}>
            <input
              type="checkbox"
              checked={rememberMe}
              className="remember-toggle__input"
              onChange={() => {
                const next = !rememberMe;
                setRememberMe(next);
                persistRememberMe(next);
              }}
            />
            <span className="remember-toggle__track" aria-hidden="true">
              <span className="remember-toggle__thumb" />
            </span>
            <span className="remember-toggle__copy">
              <span className="remember-toggle__title">Remember me</span>
              <span className="remember-toggle__hint">Keep yourself signed in on this device.</span>
            </span>
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </section>
    </div>
  );
}

function DaySelector({ selectedDay, onSelect, onReset }) {
  return (
    <div className="day-selector">
      {DAY_KEYS.map((dayKey) => (
        <button
          key={dayKey}
          className={dayKey === selectedDay ? 'is-active' : ''}
          type="button"
          onClick={() => onSelect(dayKey)}
        >
          {DAY_SHORT_LABELS[dayKey]}
        </button>
      ))}
      <button type="button" className="day-selector__reset" onClick={onReset}>
        Today
      </button>
    </div>
  );
}

function DeloadBanner({ percent }) {
  const pctLabel = Math.round(percent || 0);
  return (
    <div className="deload-banner" role="status" aria-live="polite">
      <strong>DELOAD WEEK ACTIVE</strong>
      <span>Exercise weights reduced by {pctLabel}% this week.</span>
    </div>
  );
}

function ExerciseCard({
  exercise,
  weights,
  unit,
  completion,
  onWeightChange,
  onToggleExerciseComplete,
  status,
  deloadState,
}) {
  const [expanded, setExpanded] = useState(true);
  const [revealedBase, setRevealedBase] = useState({});
  const revealTimersRef = useRef({});
  const sets = Number(exercise.sets) || 0;
  const repsLabel = exercise.reps ? exercise.reps.toString() : 'reps';
  const setWeights = Array.from({ length: sets }, (_, idx) => weights?.[idx] ?? '');
  const isCompleted = completion?.completed || false;
  const deloadActive = Boolean(deloadState?.deloadEnabled && deloadState.isDeloadWeek);
  const deloadPercent = deloadState?.deloadPercent ?? 15;

  useEffect(() => {
    return () => {
      Object.values(revealTimersRef.current).forEach((timer) => clearTimeout(timer));
      revealTimersRef.current = {};
    };
  }, []);

  useEffect(() => {
    setRevealedBase({});
    Object.values(revealTimersRef.current).forEach((timer) => clearTimeout(timer));
    revealTimersRef.current = {};
  }, [exercise.id, deloadActive]);

  const handleRevealBase = (index) => {
    const shouldEnable = !revealedBase[index];
    setRevealedBase((prev) => {
      const next = { ...prev };
      if (shouldEnable) {
        next[index] = true;
      } else {
        delete next[index];
      }
      return next;
    });
    if (revealTimersRef.current[index]) {
      clearTimeout(revealTimersRef.current[index]);
      delete revealTimersRef.current[index];
    }
    if (shouldEnable) {
      revealTimersRef.current[index] = setTimeout(() => {
        setRevealedBase((prev) => {
          const next = { ...prev };
          delete next[index];
          return next;
        });
        delete revealTimersRef.current[index];
      }, 4000);
    }
  };

  const handleCardToggle = () => {
    onToggleExerciseComplete(exercise.id, sets, !isCompleted);
  };

  const handleToggleDetails = (event) => {
    event.stopPropagation();
    setExpanded((prev) => !prev);
  };

  const handleCardClick = (event) => {
    const target = event.target;
    if (target.closest('.exercise-card__toggle') || target.closest('.set-row__input')) {
      return;
    }
    handleCardToggle();
  };

  const handleCardKeyDown = (event) => {
    if (event.target instanceof HTMLInputElement) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCardToggle();
    }
  };

  const cardClasses = ['exercise-card'];
  if (isCompleted) cardClasses.push('is-complete');
  if (deloadActive) cardClasses.push('exercise-card--deload');

  return (
    <article
      className={cardClasses.join(' ')}
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
    >
      <div className="exercise-card__head">
        <div className="exercise-card__title exercise-card__title--with-meta">
          <div className="exercise-card__title-text">
            <h3>{exercise.name}</h3>
            <div className="exercise-card__title-right">
              {isCompleted && <span className="exercise-card__badge">Completed</span>}
              <button
                type="button"
                className="exercise-card__toggle"
                onClick={handleToggleDetails}
                aria-expanded={expanded}
                aria-label={expanded ? 'Hide details' : 'Show details'}
              >
                <span aria-hidden="true">{expanded ? ' − ' : ' + '}</span>
              </button>
            </div>
          </div>
          <div className="exercise-card__meta-line">
            <span className="exercise-card__sets">{sets} sets × {repsLabel}</span>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="exercise-card__body">
          <div className="set-grid set-grid--simple">
            {setWeights.map((value, idx) => {
              const baseRaw = value === undefined || value === null ? '' : value.toString();
              const numericBase = parseNumericWeight(baseRaw);
              const canAutoDeload = deloadActive && numericBase !== null;
              const showingBase = Boolean(revealedBase[idx]);
              const deloadedValue = canAutoDeload
                ? formatWeightValue(applyDeloadToValue(numericBase, deloadPercent)) || ''
                : '';
              const displayValue = showingBase || !canAutoDeload ? baseRaw : deloadedValue;
              const notAuto = deloadActive && baseRaw && !canAutoDeload;
              return (
                <div key={idx} className="set-row">
                  <span className="set-row__label">Set {idx + 1}</span>
                  <input
                    className="set-row__input"
                    type="text"
                    value={displayValue === '' ? '' : displayValue}
                    placeholder={unit}
                    onChange={(event) =>
                      onWeightChange(exercise.id, idx, event.target.value, {
                        isDeloadedInput: canAutoDeload && !showingBase,
                      })
                    }
                  />
                  <span className="set-row__unit">{unit}</span>
                  {canAutoDeload && (
                    <button
                      type="button"
                      className="set-row__base-link"
                      onClick={() => handleRevealBase(idx)}
                    >
                      {showingBase ? 'Hide base' : 'View base'}
                    </button>
                  )}
                  <div className="set-row__meta">
                    {canAutoDeload && !showingBase && (
                      <span className="set-row__badge">Deloaded (auto)</span>
                    )}
                    {showingBase && (
                      <span className="set-row__badge set-row__badge--base">
                        Base: {baseRaw || '—'}
                      </span>
                    )}
                    {notAuto && (
                      <span className="set-row__badge set-row__badge--muted">
                        Not auto-deloaded
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <ExerciseStatus status={status} />
        </div>
      )}
    </article>
  );
}

function EditPanel({
  dayKey,
  dayName,
  days,
  intervalPlans,
  cardioPlans,
  dayOrder,
  onChange,
  onAdd,
  onAddInterval,
  onAddCardio,
  onRemove,
  onRemoveInterval,
  onRemoveCardio,
  onReorder,
  onDayNameChange,
  onIntervalTitleChange,
  onIntervalSegmentChange,
  onIntervalSegmentAdd,
  onIntervalSegmentRemove,
  onCardioChange,
  onSave,
  onCancel,
  saving,
  error,
}) {
  const exercises = days?.[dayKey] || [];
  const exerciseIndexById = new Map(
    exercises.filter((exercise) => exercise?.id).map((exercise, index) => [exercise.id, index]),
  );
  const orderedItems = normalizeDayOrder(
    dayOrder,
    days,
    { [dayKey]: intervalPlans },
    { [dayKey]: cardioPlans },
    { includeEmpty: true },
  )[dayKey] || [];
  return (
    <div className="workout-edit">
      <div className="workout-edit__toolbar">
        <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button className="btn" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save plan'}
        </button>
      </div>
      <label>
        Day name
        <input
          type="text"
          value={dayName || ''}
          placeholder="e.g., Chest & Tris"
          onChange={(event) => onDayNameChange(dayKey, event.target.value)}
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      {exercises.length === 0 && (
        <p className="help-text">No exercises yet. Add one to start building this day.</p>
      )}
      {orderedItems.map((item, orderIndex) => {
        if (item.type === 'exercise') {
          const exerciseIndex = exerciseIndexById.get(item.id);
          const exercise = exerciseIndex !== undefined ? exercises[exerciseIndex] : null;
          if (!exercise) return null;
          return (
            <article key={exercise.id || orderIndex} className="exercise-editor">
              <div className="exercise-editor__grid">
                <label>
                  Name
                  <input
                    type="text"
                    value={exercise.name}
                    onChange={(event) => onChange(dayKey, exerciseIndex, 'name', event.target.value)}
                  />
                </label>
                <label>
                  Sets
                  <input
                    type="number"
                    min="1"
                    value={exercise.sets}
                    onChange={(event) => onChange(dayKey, exerciseIndex, 'sets', Number(event.target.value))}
                  />
                </label>
                <label>
                  Reps
                  <input
                    type="text"
                    value={exercise.reps ?? ''}
                    placeholder="e.g., 8-10 reps or ✅"
                    onChange={(event) => onChange(dayKey, exerciseIndex, 'reps', event.target.value)}
                  />
                </label>
              </div>
              <div className="exercise-editor__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => onReorder(dayKey, orderIndex, -1)}
                  disabled={orderIndex === 0}
                >
                  Move up
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => onReorder(dayKey, orderIndex, 1)}
                  disabled={orderIndex === orderedItems.length - 1}
                >
                  Move down
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => onRemove(dayKey, exerciseIndex)}
                  aria-label="Remove exercise"
                >
                  <img src="/icons/trash.svg" alt="" aria-hidden="true" />
                </button>
              </div>
            </article>
          );
        }
        if (item.type === 'interval') {
          const intervalPlan = intervalPlans.find((plan) => plan.id === item.id);
          if (!intervalPlan) return null;
          return (
            <article key={`interval-${orderIndex}`} className="exercise-editor">
              <IntervalPlanEditor
                plan={intervalPlan}
                onTitleChange={(value) => onIntervalTitleChange(dayKey, intervalPlan.id, value)}
                onSegmentChange={(index, field, value) =>
                  onIntervalSegmentChange(dayKey, intervalPlan.id, index, field, value)
                }
                onAddSegment={() => onIntervalSegmentAdd(dayKey, intervalPlan.id)}
                onRemoveSegment={(index) => onIntervalSegmentRemove(dayKey, intervalPlan.id, index)}
              />
              <div className="exercise-editor__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => onReorder(dayKey, orderIndex, -1)}
                  disabled={orderIndex === 0}
                >
                  Move up
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => onReorder(dayKey, orderIndex, 1)}
                  disabled={orderIndex === orderedItems.length - 1}
                >
                  Move down
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => onRemoveInterval(dayKey, intervalPlan.id)}
                  aria-label="Remove interval timer"
                >
                  <img src="/icons/trash.svg" alt="" aria-hidden="true" />
                </button>
              </div>
            </article>
          );
        }
        if (item.type === 'cardio') {
          const cardioPlan = cardioPlans.find((plan) => plan.id === item.id);
          if (!cardioPlan) return null;
          return (
            <article key={`cardio-${orderIndex}`} className="exercise-editor">
              <CardioPlanEditor
                plan={cardioPlan}
                onChange={(field, value) => onCardioChange(dayKey, cardioPlan.id, field, value)}
              />
              <div className="exercise-editor__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => onReorder(dayKey, orderIndex, -1)}
                  disabled={orderIndex === 0}
                >
                  Move up
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => onReorder(dayKey, orderIndex, 1)}
                  disabled={orderIndex === orderedItems.length - 1}
                >
                  Move down
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => onRemoveCardio(dayKey, cardioPlan.id)}
                  aria-label="Remove cardio plan"
                >
                  <img src="/icons/trash.svg" alt="" aria-hidden="true" />
                </button>
              </div>
            </article>
          );
        }
        return null;
      })}
      <div className="workout-edit__add-actions">
        <button className="btn btn--secondary" type="button" onClick={() => onAdd(dayKey)}>
          Add Exercise
        </button>
        <button
          className="btn btn--secondary"
          type="button"
          onClick={() => onAddInterval(dayKey)}
        >
          Add Interval Timer
        </button>
        <button
          className="btn btn--secondary"
          type="button"
          onClick={() => onAddCardio(dayKey)}
        >
          Add Cardio Plan
        </button>
      </div>
    </div>
  );
}

function IntervalPlanView({ plan, onStart, onToggleComplete, isComplete }) {
  if (!plan) return null;
  const hasSegments = Array.isArray(plan.segments) && plan.segments.length > 0;
  if (!plan.title && !hasSegments) return null;
  const [expanded, setExpanded] = useState(true);
  const handleCardClick = (event) => {
    if (event.target.closest('button') || event.target.closest('input')) return;
    onToggleComplete();
  };
  const handleKeyDown = (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggleComplete();
    }
  };
  return (
    <article
      className={`exercise-card interval-card${isComplete ? ' is-complete' : ''}`}
      tabIndex={0}
      role="button"
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
    >
      <div className="exercise-card__head">
        <div className="exercise-card__title">
          <h3>{plan.title || 'Interval Timer'}</h3>
          <div className="interval-card__header-right">
            {isComplete && <span className="exercise-card__badge">Completed</span>}
            <span className="interval-total">
              <span className="interval-total__label">Total time</span>
              <span className="interval-total__value">
                {formatDurationLabel(getIntervalPlanTotalSeconds(plan))}
              </span>
            </span>
            <button
              type="button"
              className="exercise-card__toggle"
              aria-label={expanded ? 'Hide interval details' : 'Show interval details'}
              onClick={(event) => {
                event.stopPropagation();
                setExpanded((prev) => !prev);
              }}
            >
              <span aria-hidden="true">{expanded ? '−' : '+'}</span>
            </button>
          </div>
        </div>
        <div className="exercise-card__meta">
          <button type="button" className="btn btn--secondary" onClick={(event) => { event.stopPropagation(); onStart(); }} disabled={!hasSegments}>
            Start
          </button>
        </div>
      </div>
      {expanded && hasSegments && (
        <div className="exercise-card__body">
          <ul className="interval-list">
            {plan.segments.map((segment, index) => (
              <li key={`${segment.label}-${index}`}>
                <span>
                  {segment.label || `Interval ${index + 1}`}
                  {Number(segment.repeat) > 1 ? ` ×${segment.repeat}` : ''}
                </span>
                <span className="interval-list__duration">{segment.duration || '--'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function IntervalTimerPlayer({ timer, intervalId, onPause, onResume, onReset, onSkip, onRestart, activeDay }) {
  if (!timer.dayKey || timer.dayKey !== activeDay || !timer.segments.length || timer.intervalId !== intervalId) {
    return null;
  }
  const current = timer.segments[timer.currentIndex];
  const next = timer.segments[timer.currentIndex + 1];
  const isRunning = timer.isRunning && timer.remaining > 0;
  const totalRemainingSeconds = timer.segments.length
    ? timer.remaining
      + timer.segments
        .slice(timer.currentIndex + 1)
        .reduce((sum, segment) => sum + (segment.durationSeconds || 0), 0)
    : 0;
  return (
    <section className="interval-player">
      <div className="interval-player__time">
        <p className="interval-player__label">{current?.label || timer.title}</p>
        <div className="interval-player__clock">{formatSeconds(timer.remaining)}</div>
        {isRunning && (
          <p className="help-text">Total time left: {formatDurationLabel(totalRemainingSeconds)}</p>
        )}
        {next && <p className="help-text">Next: {next.label}</p>}
      </div>
      <div className="interval-player__controls">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onRestart}
          aria-label="Restart or go back"
        >
          ←
        </button>
        {isRunning ? (
          <button type="button" className="btn btn--secondary" onClick={onPause}>
            Pause
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            onClick={onResume}
            disabled={!timer.segments.length}
          >
            Resume
          </button>
        )}
        <button
          type="button"
          className="btn btn--secondary"
          onClick={onSkip}
          aria-label="Skip interval"
        >
          →
        </button>
        <button type="button" className="btn btn--ghost" onClick={onReset} aria-label="Reset timer">
          Reset
        </button>
      </div>
    </section>
  );
}

function CardioPlanView({ plan, onToggleComplete, isComplete }) {
  if (!plan) return null;
  if (!(plan.title || plan.duration || plan.notes)) {
    return null;
  }
  const [expanded, setExpanded] = useState(true);
  const handleCardClick = (event) => {
    if (event.target.closest('button') || event.target.closest('input') || event.target.closest('textarea')) {
      return;
    }
    onToggleComplete();
  };
  const handleKeyDown = (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggleComplete();
    }
  };
  return (
    <article
      className={`exercise-card cardio-card${isComplete ? ' is-complete' : ''}`}
      tabIndex={0}
      role="button"
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
    >
      <div className="exercise-card__head">
        <div className="exercise-card__title">
          <h3>{plan.title || 'Cardio Plan'}</h3>
          <div className="exercise-card__title-right">
            {isComplete && <span className="exercise-card__badge">Completed</span>}
            <button
              type="button"
              className="exercise-card__toggle"
              aria-label={expanded ? 'Hide cardio details' : 'Show cardio details'}
              onClick={(event) => {
                event.stopPropagation();
                setExpanded((prev) => !prev);
              }}
            >
              <span aria-hidden="true">{expanded ? ' − ' : ' + '}</span>
            </button>
          </div>
        </div>
        <div className="exercise-card__meta">
        </div>
      </div>
      {expanded && (
        <div className="exercise-card__body">
          {plan.duration && <p><strong>Duration:</strong> {plan.duration}</p>}
          {plan.notes && <p className="help-text">{plan.notes}</p>}
        </div>
      )}
    </article>
  );
}

function IntervalPlanEditor({ plan, onTitleChange, onSegmentChange, onAddSegment, onRemoveSegment }) {
  const currentPlan = plan || { title: '', segments: [] };
  return (
    <section className="interval-editor">
      <h3>Interval Timer</h3>
      <label>
        Title
        <input
          type="text"
          value={currentPlan.title || ''}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="e.g., Abs Flow"
        />
      </label>
          <div className="interval-editor__segments">
            {(currentPlan.segments || []).map((segment, index) => (
              <div key={index} className="interval-editor__row">
                <input
                  type="text"
              value={segment.label || ''}
              placeholder="Move name"
              onChange={(event) => onSegmentChange(index, 'label', event.target.value)}
            />
                <div className="interval-editor__duration">
                  <input
                    type="number"
                    min="0"
                    value={segment.minutes || ''}
                    placeholder="Min"
                    onChange={(event) => onSegmentChange(index, 'minutes', event.target.value)}
                  />
                  <span> : </span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={segment.seconds || ''}
                    placeholder="Sec"
                    onChange={(event) => onSegmentChange(index, 'seconds', event.target.value)}
                  />
                </div>
                <input
                  type="number"
                  min="1"
                  value={segment.repeat || '1'}
                  placeholder="x"
                  onChange={(event) => onSegmentChange(index, 'repeat', event.target.value)}
                />
                <button
                  type="button"
                  className="icon-button"
              onClick={() => onRemoveSegment(index)}
              aria-label="Remove interval"
            >
              <img src="/icons/trash.svg" alt="" aria-hidden="true" />
            </button>
          </div>
        ))}
        <button type="button" className="btn btn--secondary" onClick={onAddSegment}>
          Add interval
        </button>
      </div>
    </section>
  );
}

function CardioPlanEditor({ plan, onChange }) {
  const currentPlan = plan || { title: '', duration: '', notes: '' };
  return (
    <section className="cardio-editor">
      <h3>Cardio Plan</h3>
      <label>
        Title
        <input
          type="text"
          value={currentPlan.title || ''}
          onChange={(event) => onChange('title', event.target.value)}
          placeholder="e.g., HIIT + Abs"
        />
      </label>
      <label>
        Duration / Structure
        <input
          type="text"
          value={currentPlan.duration || ''}
          onChange={(event) => onChange('duration', event.target.value)}
          placeholder="e.g., 20 min intervals"
        />
      </label>
      <label>
        Notes
        <textarea
          value={currentPlan.notes || ''}
          onChange={(event) => onChange('notes', event.target.value)}
          placeholder="Detail the cardio plan..."
        />
      </label>
    </section>
  );
}

export default WorkoutHub;
