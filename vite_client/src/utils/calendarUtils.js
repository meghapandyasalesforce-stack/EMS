export const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
];

export const getDayName = (year, month, day) => {
  const dayOfWeek = new Date(year, month - 1, day).getDay();
  return DAY_NAMES[dayOfWeek];
};

export const isNonWorkingDay = (workingDays, year, month, day) => {
  if (!day || !workingDays) return false;
  const dayName = getDayName(year, month, day);
  return !workingDays[dayName];
};
