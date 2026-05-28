export const formatDate = (value, options = { year: 'numeric', month: 'short', day: 'numeric' }) => {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString(undefined, options);
};

export const formatDateTime = (value) => {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString();
};

export const calculateAge = (birthDate) => {
  if (!birthDate) return 'N/A';
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return 'N/A';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? `${age} Years` : 'N/A';
};

export const calculateYearsOfExperience = (joiningDate) => {
  if (!joiningDate) return '0';
  const joining = new Date(joiningDate);
  const diffDays = Math.ceil(Math.abs(new Date() - joining) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 365).toString();
};

export const getAttendanceRate = (employee) => {
  if (employee?.attendanceRate != null) return employee.attendanceRate;
  return 'N/A';
};

export const getFullName = (employee) =>
  [employee?.name, employee?.lastName].filter(Boolean).join(' ') || 'Employee';

export const getStatusLabel = (employee) => {
  if (employee?.status === 'terminated') return 'Terminated';
  return employee?.active ? 'Active' : 'Inactive';
};

export const formatSalary = (salary) => {
  if (salary === undefined || salary === null) return 'N/A';
  return `₹${Number(salary).toLocaleString('en-IN')}`;
};

export const getEmergencyContactSummary = (employee) => {
  const primary = employee?.emergencyContacts?.find((c) => c.priority === 'Primary')
    || employee?.emergencyContacts?.[0];
  if (primary) {
    const name = primary.name || 'N/A';
    const rel = primary.relationship ? ` (${primary.relationship})` : '';
    const phone = primary.phone ? ` — ${primary.phone}` : '';
    return `${name}${rel}${phone}`;
  }
  const kin = employee?.nextOfKins?.[0];
  if (kin) {
    return `${kin.name || 'N/A'}${kin.relationship ? ` (${kin.relationship})` : ''}${kin.phone ? ` — ${kin.phone}` : ''}`;
  }
  return 'N/A';
};
