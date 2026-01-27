import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  normalizeDeloadConfig,
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
    };
  });
};

const convertIntervalPlans = (plans = {}) => {
  const clone = cloneIntervals(plans);
  Object.keys(clone).forEach((dayKey) => {
    const plan = clone[dayKey] || { title: '', segments: [] };
    clone[dayKey] = {
      title: plan.title || '',
      segments: convertIntervalSegments(plan.segments || []),
    };
  });
  return clone;
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

  const playIntervalChime = useCallback(() => {
    const AudioContextCtor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AudioContextCtor) return;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
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
  }, []);

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
    const normalizedDeload = normalizeDeloadConfig(settings || {});
    const nextAnchor = settings?.deloadAnchorWeekId || normalizedDeload.deloadAnchorWeekId || weekInfo.weekId;
    setEditDraft({
      days: clonePlan(plan.days),
      dayNames: { ...plan.dayNames },
      intervalPlans: convertIntervalPlans(plan.intervalPlans),
      cardioPlans: cloneCardioPlans(plan.cardioPlans),
      deload: {
        ...normalizedDeload,
        deloadAnchorWeekId: nextAnchor,
      },
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
      dayExercises.push(defaultExercise());
      nextDays[dayKey] = dayExercises;
      return { ...prev, days: nextDays };
    });
  };

  const handleRemoveExercise = (dayKey, index) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const nextDays = clonePlan(prev.days);
      const dayExercises = Array.isArray(nextDays[dayKey]) ? [...nextDays[dayKey]] : [];
      dayExercises.splice(index, 1);
      nextDays[dayKey] = dayExercises;
      return { ...prev, days: nextDays };
    });
  };

  const handleReorderExercise = (dayKey, index, direction) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const nextDays = clonePlan(prev.days);
      const dayExercises = Array.isArray(nextDays[dayKey]) ? [...nextDays[dayKey]] : [];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= dayExercises.length) {
        return prev;
      }
      const temp = dayExercises[index];
      dayExercises[index] = dayExercises[targetIndex];
      dayExercises[targetIndex] = temp;
      nextDays[dayKey] = dayExercises;
      return { ...prev, days: nextDays };
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

  const handleIntervalTitleChange = (dayKey, value) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const plans = cloneIntervals(prev.intervalPlans || {});
      plans[dayKey] = {
        title: value,
        segments: Array.isArray(plans[dayKey]?.segments) ? [...plans[dayKey].segments] : [],
      };
      return { ...prev, intervalPlans: plans };
    });
  };

const handleIntervalSegmentChange = (dayKey, index, field, value) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const plans = cloneIntervals(prev.intervalPlans || {});
      const current = plans[dayKey] || { title: '', segments: [] };
      const segments = Array.isArray(current.segments) ? [...current.segments] : [];
      segments[index] = {
        ...segments[index],
        [field]: value,
      };
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
      plans[dayKey] = { ...current, segments };
      return { ...prev, intervalPlans: plans };
    });
  };

  const handleAddIntervalSegment = (dayKey) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const plans = cloneIntervals(prev.intervalPlans || {});
      const current = plans[dayKey] || { title: '', segments: [] };
      const segments = Array.isArray(current.segments) ? [...current.segments] : [];
      segments.push({ label: '', duration: '' });
      plans[dayKey] = { ...current, segments };
      return { ...prev, intervalPlans: plans };
    });
  };

  const handleRemoveIntervalSegment = (dayKey, index) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const plans = cloneIntervals(prev.intervalPlans || {});
      const current = plans[dayKey] || { title: '', segments: [] };
      const segments = Array.isArray(current.segments) ? [...current.segments] : [];
      segments.splice(index, 1);
      plans[dayKey] = { ...current, segments };
      return { ...prev, intervalPlans: plans };
    });
  };

  const handleCardioChange = (dayKey, field, value) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const plans = cloneCardioPlans(prev.cardioPlans || {});
      plans[dayKey] = {
        ...plans[dayKey],
        [field]: value,
      };
      return { ...prev, cardioPlans: plans };
    });
  };

  const handleDeloadConfigChange = (field, value) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const current = prev.deload || {};
      let nextValue = value;
      if (field === 'deloadPercent' || field === 'deloadFrequencyWeeks') {
        nextValue = Number(value);
      }
      return {
        ...prev,
        deload: {
          ...current,
          [field]: nextValue,
        },
      };
    });
  };

  const startIntervalTimer = (dayKey) => {
    const intervalPlan = plan.intervalPlans?.[dayKey];
    if (!intervalPlan) return;
    const segments = (intervalPlan.segments || [])
      .map((segment) => ({
        label: segment.label || '',
        durationSeconds: parseDurationSeconds(segment.duration),
      }))
      .filter((segment) => segment.durationSeconds > 0);
    if (!segments.length) {
      return;
    }
    setTimerState({
      dayKey,
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
    setTimerState((prev) => ({ ...prev, isRunning: true }));
  };

  const resetIntervalTimer = () => {
    setTimerState((prev) => ({
      ...prev,
      isRunning: false,
      remaining: 0,
      currentIndex: 0,
      dayKey: null,
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
      if (prev.remaining <= prev.segments[prev.currentIndex].durationSeconds - 2 && prev.remaining > 0) {
        return {
          ...prev,
          remaining: prev.segments[prev.currentIndex].durationSeconds,
        };
      }
      if (prev.currentIndex === 0) {
        return { ...prev, remaining: prev.segments[0].durationSeconds };
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
        const intervalPlan = editDraft.intervalPlans?.[dayKey] || { title: '', segments: [] };
        sanitizedIntervals[dayKey] = {
          title: (intervalPlan.title || '').trim(),
          segments: Array.isArray(intervalPlan.segments)
            ? intervalPlan.segments
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
                }))
                .filter((segment) => segment.label || segment.duration)
            : [],
        };
        const cardioPlan = editDraft.cardioPlans?.[dayKey] || { title: '', duration: '', notes: '' };
        sanitizedCardio[dayKey] = {
          title: (cardioPlan.title || '').trim(),
          duration: (cardioPlan.duration || '').trim(),
          notes: (cardioPlan.notes || '').trim(),
        };
      });
      const deloadDraftConfig = normalizeDeloadConfig(editDraft.deload || settings || {});
      let nextAnchor = editDraft.deload?.deloadAnchorWeekId || settings?.deloadAnchorWeekId || null;
      if (deloadDraftConfig.deloadEnabled) {
        if (!settings?.deloadEnabled || !nextAnchor) {
          nextAnchor = weekInfo.weekId;
        }
      } else {
        nextAnchor = null;
      }
      const deloadPayload = {
        deloadEnabled: deloadDraftConfig.deloadEnabled,
        deloadPercent: deloadDraftConfig.deloadPercent,
        deloadFrequencyWeeks: deloadDraftConfig.deloadFrequencyWeeks,
        deloadAnchorWeekId: deloadDraftConfig.deloadEnabled ? nextAnchor : null,
      };
      await Promise.all([
        savePlan(authState.user.uid, {
          days: sanitizedDays,
          dayNames: sanitizedDayNames,
          intervalPlans: sanitizedIntervals,
          cardioPlans: sanitizedCardio,
        }),
        updateSettings(authState.user.uid, deloadPayload),
      ]);
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

  const handleToggleIntervalComplete = async (dayKey) => {
    if (!authState.user) return;
    try {
      const nextValue = !completions.dayData?.[dayKey]?.intervalPlan?.completed;
      await updateCompletion(authState.user.uid, weekInfo.weekId, dayKey, 'intervalPlan', {
        completed: nextValue,
      });
    } catch (error) {
      console.error('Failed to update interval completion', error);
    }
  };

  const handleToggleCardioComplete = async (dayKey) => {
    if (!authState.user) return;
    try {
      const nextValue = !completions.dayData?.[dayKey]?.cardioPlan?.completed;
      await updateCompletion(authState.user.uid, weekInfo.weekId, dayKey, 'cardioPlan', {
        completed: nextValue,
      });
    } catch (error) {
      console.error('Failed to update cardio completion', error);
    }
  };

  const dayExercises = useMemo(() => plan.days?.[selectedDay] || [], [plan, selectedDay]);
  const dayWeights = weights[selectedDay]?.exercises || {};
  const dayCompletion = completions.dayData?.[selectedDay]?.exercises || {};
  const intervalCompletion = completions.dayData?.[selectedDay]?.intervalPlan || {};
  const cardioCompletion = completions.dayData?.[selectedDay]?.cardioPlan || {};
  const deloadState = useMemo(
    () => computeDeloadState(settings, weekInfo.weekId),
    [settings, weekInfo.weekId]
  );
  const isDeloadWeek = deloadState.isDeloadWeek;
  const hasIntervalContent = useMemo(() => {
    const current = plan.intervalPlans?.[selectedDay];
    if (!current) return false;
    const hasSegments = Array.isArray(current.segments) && current.segments.length > 0;
    return Boolean(current.title || hasSegments);
  }, [plan.intervalPlans, selectedDay]);
  const hasCardioContent = useMemo(() => {
    const current = plan.cardioPlans?.[selectedDay];
    if (!current) return false;
    return Boolean(current.title || current.duration || current.notes);
  }, [plan.cardioPlans, selectedDay]);

  const progress = useMemo(() => {
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
    if (hasIntervalContent) {
      totals.totalExercises += 1;
      if (intervalCompletion.completed) {
        totals.completedExercises += 1;
      }
    }
    if (hasCardioContent) {
      totals.totalExercises += 1;
      if (cardioCompletion.completed) {
        totals.completedExercises += 1;
      }
    }
    const pct = totals.totalExercises === 0
      ? 0
      : Math.round((totals.completedExercises / totals.totalExercises) * 100);
    return { ...totals, pct };
  }, [dayExercises, dayCompletion, hasIntervalContent, hasCardioContent, intervalCompletion.completed, cardioCompletion.completed]);

  if (authState.loading) {
    return (
      <main className="workout-page">
        <p>Loading workout data…</p>
      </main>
    );
  }

  if (!authState.user) {
    return (
      <main className="workout-page workout-page--auth">
        <section className="workout-hero workout-hero--auth">
          <div className="workout-hero__identity">
            <div>
              <h1>Workout Planner and Tracker</h1>
              <p className="lead">
                Design your weekly split, log weights, and track cardio in one secure dashboard.
              </p>
            </div>
          </div>
        </section>
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
      <header className="workout-hero">
        <div>
            <h1>{headerTitle}</h1>
          <p className="help-text">
            {dayLabel} • Week of {getWeekLabel(weekInfo)} • Progress {progress.pct}%
          </p>
        </div>
        <div className="workout-hero__actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => navigate('/projects/workout/settings')}
          >
            Settings
          </button>
          {!isEditing && (
            <button className="btn" onClick={handleStartEditing}>
              Edit plan
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => navigate('/projects/workout/data')}
          >
            Data
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
          intervalPlan={editDraft.intervalPlans?.[selectedDay]}
          cardioPlan={editDraft.cardioPlans?.[selectedDay]}
          deloadConfig={editDraft.deload}
          onChange={handlePlanChange}
          onAdd={handleAddExercise}
          onRemove={handleRemoveExercise}
          onReorder={handleReorderExercise}
          onDayNameChange={handleDayNameChange}
          onIntervalTitleChange={handleIntervalTitleChange}
          onIntervalSegmentChange={handleIntervalSegmentChange}
          onIntervalSegmentAdd={handleAddIntervalSegment}
          onIntervalSegmentRemove={handleRemoveIntervalSegment}
          onCardioChange={handleCardioChange}
          onDeloadChange={handleDeloadConfigChange}
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
          {dayExercises.map((exercise) => (
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
          ))}
          <IntervalPlanView
            plan={plan.intervalPlans?.[selectedDay]}
            onStart={() => startIntervalTimer(selectedDay)}
            onToggleComplete={() => handleToggleIntervalComplete(selectedDay)}
            isComplete={!!intervalCompletion.completed}
          />
          <IntervalTimerPlayer
            timer={timerState}
            onPause={pauseIntervalTimer}
            onResume={resumeIntervalTimer}
            onReset={resetIntervalTimer}
            onSkip={skipIntervalSegment}
            onRestart={restartOrRewindInterval}
            activeDay={selectedDay}
          />
          <CardioPlanView
            plan={plan.cardioPlans?.[selectedDay]}
            onToggleComplete={() => handleToggleCardioComplete(selectedDay)}
            isComplete={!!cardioCompletion.completed}
          />
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
    <section className="workout-auth">
      <div className="workout-auth__tabs">
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
      <form className="workout-auth__form" onSubmit={handleSubmit}>
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
        <label className="remember-toggle">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={() => {
              const next = !rememberMe;
              setRememberMe(next);
              persistRememberMe(next);
            }}
          />
          Remember me on this device
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </section>
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
          <h3>{exercise.name}</h3>
          <span className="exercise-card__sets">{sets} sets × {repsLabel}</span>
        </div>
        <div className="exercise-card__meta">
          <button
            type="button"
            className="exercise-card__toggle"
            onClick={handleToggleDetails}
            aria-expanded={expanded}
            aria-label={expanded ? 'Hide details' : 'Show details'}
          >
            <span aria-hidden="true">{expanded ? ' − ' : ' + '}</span>
          </button>
          {isCompleted && <span className="exercise-card__badge">Completed</span>}
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
  intervalPlan,
  cardioPlan,
  deloadConfig,
  onChange,
  onAdd,
  onRemove,
  onReorder,
  onDayNameChange,
  onIntervalTitleChange,
  onIntervalSegmentChange,
  onIntervalSegmentAdd,
  onIntervalSegmentRemove,
  onCardioChange,
  onDeloadChange,
  onSave,
  onCancel,
  saving,
  error,
}) {
  const exercises = days?.[dayKey] || [];
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
      {exercises.map((exercise, index) => (
        <article key={exercise.id || index} className="exercise-editor">
          <div className="exercise-editor__grid">
            <label>
              Name
              <input
                type="text"
                value={exercise.name}
                onChange={(event) => onChange(dayKey, index, 'name', event.target.value)}
              />
            </label>
            <label>
              Sets
              <input
                type="number"
                min="1"
                value={exercise.sets}
                onChange={(event) => onChange(dayKey, index, 'sets', Number(event.target.value))}
              />
            </label>
            <label>
              Reps
              <input
                type="text"
                value={exercise.reps ?? ''}
                placeholder="e.g., 8-10 reps or ✅"
                onChange={(event) => onChange(dayKey, index, 'reps', event.target.value)}
              />
            </label>
          </div>
          <div className="exercise-editor__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => onReorder(dayKey, index, -1)}
              disabled={index === 0}
            >
              Move up
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => onReorder(dayKey, index, 1)}
              disabled={index === exercises.length - 1}
            >
              Move down
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => onRemove(dayKey, index)}
              aria-label="Remove exercise"
            >
              <img src="/icons/trash.svg" alt="" aria-hidden="true" />
            </button>
          </div>
        </article>
      ))}
      <button className="btn btn--secondary" type="button" onClick={() => onAdd(dayKey)}>
        Add exercise
      </button>
      <DeloadConfigEditor config={deloadConfig} onChange={onDeloadChange} />
      <IntervalPlanEditor
        plan={intervalPlan}
        onTitleChange={(value) => onIntervalTitleChange(dayKey, value)}
        onSegmentChange={(index, field, value) => onIntervalSegmentChange(dayKey, index, field, value)}
        onAddSegment={() => onIntervalSegmentAdd(dayKey)}
        onRemoveSegment={(index) => onIntervalSegmentRemove(dayKey, index)}
      />
      <CardioPlanEditor
        plan={cardioPlan}
        onChange={(field, value) => onCardioChange(dayKey, field, value)}
      />
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
        </div>
        <div className="exercise-card__meta">
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
        <button type="button" className="btn btn--secondary" onClick={(event) => { event.stopPropagation(); onStart(); }} disabled={!hasSegments}>
          Start
        </button>
        {isComplete && <span className="exercise-card__badge">Completed</span>}
      </div>
      </div>
      {expanded && hasSegments && (
        <div className="exercise-card__body">
          <ul className="interval-list">
            {plan.segments.map((segment, index) => (
              <li key={`${segment.label}-${index}`}>
                <span>{segment.label || `Interval ${index + 1}`}</span>
                <span className="interval-list__duration">{segment.duration || '--'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function IntervalTimerPlayer({ timer, onPause, onResume, onReset, onSkip, onRestart, activeDay }) {
  if (!timer.dayKey || timer.dayKey !== activeDay || !timer.segments.length) {
    return null;
  }
  const current = timer.segments[timer.currentIndex];
  const next = timer.segments[timer.currentIndex + 1];
  const isRunning = timer.isRunning && timer.remaining > 0;
  return (
    <section className="interval-player">
      <div className="interval-player__time">
        <p className="interval-player__label">{current?.label || timer.title}</p>
        <div className="interval-player__clock">{formatSeconds(timer.remaining)}</div>
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
        </div>
        <div className="exercise-card__meta">
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
          {isComplete && <span className="exercise-card__badge">Completed</span>}
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

function DeloadConfigEditor({ config, onChange }) {
  const normalized = normalizeDeloadConfig(config || {});
  const percentValue = normalized.deloadPercent ?? 15;
  const frequencyValue = normalized.deloadFrequencyWeeks ?? 4;
  return (
    <section className="deload-config">
      <div className="deload-config__head">
        <h3>Deload Week</h3>
        <span className="tag">Exercises only</span>
      </div>
      <label className="toggle">
        <input
          type="checkbox"
          checked={Boolean(normalized.deloadEnabled)}
          onChange={(event) => onChange('deloadEnabled', event.target.checked)}
        />
        Enable deload weeks
      </label>
      <div className="deload-config__grid">
        <label>
          Deload percentage
          <input
            type="number"
            min="1"
            max="90"
            value={percentValue}
            onChange={(event) => onChange('deloadPercent', event.target.value)}
            disabled={!normalized.deloadEnabled}
          />
          <span className="help-text">Lower weights by this amount.</span>
        </label>
        <label>
          Frequency (weeks)
          <input
            type="number"
            min="2"
            max="12"
            value={frequencyValue}
            onChange={(event) => onChange('deloadFrequencyWeeks', event.target.value)}
            disabled={!normalized.deloadEnabled}
          />
          <span className="help-text">Every Nth week will deload.</span>
        </label>
      </div>
      <p className="help-text">
        Applies to exercise weights only. Trackers and cardio stay unchanged.
      </p>
    </section>
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
