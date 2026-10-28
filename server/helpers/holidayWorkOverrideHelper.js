/**
 * Holiday still blocks attendance/payroll when active and not converted to a working day.
 */
export function isHolidayBlockingWork(holiday) {
  if (!holiday || holiday.isActive === false) return false;
  const mode = holiday.workModeOverride;
  if (mode === 'office' || mode === 'home') return false;
  return true;
}

export function holidayWorkModeLabel(holiday) {
  if (!holiday) return '';
  if (holiday.workModeOverride === 'office') return 'Working (Office)';
  if (holiday.workModeOverride === 'home') return 'Working (Home)';
  return '';
}
