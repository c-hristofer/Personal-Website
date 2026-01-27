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
  DAY_KEYS.forEach((key) => {
    base[key] = Array.isArray(days[key]) ? days[key] : [];
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

const normalizeIntervalPlans = (plans = {}) => {
  const defaults = createEmptyIntervalPlans();
  DAY_KEYS.forEach((key) => {
    const plan = plans[key] || {};
    const segments = Array.isArray(plan.segments)
      ? plan.segments.map((segment) => ({
          label: segment?.label ? segment.label.toString() : '',
          duration: segment?.duration ? segment.duration.toString() : '',
        }))
      : [];
    defaults[key] = {
      title: plan.title ? plan.title.toString() : '',
      segments,
    };
  });
  return defaults;
};

const normalizeCardioPlans = (plans = {}) => {
  const defaults = createEmptyCardioPlans();
  DAY_KEYS.forEach((key) => {
    const plan = plans[key] || {};
    defaults[key] = {
      title: plan.title ? plan.title.toString() : '',
      duration: plan.duration ? plan.duration.toString() : '',
      notes: plan.notes ? plan.notes.toString() : '',
    };
  });
  return defaults;
};

export const computeWeekExerciseSummaries = (days = {}, weightsByDay = {}) => {
  const summaries = {};
  DAY_KEYS.forEach((dayKey) => {
    const exercises = Array.isArray(days[dayKey]) ? days[dayKey] : [];
    const dayWeights = weightsByDay[dayKey]?.exercises || {};
    exercises.forEach((exercise) => {
      const entry = dayWeights[exercise.id] || {};
      const setWeights = Array.isArray(entry.setWeights) ? entry.setWeights : [];
      const normalized = setWeights.map((value) => (value ?? '').toString());
      const numericValues = normalized
        .map((value) => parseNumericWeight(value))
        .filter((value) => value !== null);
      if (!summaries[exercise.id]) {
        summaries[exercise.id] = {
          name: exercise.name,
          value: null,
          source: 'max',
          hasNumericData: false,
          setsByDay: {},
        };
      }
      if (normalized.length) {
        summaries[exercise.id].setsByDay[dayKey] = normalized;
      }
      if (numericValues.length) {
        const maxSet = Math.max(...numericValues);
        summaries[exercise.id].value = summaries[exercise.id].value === null
          ? maxSet
          : Math.max(summaries[exercise.id].value, maxSet);
        summaries[exercise.id].hasNumericData = true;
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
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      }
      callback({
        days: createEmptyPlanDays(),
        dayNames: createDefaultDayNames(),
        intervalPlans: createEmptyIntervalPlans(),
        cardioPlans: createEmptyCardioPlans(),
        updatedAt: null,
      });
      return;
    }
    bootstrapped = true;
    const data = snapshot.data();
    callback({
      days: normalizeDays(data.days),
      dayNames: normalizeDayNames(data.dayNames),
      intervalPlans: normalizeIntervalPlans(data.intervalPlans),
      cardioPlans: normalizeCardioPlans(data.cardioPlans),
      updatedAt: data.updatedAt || null,
    });
  }, (error) => {
    console.error('Workout plan subscription failed', error);
  });
};

export const savePlan = (uid, payload) => {
  const ref = getPlanRef(uid);
  return setDoc(ref, {
    days: normalizeDays(payload.days),
    dayNames: normalizeDayNames(payload.dayNames),
    intervalPlans: normalizeIntervalPlans(payload.intervalPlans),
    cardioPlans: normalizeCardioPlans(payload.cardioPlans),
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

export const updateCompletion = async (uid, weekId, dayKey, exerciseId, data) => {
  const ref = getCompletionRef(uid, weekId);
  const entry = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  const payload = (exerciseId === 'intervalPlan' || exerciseId === 'cardioPlan')
    ? {
        weekStartISO: weekId,
        updatedAt: new Date().toISOString(),
        dayData: {
          [dayKey]: {
            [exerciseId]: entry,
          },
        },
      }
    : {
        weekStartISO: weekId,
        updatedAt: new Date().toISOString(),
        dayData: {
          [dayKey]: {
            exercises: {
              [exerciseId]: entry,
            },
          },
        },
      };
  await setDoc(ref, {
    ...payload,
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
