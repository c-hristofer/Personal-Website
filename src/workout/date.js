import { DAY_KEYS, TIME_ZONE } from './constants';

const WEEKDAY_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  weekday: 'long',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  month: 'short',
  day: 'numeric',
});

const getParts = (date = new Date()) => {
  const parts = weekdayFormatter.formatToParts(date);
  const container = {};
  parts.forEach(({ type, value }) => {
    container[type] = value;
  });
  const weekday = (container.weekday || 'monday').toLowerCase();
  return {
    weekday,
    year: Number(container.year),
    month: Number(container.month),
    day: Number(container.day),
  };
};

const normalizeDayKey = (weekdayName) => {
  const key = weekdayName.toLowerCase();
  return DAY_KEYS.includes(key) ? key : 'monday';
};

export const getWeekInfo = (date = new Date()) => {
  const { weekday, year, month, day } = getParts(date);
  const dayKey = normalizeDayKey(weekday);
  const weekdayIndex = WEEKDAY_INDEX[weekday] ?? 0;
  const daysSinceMonday = (weekdayIndex + 6) % 7;
  const baseDate = new Date(Date.UTC(year, month - 1, day, 12));
  const weekStartDate = new Date(baseDate);
  weekStartDate.setUTCDate(weekStartDate.getUTCDate() - daysSinceMonday);
  const weekId = weekStartDate.toISOString().split('T')[0];
  return {
    dayKey,
    weekdayIndex,
    weekId,
    weekStartDate,
  };
};

export const getCurrentDayKey = () => getWeekInfo().dayKey;

export const getWeekLabel = (weekInfo = getWeekInfo()) => {
  const start = dateFormatter.format(weekInfo.weekStartDate);
  const endDate = new Date(weekInfo.weekStartDate);
  endDate.setUTCDate(endDate.getUTCDate() + 6);
  const end = dateFormatter.format(endDate);
  return `${start} – ${end}`;
};

export const getWeekIdForDate = (value) => getWeekInfo(value).weekId;

export const getWeekStartDateFromId = (weekId) => {
  if (typeof weekId !== 'string') return null;
  const parts = weekId.split('-').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((num) => Number.isNaN(num))) {
    return null;
  }
  const [year, month, day] = parts;
  const base = new Date(Date.UTC(year, (month || 1) - 1, day || 1, 12));
  if (Number.isNaN(base.getTime())) return null;
  return base;
};

export const getPreviousWeekId = (weekId, offset = 1) => {
  const startDate = getWeekStartDateFromId(weekId);
  if (!startDate || !Number.isFinite(offset) || offset <= 0) return null;
  const next = new Date(startDate);
  next.setUTCDate(next.getUTCDate() - (7 * Math.floor(offset)));
  return next.toISOString().split('T')[0];
};

export const getNextWeekId = (weekId, offset = 1) => {
  const startDate = getWeekStartDateFromId(weekId);
  if (!startDate || !Number.isFinite(offset) || offset <= 0) return null;
  const next = new Date(startDate);
  next.setUTCDate(next.getUTCDate() + (7 * Math.floor(offset)));
  return next.toISOString().split('T')[0];
};

export const getWeekDiff = (anchorWeekId, targetWeekId) => {
  const anchor = getWeekStartDateFromId(anchorWeekId);
  const target = getWeekStartDateFromId(targetWeekId);
  if (!anchor || !target) return 0;
  const diffMs = target.getTime() - anchor.getTime();
  return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
};
