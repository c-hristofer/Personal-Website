export const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const DAY_LABELS = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export const DAY_SHORT_LABELS = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

export const TIME_ZONE = 'America/New_York';

export const UNIT_OPTIONS = [
  { value: 'lbs', label: 'Pounds (lbs)' },
  { value: 'kg', label: 'Kilograms (kg)' },
];

export const createEmptyPlanDays = () => DAY_KEYS.reduce((acc, key) => {
  acc[key] = [];
  return acc;
}, {});

export const createDefaultDayNames = () => DAY_KEYS.reduce((acc, key) => {
  acc[key] = DAY_LABELS[key];
  return acc;
}, {});

export const createEmptyIntervalPlans = () => DAY_KEYS.reduce((acc, key) => {
  acc[key] = { title: '', segments: [] };
  return acc;
}, {});

export const createEmptyCardioPlans = () => DAY_KEYS.reduce((acc, key) => {
  acc[key] = { title: '', duration: '', notes: '' };
  return acc;
}, {});
