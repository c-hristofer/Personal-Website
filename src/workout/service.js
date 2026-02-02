import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  createEmptyPlanDays,
  DAY_KEYS,
  createDefaultDayNames,
  DAY_LABELS,
  DAY_SHORT_LABELS,
  createEmptyIntervalPlans,
  createEmptyCardioPlans,
} from './constants';
import { normalizeDeloadConfig, parseNumericWeight } from './utils';

const getPlanRef = (uid) => doc(db, 'users', uid, 'workoutPlan', 'plan');
const getWeightsCollection = (uid) => collection(db, 'users', uid, 'workoutWeights');
const getWeightRef = (uid, dayKey) => doc(db, 'users', uid, 'workoutWeights', dayKey);
const getCompletionsCollection = (uid) => collection(db, 'users', uid, 'workoutCompletions');
const getCompletionRef = (uid, weekId) => doc(db, 'users', uid, 'workoutCompletions', weekId);
const getSettingsRef = (uid) => doc(db, 'users', uid, 'workoutSettings', 'settings');
const getHistoryCollection = (uid) => collection(db, 'users', uid, 'workoutHistory');
const getHistoryRef = (uid, weekId) => doc(db, 'users', uid, 'workoutHistory', weekId);

const getDefaultSettings = () => ({
  unitSystem: 'lbs',
  defaultDayView: 'today',
  lastSelectedDay: 'monday',
  deloadEnabled: false,
  deloadPercent: 15,
  deloadFrequencyWeeks: 4,
  deloadAnchorWeekId: null,
  lastArchivedWeekId: null,
  lastArchivedAt: null,
});

const normalizeSettingsPayload = (data = {}) => {
  const defaults = getDefaultSettings();
  const normalizedDeload = normalizeDeloadConfig(data);
  const lastSelectedDay = DAY_KEYS.includes(data.lastSelectedDay) ? data.lastSelectedDay : defaults.lastSelectedDay;
  const unitSystem = data.unitSystem === 'kg' ? 'kg' : defaults.unitSystem;
  const defaultDayView = data.defaultDayView === 'last' ? 'last' : defaults.defaultDayView;
  return {
    ...defaults,
    ...data,
    ...normalizedDeload,
    unitSystem,
    defaultDayView,
    lastSelectedDay,
    lastArchivedWeekId: data.lastArchivedWeekId || null,
    lastArchivedAt: data.lastArchivedAt || null,
  };
};

const normalizeDays = (days = {}) => {
  const base = createEmptyPlanDays();
  if (Array.isArray(days)) {
    DAY_KEYS.forEach((key, index) => {
      base[key] = Array.isArray(days[index]) ? days[index] : [];
    });
    return base;
  }
  const keyMap = Object.entries(DAY_LABELS).reduce((acc, [fullKey, label]) => {
    acc[fullKey] = fullKey;
    acc[label.toLowerCase()] = fullKey;
    acc[DAY_SHORT_LABELS[fullKey].toLowerCase()] = fullKey;
    return acc;
  }, {});
  Object.keys(days || {}).forEach((rawKey) => {
    const normalizedKey = keyMap[(rawKey || '').toString().toLowerCase()];
    if (normalizedKey) {
      base[normalizedKey] = Array.isArray(days[rawKey]) ? days[rawKey] : [];
    }
  });
  DAY_KEYS.forEach((key) => {
    if (!Array.isArray(base[key])) {
      base[key] = [];
    }
  });
  return base;
};

const normalizeDayNames = (names = {}) => {
  const defaults = createDefaultDayNames();
  DAY_KEYS.forEach((key) => {
    const value = typeof names[key] === 'string' ? names[key].trim() : '';
    defaults[key] = value || DAY_LABELS[key];
  });
  return defaults;
};

const buildPlanId = (rawId, prefix, dayKey, index) => {
  if (rawId !== undefined && rawId !== null && rawId !== '') {
    return rawId.toString();
  }
  return `${prefix}-${dayKey}-${index + 1}`;
};

const normalizeIntervalPlans = (plans = {}) => {
  const defaults = createEmptyIntervalPlans();
  DAY_KEYS.forEach((key) => {
    const legacyPlan = plans[key];
    const legacyHasContent = Boolean(legacyPlan?.title) || (legacyPlan?.segments || []).length > 0;
    const dayPlans = Array.isArray(plans[key])
      ? plans[key]
      : (legacyHasContent ? [legacyPlan] : []);
    defaults[key] = dayPlans.map((plan, index) => {
      const segments = Array.isArray(plan?.segments)
        ? plan.segments.map((segment) => ({
            label: segment?.label ? segment.label.toString() : '',
            duration: segment?.duration ? segment.duration.toString() : '',
            repeat: segment?.repeat !== undefined ? segment.repeat.toString() : '1',
          }))
        : [];
      return {
        id: buildPlanId(plan?.id, 'interval', key, index),
        title: plan?.title ? plan.title.toString() : '',
        segments,
      };
    });
  });
  return defaults;
};

const normalizeCardioPlans = (plans = {}) => {
  const defaults = createEmptyCardioPlans();
  DAY_KEYS.forEach((key) => {
    const legacyPlan = plans[key];
    const legacyHasContent = Boolean(legacyPlan?.title || legacyPlan?.duration || legacyPlan?.notes);
    const dayPlans = Array.isArray(plans[key])
      ? plans[key]
      : (legacyHasContent ? [legacyPlan] : []);
    defaults[key] = dayPlans.map((plan, index) => ({
      id: buildPlanId(plan?.id, 'cardio', key, index),
      title: plan?.title ? plan.title.toString() : '',
      duration: plan?.duration ? plan.duration.toString() : '',
      notes: plan?.notes ? plan.notes.toString() : '',
    }));
  });
  return defaults;
};

const normalizeDayOrder = (order = {}, days = {}, intervalPlans = {}, cardioPlans = {}) => {
  const normalized = {};
  DAY_KEYS.forEach((dayKey) => {
    const dayExercises = Array.isArray(days[dayKey]) ? days[dayKey] : [];
    const exerciseIds = dayExercises.map((exercise) => exercise?.id).filter(Boolean);
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
        if (id && intervalIds.includes(id) && !usedIntervals.has(id)) {
          items.push({ type: 'interval', id });
          usedIntervals.add(id);
        }
        return;
      }
      if (item.type === 'cardio') {
        const id = item.id || cardioIds[0];
        if (id && cardioIds.includes(id) && !usedCardio.has(id)) {
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

    intervalIds.forEach((id) => {
      if (!usedIntervals.has(id)) {
        items.push({ type: 'interval', id });
        usedIntervals.add(id);
      }
    });
    cardioIds.forEach((id) => {
      if (!usedCardio.has(id)) {
        items.push({ type: 'cardio', id });
        usedCardio.add(id);
      }
    });

    normalized[dayKey] = items;
  });
  return normalized;
};

export const computeWeekExerciseSummaries = (days = {}, weightsByDay = {}) => {
  const summaries = {};
  DAY_KEYS.forEach((dayKey) => {
    const exercises = Array.isArray(days[dayKey]) ? days[dayKey] : [];
    const dayWeights = weightsByDay[dayKey]?.exercises || {};
    exercises.forEach((exercise) => {
      const nameKey = (exercise?.name || '').toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const summaryKey = nameKey || exercise.id;
      const entry = dayWeights[exercise.id] || {};
      const setWeights = Array.isArray(entry.setWeights) ? entry.setWeights : [];
      const normalized = setWeights.map((value) => (value ?? '').toString());
      const numericValues = normalized
        .map((value) => parseNumericWeight(value))
        .filter((value) => value !== null);
      if (!summaries[summaryKey]) {
        summaries[summaryKey] = {
          name: exercise.name,
          value: null,
          source: 'max',
          hasNumericData: false,
          setsByDay: {},
        };
      }
      if (normalized.length) {
        const existing = summaries[summaryKey].setsByDay[dayKey] || [];
        summaries[summaryKey].setsByDay[dayKey] = existing.length
          ? [...existing, ...normalized]
          : normalized;
      }
      if (numericValues.length) {
        const maxSet = Math.max(...numericValues);
        summaries[summaryKey].value = summaries[summaryKey].value === null
          ? maxSet
          : Math.max(summaries[summaryKey].value, maxSet);
        summaries[summaryKey].hasNumericData = true;
      }
    });
  });
  return summaries;
};

export const subscribeToPlan = (uid, callback) => {
  if (!uid) return () => {};
  const ref = getPlanRef(uid);
  let bootstrapped = false;
  return onSnapshot(ref, (snapshot) => {
    if (!snapshot.exists()) {
      if (!bootstrapped) {
        bootstrapped = true;
        setDoc(ref, {
          days: createEmptyPlanDays(),
          dayNames: createDefaultDayNames(),
          intervalPlans: createEmptyIntervalPlans(),
          cardioPlans: createEmptyCardioPlans(),
          dayOrder: normalizeDayOrder({}, createEmptyPlanDays(), createEmptyIntervalPlans(), createEmptyCardioPlans()),
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      }
      callback({
        days: createEmptyPlanDays(),
        dayNames: createDefaultDayNames(),
        intervalPlans: createEmptyIntervalPlans(),
        cardioPlans: createEmptyCardioPlans(),
        dayOrder: normalizeDayOrder({}, createEmptyPlanDays(), createEmptyIntervalPlans(), createEmptyCardioPlans()),
        updatedAt: null,
      });
      return;
    }
    bootstrapped = true;
    const data = snapshot.data();
    const normalizedDays = normalizeDays(data.days);
    const normalizedIntervals = normalizeIntervalPlans(data.intervalPlans);
    const normalizedCardio = normalizeCardioPlans(data.cardioPlans);
    callback({
      days: normalizedDays,
      dayNames: normalizeDayNames(data.dayNames),
      intervalPlans: normalizedIntervals,
      cardioPlans: normalizedCardio,
      dayOrder: normalizeDayOrder(data.dayOrder, normalizedDays, normalizedIntervals, normalizedCardio),
      updatedAt: data.updatedAt || null,
    });
  }, (error) => {
    console.error('Workout plan subscription failed', error);
  });
};

export const savePlan = (uid, payload) => {
  const ref = getPlanRef(uid);
  const normalizedDays = normalizeDays(payload.days);
  const normalizedIntervals = normalizeIntervalPlans(payload.intervalPlans);
  const normalizedCardio = normalizeCardioPlans(payload.cardioPlans);
  return setDoc(ref, {
    days: normalizedDays,
    dayNames: normalizeDayNames(payload.dayNames),
    intervalPlans: normalizedIntervals,
    cardioPlans: normalizedCardio,
    dayOrder: normalizeDayOrder(payload.dayOrder, normalizedDays, normalizedIntervals, normalizedCardio),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
};

export const subscribeToWeights = (uid, callback) => {
  if (!uid) return () => {};
  const colRef = getWeightsCollection(uid);
  return onSnapshot(colRef, (snapshot) => {
    const payload = {};
    snapshot.forEach((docSnap) => {
      payload[docSnap.id] = docSnap.data();
    });
    callback(payload);
  }, (error) => {
    console.error('Workout weights subscription failed', error);
  });
};

export const saveWeightsForDay = (uid, dayKey, exercises) => {
  const ref = getWeightRef(uid, dayKey);
  return setDoc(ref, {
    dayKey,
    exercises,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
};

export const subscribeToSettings = (uid, callback) => {
  if (!uid) return () => {};
  const ref = getSettingsRef(uid);
  let bootstrapped = false;
  return onSnapshot(ref, (snapshot) => {
    if (!snapshot.exists()) {
      if (!bootstrapped) {
        bootstrapped = true;
        const defaults = getDefaultSettings();
        setDoc(ref, {
          ...defaults,
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      }
      callback(getDefaultSettings());
      return;
    }
    bootstrapped = true;
    callback(normalizeSettingsPayload(snapshot.data()));
  }, (error) => {
    console.error('Workout settings subscription failed', error);
  });
};

export const updateSettings = (uid, updates) => {
  const ref = getSettingsRef(uid);
  return setDoc(ref, { ...updates, updatedAt: new Date().toISOString() }, { merge: true });
};

export const subscribeToWorkoutHistory = (uid, limitCount = 32, callback) => {
  if (!uid) return () => {};
  const colRef = getHistoryCollection(uid);
  const historyQuery = query(colRef, orderBy('weekId', 'desc'), fsLimit(limitCount));
  return onSnapshot(historyQuery, (snapshot) => {
    const payload = [];
    snapshot.forEach((docSnap) => {
      payload.push(docSnap.data());
    });
    callback(payload);
  }, (error) => {
    console.error('Workout history subscription failed', error);
  });
};

export const upsertWorkoutHistory = (uid, weekId, payload) => {
  if (!uid || !weekId) return Promise.resolve();
  const ref = getHistoryRef(uid, weekId);
  const timestamps = {
    updatedAt: new Date().toISOString(),
  };
  if (!payload.createdAt) {
    timestamps.createdAt = new Date().toISOString();
  }
  return setDoc(ref, {
    weekId,
    weekStartISO: weekId,
    ...payload,
    ...timestamps,
  }, { merge: true });
};


export const subscribeToCompletions = (uid, weekId, callback) => {
  if (!uid || !weekId) return () => {};
  const ref = getCompletionRef(uid, weekId);
  let bootstrapped = false;
  return onSnapshot(ref, (snapshot) => {
    if (!snapshot.exists()) {
      if (!bootstrapped) {
        bootstrapped = true;
        setDoc(ref, {
          weekStartISO: weekId,
          dayData: {},
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      }
      callback({ weekStartISO: weekId, dayData: {} });
      return;
    }
    bootstrapped = true;
    const data = snapshot.data();
    callback({
      weekStartISO: data.weekStartISO || weekId,
      dayData: data.dayData || {},
    });
  }, (error) => {
    console.error('Workout completion subscription failed', error);
  });
};

export const updateCompletion = async (uid, weekId, dayKey, target, data) => {
  const ref = getCompletionRef(uid, weekId);
  const entry = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  let dayPayload = {};
  if (typeof target === 'object' && target !== null) {
    if (target.type === 'interval' && target.id) {
      dayPayload = {
        intervalPlans: {
          [target.id]: entry,
        },
      };
    } else if (target.type === 'cardio' && target.id) {
      dayPayload = {
        cardioPlans: {
          [target.id]: entry,
        },
      };
    }
  } else if (target === 'intervalPlan' || target === 'cardioPlan') {
    dayPayload = {
      [target]: entry,
    };
  } else if (typeof target === 'string') {
    dayPayload = {
      exercises: {
        [target]: entry,
      },
    };
  }
  await setDoc(ref, {
    weekStartISO: weekId,
    updatedAt: new Date().toISOString(),
    dayData: {
      [dayKey]: dayPayload,
    },
  }, { merge: true });
};

export const deleteWorkoutData = async (uid) => {
  if (!uid) return;
  const planRef = getPlanRef(uid);
  const settingsRef = getSettingsRef(uid);
  const weightDocs = await getDocs(getWeightsCollection(uid));
  const completionDocs = await getDocs(getCompletionsCollection(uid));
  const historyDocs = await getDocs(getHistoryCollection(uid));
  const deletions = [
    deleteDoc(planRef).catch(() => {}),
    deleteDoc(settingsRef).catch(() => {}),
  ];
  weightDocs.forEach((docSnap) => {
    deletions.push(deleteDoc(docSnap.ref).catch(() => {}));
  });
  completionDocs.forEach((docSnap) => {
    deletions.push(deleteDoc(docSnap.ref).catch(() => {}));
  });
  historyDocs.forEach((docSnap) => {
    deletions.push(deleteDoc(docSnap.ref).catch(() => {}));
  });
  await Promise.all(deletions);
};

export const exportWorkoutData = async (uid) => {
  if (!uid) return null;
  const [planSnap, settingsSnap, weightDocs, completionDocs, historyDocs] = await Promise.all([
    getDoc(getPlanRef(uid)),
    getDoc(getSettingsRef(uid)),
    getDocs(getWeightsCollection(uid)),
    getDocs(getCompletionsCollection(uid)),
    getDocs(getHistoryCollection(uid)),
  ]);
  const weights = {};
  weightDocs.forEach((docSnap) => {
    weights[docSnap.id] = docSnap.data();
  });
  const completions = {};
  completionDocs.forEach((docSnap) => {
    completions[docSnap.id] = docSnap.data();
  });
  const history = {};
  historyDocs.forEach((docSnap) => {
    history[docSnap.id] = docSnap.data();
  });
  return {
    plan: planSnap.data() || { days: createEmptyPlanDays() },
    settings: settingsSnap.data() || {},
    weights,
    completions,
    history,
    exportedAt: new Date().toISOString(),
  };
};
