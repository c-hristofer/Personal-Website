import { getWeekDiff } from './date';

export const normalizeSegments = (segments = []) =>
  Array.isArray(segments)
    ? segments.map((segment) => {
        const duration = typeof segment?.duration === 'string'
          ? segment.duration
          : '';
        let minutes = segment?.minutes ?? '';
        let seconds = segment?.seconds ?? '';
        if (!minutes && !seconds && duration) {
          const parts = duration.split(':');
          if (parts.length === 2) {
            minutes = parts[0];
            seconds = parts[1];
          }
        }
        return {
          label: segment?.label || '',
          duration,
          minutes,
          seconds,
        };
      })
    : [];

const clampNumber = (value, min, max, fallback) => {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return Math.min(max, Math.max(min, numeric));
  }
  return fallback;
};

export const normalizeDeloadConfig = (settings = {}) => {
  const source = (settings && typeof settings === 'object') ? settings : {};
  const percent = clampNumber(source.deloadPercent, 1, 90, 15);
  const frequency = clampNumber(source.deloadFrequencyWeeks, 2, 12, 4);
  return {
    deloadEnabled: Boolean(source.deloadEnabled),
    deloadPercent: percent,
    deloadFrequencyWeeks: frequency,
    deloadAnchorWeekId: source.deloadAnchorWeekId || null,
  };
};

export const computeDeloadState = (settings = {}, currentWeekId) => {
  const config = normalizeDeloadConfig(settings);
  if (!config.deloadEnabled || !config.deloadAnchorWeekId || !currentWeekId) {
    return { ...config, isDeloadWeek: false };
  }
  const diff = getWeekDiff(config.deloadAnchorWeekId, currentWeekId);
  const isDeloadWeek = diff >= 0 && diff % config.deloadFrequencyWeeks === 0;
  return { ...config, isDeloadWeek };
};

export const parseNumericWeight = (value) => {
  if (value === undefined || value === null) return null;
  const raw = value.toString().trim();
  if (!raw) return null;
  const num = Number(raw);
  if (Number.isFinite(num)) {
    return num;
  }
  return null;
};

export const isNumericWeight = (value) => parseNumericWeight(value) !== null;

export const formatWeightValue = (value) => {
  if (!Number.isFinite(value)) return '';
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) {
    return rounded.toString();
  }
  return rounded.toFixed(2).replace(/(?:\.0+|0+)$/, '').replace(/\.$/, '');
};

export const applyDeloadToValue = (value, percent) => {
  if (!Number.isFinite(value)) return null;
  const clampedPercent = clampNumber(percent, 1, 90, 15);
  const multiplier = 1 - (clampedPercent / 100);
  return value * multiplier;
};

export const reverseDeloadValue = (value, percent) => {
  if (!Number.isFinite(value)) return null;
  const clampedPercent = clampNumber(percent, 1, 90, 15);
  const multiplier = 1 - (clampedPercent / 100);
  if (multiplier <= 0) return null;
  return value / multiplier;
};

export const convertUnitValue = (value, fromUnit = 'lbs', toUnit = 'lbs') => {
  if (!Number.isFinite(value) || fromUnit === toUnit) return value;
  if (fromUnit === 'lbs' && toUnit === 'kg') {
    return value / 2.20462;
  }
  if (fromUnit === 'kg' && toUnit === 'lbs') {
    return value * 2.20462;
  }
  return value;
};
