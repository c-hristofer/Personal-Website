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

export const COMMON_WEIGHTLIFTING_EXERCISES = [
  'Back Squat',
  'Front Squat',
  'Goblet Squat',
  'Box Squat',
  'Hack Squat',
  'Smith Machine Squat',
  'Bulgarian Split Squat',
  'Split Squat',
  'Walking Lunge',
  'Reverse Lunge',
  'Step-Up',
  'Leg Press',
  'Leg Extension',
  'Lying Leg Curl',
  'Seated Leg Curl',
  'Standing Leg Curl',
  'Romanian Deadlift',
  'Stiff-Leg Deadlift',
  'Conventional Deadlift',
  'Sumo Deadlift',
  'Trap Bar Deadlift',
  'Good Morning',
  'Hip Thrust',
  'Glute Bridge',
  'Cable Pull-Through',
  'Standing Calf Raise',
  'Seated Calf Raise',
  'Bench Press',
  'Incline Bench Press',
  'Decline Bench Press',
  'Close-Grip Bench Press',
  'Dumbbell Bench Press',
  'Incline Dumbbell Bench Press',
  'Dumbbell Fly',
  'Cable Fly',
  'Machine Chest Press',
  'Push-Up',
  'Dip',
  'Chest Dip',
  'Overhead Press',
  'Seated Overhead Press',
  'Dumbbell Shoulder Press',
  'Arnold Press',
  'Machine Shoulder Press',
  'Lateral Raise',
  'Cable Lateral Raise',
  'Front Raise',
  'Rear Delt Fly',
  'Face Pull',
  'Upright Row',
  'Shrug',
  'Pull-Up',
  'Chin-Up',
  'Lat Pulldown',
  'Close-Grip Lat Pulldown',
  'Seated Cable Row',
  'Barbell Row',
  'Pendlay Row',
  'Dumbbell Row',
  'Chest-Supported Row',
  'Machine Row',
  'T-Bar Row',
  'Inverted Row',
  'Straight-Arm Pulldown',
  'Back Extension',
  'Barbell Curl',
  'Dumbbell Curl',
  'Hammer Curl',
  'Incline Dumbbell Curl',
  'Preacher Curl',
  'Cable Curl',
  'Concentration Curl',
  'EZ-Bar Curl',
  'Reverse Curl',
  'Triceps Pushdown',
  'Rope Triceps Pushdown',
  'Overhead Triceps Extension',
  'Skull Crusher',
  'Close-Grip Push-Up',
  'Triceps Dip',
  'Cable Crunch',
  'Weighted Crunch',
  'Hanging Leg Raise',
  'Captain Chair Leg Raise',
  'Ab Wheel Rollout',
  'Russian Twist',
  'Plank',
  'Side Plank',
  'Pallof Press',
  'Wood Chop',
  'Farmer Carry',
  'Suitcase Carry',
  'Clean',
  'Power Clean',
  'Hang Clean',
  'Clean and Press',
  'Snatch',
  'Power Snatch',
  'Kettlebell Swing',
  'Thruster',
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
  acc[key] = [];
  return acc;
}, {});

export const createEmptyCardioPlans = () => DAY_KEYS.reduce((acc, key) => {
  acc[key] = [];
  return acc;
}, {});
