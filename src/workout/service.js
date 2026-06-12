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
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  COMMON_WEIGHTLIFTING_EXERCISES,
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
const getExerciseLibraryCollection = (uid) => collection(db, 'users', uid, 'workoutExercises');
const getExerciseLibraryRef = (uid, exerciseId) => doc(db, 'users', uid, 'workoutExercises', exerciseId);

export const normalizeExerciseName = (name = '') =>
  name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const buildExerciseId = (name = '') => {
  const normalized = normalizeExerciseName(name);
  const slug = normalized.replace(/\s+/g, '-');
  return slug || `exercise-${Date.now()}`;
};

const normalizeExerciseLibraryDoc = (docId, data = {}) => {
  const name = (data.name || '').toString().trim();
  const normalizedName = normalizeExerciseName(data.normalizedName || name);
  return {
    id: docId,
    name,
    normalizedName,
    category: data.category || '',
    aliases: Array.isArray(data.aliases) ? data.aliases : [],
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
};

const getExerciseNameFromLibrary = (exercise, exerciseMap = {}) => {
  const libraryExercise = exercise?.exerciseId ? exerciseMap[exercise.exerciseId] : null;
  return libraryExercise?.name || exercise?.name || 'Exercise';
};

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
  exerciseLibraryMigratedAt: null,
  historyResetForExerciseLibraryAt: null,
  restTimerEnabled: false,
  restTimerSeconds: 90,
  historyInsightsEnabled: true,
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
    exerciseLibraryMigratedAt: data.exerciseLibraryMigratedAt || null,
    historyResetForExerciseLibraryAt: data.historyResetForExerciseLibraryAt || null,
    restTimerEnabled: Boolean(data.restTimerEnabled),
    restTimerSeconds: Number.isFinite(Number(data.restTimerSeconds))
      ? Math.min(600, Math.max(15, Number(data.restTimerSeconds)))
      : defaults.restTimerSeconds,
    historyInsightsEnabled: data.historyInsightsEnabled === undefined
      ? defaults.historyInsightsEnabled
      : Boolean(data.historyInsightsEnabled),
  };
};

const normalizeDays = (days = {}) => {
  const base = createEmptyPlanDays();
  if (Array.isArray(days)) {
    DAY_KEYS.forEach((key, index) => {
      base[key] = Array.isArray(days[index]) ? days[index].map(normalizePlanExercise) : [];
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
      base[normalizedKey] = Array.isArray(days[rawKey])
        ? days[rawKey].map(normalizePlanExercise)
        : [];
    }
  });
  DAY_KEYS.forEach((key) => {
    if (!Array.isArray(base[key])) {
      base[key] = [];
    }
  });
  return base;
};

const normalizePlanExercise = (exercise = {}) => ({
  ...exercise,
  id: exercise.id ? exercise.id.toString() : '',
  exerciseId: exercise.exerciseId ? exercise.exerciseId.toString() : '',
  name: exercise.name ? exercise.name.toString() : '',
  superset: Boolean(exercise.superset),
});

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

export const computeWeekExerciseSummaries = (
  days = {},
  weightsByDay = {},
  exerciseMap = {},
  completionDayData = {},
  options = {},
) => {
  const summaries = {};
  const completedOnly = Boolean(options.completedOnly);
  DAY_KEYS.forEach((dayKey) => {
    const exercises = Array.isArray(days[dayKey]) ? days[dayKey] : [];
    const dayWeights = weightsByDay[dayKey]?.exercises || {};
    const dayCompletions = completionDayData?.[dayKey]?.exercises || {};
    exercises.forEach((exercise) => {
      if (completedOnly && !dayCompletions[exercise.id]?.completed) {
        return;
      }
      const exerciseName = getExerciseNameFromLibrary(exercise, exerciseMap);
      const nameKey = buildExerciseId(exerciseName);
      const summaryKey = exercise.exerciseId || nameKey || exercise.id;
      const entry = dayWeights[exercise.id] || {};
      if (entry.exerciseId && exercise.exerciseId && entry.exerciseId !== exercise.exerciseId) {
        return;
      }
      const setWeights = Array.isArray(entry.setWeights) ? entry.setWeights : [];
      const normalized = setWeights.map((value) => (value ?? '').toString());
      const numericValues = normalized
        .map((value) => parseNumericWeight(value))
        .filter((value) => value !== null);
      if (!summaries[summaryKey]) {
        summaries[summaryKey] = {
          exerciseId: summaryKey,
          name: exerciseName,
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

export const subscribeToExerciseLibrary = (uid, callback) => {
  if (!uid) return () => {};
  const colRef = getExerciseLibraryCollection(uid);
  const exerciseQuery = query(colRef, orderBy('name'));
  return onSnapshot(exerciseQuery, (snapshot) => {
    const payload = [];
    snapshot.forEach((docSnap) => {
      const exercise = normalizeExerciseLibraryDoc(docSnap.id, docSnap.data());
      if (exercise.name) {
        payload.push(exercise);
      }
    });
    callback(payload);
  }, (error) => {
    console.error('Workout exercise library subscription failed', error);
  });
};

export const upsertExerciseLibraryItem = async (uid, rawName) => {
  if (!uid) return null;
  const name = (rawName || '').toString().trim();
  const normalizedName = normalizeExerciseName(name);
  if (!normalizedName) return null;
  const id = buildExerciseId(name);
  const ref = getExerciseLibraryRef(uid, id);
  const existing = await getDoc(ref);
  const now = new Date().toISOString();
  const payload = {
    name,
    normalizedName,
    updatedAt: now,
  };
  if (!existing.exists()) {
    payload.createdAt = now;
  }
  await setDoc(ref, payload, { merge: true });
  return { id, name, normalizedName };
};

export const renameExerciseLibraryItem = async (uid, exerciseId, rawName) => {
  if (!uid || !exerciseId) return null;
  const name = (rawName || '').toString().trim();
  const normalizedName = normalizeExerciseName(name);
  if (!normalizedName) return null;
  const now = new Date().toISOString();
  const batch = writeBatch(db);
  const exerciseDocs = await getDocs(getExerciseLibraryCollection(uid));
  let targetExercise = null;
  exerciseDocs.forEach((docSnap) => {
    const exercise = normalizeExerciseLibraryDoc(docSnap.id, docSnap.data());
    if (exercise.normalizedName === normalizedName && exercise.id !== exerciseId) {
      targetExercise = exercise;
    }
  });
  const nextExerciseId = targetExercise?.id || exerciseId;
  const nextName = targetExercise?.name || name;
  if (targetExercise) {
    batch.delete(getExerciseLibraryRef(uid, exerciseId));
  } else {
    batch.set(getExerciseLibraryRef(uid, exerciseId), {
      name,
      normalizedName,
      updatedAt: now,
    }, { merge: true });
  }

  const planSnap = await getDoc(getPlanRef(uid));
  if (planSnap.exists()) {
    const rawPlan = planSnap.data();
    const normalizedDays = normalizeDays(rawPlan.days);
    const nextDays = createEmptyPlanDays();
    let changed = false;
    DAY_KEYS.forEach((dayKey) => {
      nextDays[dayKey] = (normalizedDays[dayKey] || []).map((exercise) => {
        if (exercise.exerciseId !== exerciseId) return exercise;
        changed = true;
        return { ...exercise, exerciseId: nextExerciseId, name: nextName };
      });
    });
    if (changed) {
      const normalizedIntervals = normalizeIntervalPlans(rawPlan.intervalPlans);
      const normalizedCardio = normalizeCardioPlans(rawPlan.cardioPlans);
      batch.set(getPlanRef(uid), {
        days: nextDays,
        dayNames: normalizeDayNames(rawPlan.dayNames),
        intervalPlans: normalizedIntervals,
        cardioPlans: normalizedCardio,
        dayOrder: normalizeDayOrder(rawPlan.dayOrder, nextDays, normalizedIntervals, normalizedCardio),
        updatedAt: now,
      }, { merge: true });
      const weightDocs = await getDocs(getWeightsCollection(uid));
      weightDocs.forEach((docSnap) => {
        const dayKey = docSnap.id;
        const weightDoc = docSnap.data();
        const exercisesBySlot = new Map(
          (nextDays[dayKey] || []).map((exercise) => [exercise.id, exercise]),
        );
        const nextWeights = {};
        Object.keys(weightDoc.exercises || {}).forEach((slotId) => {
          const weightEntry = weightDoc.exercises[slotId] || {};
          const planExercise = exercisesBySlot.get(slotId);
          nextWeights[slotId] = {
            ...weightEntry,
            exerciseId: planExercise?.exerciseId || weightEntry.exerciseId || '',
          };
        });
        batch.set(getWeightRef(uid, dayKey), {
          ...weightDoc,
          dayKey,
          exercises: nextWeights,
          updatedAt: now,
        }, { merge: true });
      });
    }
  }

  await batch.commit();
  return {
    id: nextExerciseId,
    name: nextName,
    normalizedName: targetExercise?.normalizedName || normalizedName,
  };
};

export const deleteExerciseLibraryItem = async (uid, exerciseId) => {
  if (!uid || !exerciseId) return;
  await deleteDoc(getExerciseLibraryRef(uid, exerciseId));
};

export const deleteWorkoutHistory = async (uid) => {
  if (!uid) return;
  const historyDocs = await getDocs(getHistoryCollection(uid));
  const deletions = [];
  historyDocs.forEach((docSnap) => {
    deletions.push(deleteDoc(docSnap.ref).catch(() => {}));
  });
  await Promise.all(deletions);
};

const collectPlanExerciseNames = (days = {}) => {
  const names = [];
  DAY_KEYS.forEach((dayKey) => {
    const exercises = Array.isArray(days[dayKey]) ? days[dayKey] : [];
    exercises.forEach((exercise) => {
      const name = (exercise?.name || '').toString().trim();
      if (name) names.push(name);
    });
  });
  return names;
};

const buildCanonicalExerciseLibrary = (existingExercises = [], planNames = []) => {
  const byNormalizedName = new Map();
  const duplicates = [];
  const addCandidate = (candidate, source) => {
    const name = (candidate?.name || candidate || '').toString().trim();
    const normalizedName = normalizeExerciseName(candidate?.normalizedName || name);
    if (!normalizedName) return;
    const preferredId = buildExerciseId(name);
    const id = candidate?.id || preferredId;
    const current = byNormalizedName.get(normalizedName);
    const next = {
      id: current?.id || preferredId,
      name: current?.name || name,
      normalizedName,
      aliases: Array.isArray(candidate?.aliases) ? candidate.aliases : [],
      category: candidate?.category || '',
      source,
      existingIds: candidate?.id ? [candidate.id] : [],
      createdAt: candidate?.createdAt || null,
    };
    if (!current) {
      byNormalizedName.set(normalizedName, next);
      return;
    }
    if (candidate?.id) {
      current.existingIds.push(candidate.id);
      if (candidate.id !== current.id) {
        duplicates.push(candidate.id);
      }
    }
    if (id === preferredId && current.id !== preferredId) {
      duplicates.push(current.id);
      current.id = preferredId;
      current.name = name;
    }
  };

  COMMON_WEIGHTLIFTING_EXERCISES.forEach((name) => addCandidate(name, 'seed'));
  planNames.forEach((name) => addCandidate(name, 'plan'));
  existingExercises.forEach((exercise) => addCandidate(exercise, 'existing'));

  return {
    exercises: Array.from(byNormalizedName.values()),
    duplicateIds: Array.from(new Set(duplicates.filter(Boolean))),
  };
};

const attachExerciseIdsToDays = (days = {}, canonicalExercises = []) => {
  const byNormalizedName = new Map(
    canonicalExercises.map((exercise) => [exercise.normalizedName, exercise]),
  );
  const byId = new Map(canonicalExercises.map((exercise) => [exercise.id, exercise]));
  const nextDays = createEmptyPlanDays();
  DAY_KEYS.forEach((dayKey) => {
    nextDays[dayKey] = (days[dayKey] || []).map((exercise) => {
      const existing = exercise.exerciseId ? byId.get(exercise.exerciseId) : null;
      const byName = byNormalizedName.get(normalizeExerciseName(exercise.name));
      const libraryExercise = existing || byName;
      return {
        ...exercise,
        exerciseId: libraryExercise?.id || exercise.exerciseId || buildExerciseId(exercise.name),
        name: libraryExercise?.name || (exercise.name || '').toString().trim(),
      };
    });
  });
  return nextDays;
};

const attachExerciseIdsToWeights = (weightsByDay = {}, days = {}) => {
  const nextWeightsByDay = {};
  DAY_KEYS.forEach((dayKey) => {
    const weightDoc = weightsByDay[dayKey];
    if (!weightDoc?.exercises) return;
    const exercisesBySlot = new Map(
      (days[dayKey] || []).map((exercise) => [exercise.id, exercise]),
    );
    const nextExercises = {};
    Object.keys(weightDoc.exercises || {}).forEach((slotId) => {
      const weightEntry = weightDoc.exercises[slotId] || {};
      const planExercise = exercisesBySlot.get(slotId);
      nextExercises[slotId] = {
        ...weightEntry,
        exerciseId: weightEntry.exerciseId || planExercise?.exerciseId || '',
      };
    });
    nextWeightsByDay[dayKey] = {
      ...weightDoc,
      exercises: nextExercises,
    };
  });
  return nextWeightsByDay;
};

export const ensureExerciseLibraryMigration = async (uid, previousWeekId = null) => {
  if (!uid) return;
  const settingsSnap = await getDoc(getSettingsRef(uid));
  const settings = settingsSnap.exists() ? settingsSnap.data() : {};
  if (settings.exerciseLibraryMigratedAt && settings.historyResetForExerciseLibraryAt) {
    return;
  }

  const [planSnap, exerciseDocs, weightDocs] = await Promise.all([
    getDoc(getPlanRef(uid)),
    getDocs(getExerciseLibraryCollection(uid)),
    getDocs(getWeightsCollection(uid)),
  ]);
  const rawPlan = planSnap.exists() ? planSnap.data() : {};
  const normalizedDays = normalizeDays(rawPlan.days);
  const normalizedIntervals = normalizeIntervalPlans(rawPlan.intervalPlans);
  const normalizedCardio = normalizeCardioPlans(rawPlan.cardioPlans);
  const existingExercises = [];
  exerciseDocs.forEach((docSnap) => {
    existingExercises.push(normalizeExerciseLibraryDoc(docSnap.id, docSnap.data()));
  });
  const weightsByDay = {};
  weightDocs.forEach((docSnap) => {
    weightsByDay[docSnap.id] = docSnap.data();
  });

  const { exercises, duplicateIds } = buildCanonicalExerciseLibrary(
    existingExercises,
    collectPlanExerciseNames(normalizedDays),
  );
  const daysWithExerciseIds = attachExerciseIdsToDays(normalizedDays, exercises);
  const weightsWithExerciseIds = attachExerciseIdsToWeights(weightsByDay, daysWithExerciseIds);
  const now = new Date().toISOString();
  const batch = writeBatch(db);

  exercises.forEach((exercise) => {
    batch.set(getExerciseLibraryRef(uid, exercise.id), {
      name: exercise.name,
      normalizedName: exercise.normalizedName,
      aliases: exercise.aliases || [],
      category: exercise.category || '',
      createdAt: exercise.createdAt || now,
      updatedAt: now,
    }, { merge: true });
  });
  duplicateIds.forEach((exerciseId) => {
    if (!exercises.some((exercise) => exercise.id === exerciseId)) {
      batch.delete(getExerciseLibraryRef(uid, exerciseId));
    }
  });
  batch.set(getPlanRef(uid), {
    days: daysWithExerciseIds,
    dayNames: normalizeDayNames(rawPlan.dayNames),
    intervalPlans: normalizedIntervals,
    cardioPlans: normalizedCardio,
    dayOrder: normalizeDayOrder(rawPlan.dayOrder, daysWithExerciseIds, normalizedIntervals, normalizedCardio),
    updatedAt: now,
  }, { merge: true });
  Object.keys(weightsWithExerciseIds).forEach((dayKey) => {
    batch.set(getWeightRef(uid, dayKey), {
      ...weightsWithExerciseIds[dayKey],
      dayKey,
      updatedAt: now,
    }, { merge: true });
  });
  batch.set(getSettingsRef(uid), {
    exerciseLibraryMigratedAt: settings.exerciseLibraryMigratedAt || now,
    lastArchivedWeekId: previousWeekId || settings.lastArchivedWeekId || null,
    lastArchivedAt: previousWeekId ? now : (settings.lastArchivedAt || null),
    updatedAt: now,
  }, { merge: true });

  await batch.commit();
  if (!settings.historyResetForExerciseLibraryAt) {
    await deleteWorkoutHistory(uid);
    await setDoc(getSettingsRef(uid), {
      historyResetForExerciseLibraryAt: now,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }
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

export const getWorkoutCompletions = async (uid, weekId) => {
  if (!uid || !weekId) return { weekStartISO: weekId, dayData: {} };
  const snapshot = await getDoc(getCompletionRef(uid, weekId));
  if (!snapshot.exists()) {
    return { weekStartISO: weekId, dayData: {} };
  }
  const data = snapshot.data();
  return {
    weekStartISO: data.weekStartISO || weekId,
    dayData: data.dayData || {},
  };
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
  const exerciseDocs = await getDocs(getExerciseLibraryCollection(uid));
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
  exerciseDocs.forEach((docSnap) => {
    deletions.push(deleteDoc(docSnap.ref).catch(() => {}));
  });
  await Promise.all(deletions);
};

export const exportWorkoutData = async (uid) => {
  if (!uid) return null;
  const [planSnap, settingsSnap, weightDocs, completionDocs, historyDocs, exerciseDocs] = await Promise.all([
    getDoc(getPlanRef(uid)),
    getDoc(getSettingsRef(uid)),
    getDocs(getWeightsCollection(uid)),
    getDocs(getCompletionsCollection(uid)),
    getDocs(getHistoryCollection(uid)),
    getDocs(getExerciseLibraryCollection(uid)),
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
  const exercises = {};
  exerciseDocs.forEach((docSnap) => {
    exercises[docSnap.id] = docSnap.data();
  });
  return {
    plan: planSnap.data() || { days: createEmptyPlanDays() },
    settings: settingsSnap.data() || {},
    exercises,
    weights,
    completions,
    history,
    exportedAt: new Date().toISOString(),
  };
};
