import {
  formatPersonName,
  formatStatusLabel,
  toSentenceCase,
} from '../../../utils/textFormat.js';

/** Display-safe sentence case; leaves codes / IDs unchanged. */
const displayText = (value) => {
  if (value == null || value === '') return value;
  const text = String(value).trim();
  if (!text) return text;
  // Preserve employee codes like PRS011 / EMP-12 (mixed letters + digits)
  if (/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9._/-]+$/.test(text)) return text;
  return toSentenceCase(text);
};

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
  if (employee?.status === 'terminated') return formatStatusLabel('terminated');
  return employee?.active ? formatStatusLabel('active') : formatStatusLabel('inactive');
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

/** Auto-compose About / Executive Summary from existing employee fields (no manual entry). */
export const buildAutoExecutiveSummary = (employee, managerPreview = null) => {
  const model = buildExecutiveSummaryModel(employee, managerPreview);
  return model.paragraph;
};

/** Structured summary for richer UI (facts strip + short paragraph). */
export const buildExecutiveSummaryModel = (employee, managerPreview = null) => {
  if (!employee) return { paragraph: '', facts: [] };

  const name = formatPersonName(getFullName(employee));
  const rawRole = employee.jobTitle || employee.position || null;
  const role = rawRole ? displayText(rawRole) : null;
  const department = employee.department ? displayText(employee.department) : null;
  const location = displayText(
    employee.workLocation || employee.location || employee.city || null
  );
  const employmentType = displayText(
    employee.employmentType || employee.employeeType || employee.workType || null
  );
  const statusLabel = getStatusLabel(employee);
  const joined = employee.joiningDate ? formatDate(employee.joiningDate) : null;
  const years = calculateYearsOfExperience(employee.joiningDate);
  const hasTenure = Boolean(joined && years !== '0');

  const rawManager = managerPreview
    ? getFullName(managerPreview)
    : typeof employee.manager === 'string'
      ? employee.manager
      : employee.manager?.name
        ? getFullName(employee.manager)
        : null;
  const managerName = rawManager ? formatPersonName(rawManager) : null;

  const empCode = employee.employeeId || employee.empId || null;
  const position =
    employee.position && employee.position !== rawRole
      ? displayText(employee.position)
      : null;

  const sentences = [];

  if (role && department) {
    sentences.push(
      `${name} is a ${role} in the ${department} organization${position ? ` (${position})` : ''}.`
    );
  } else if (role) {
    sentences.push(`${name} works as ${role}${position ? ` (${position})` : ''}.`);
  } else if (department) {
    sentences.push(`${name} is part of the ${department} team.`);
  } else {
    sentences.push(`${name} is a member of the organization.`);
  }

  const tenureBits = [];
  if (hasTenure) tenureBits.push(`${years}+ years of service since ${joined}`);
  else if (joined) tenureBits.push(`joined on ${joined}`);
  if (employmentType) tenureBits.push(`${employmentType} employment`);
  if (statusLabel && statusLabel !== 'N/A' && statusLabel !== '—') {
    tenureBits.push(`currently ${statusLabel}`);
  }
  if (tenureBits.length) {
    sentences.push(
      tenureBits.length === 1
        ? `${tenureBits[0][0].toUpperCase()}${tenureBits[0].slice(1)}.`
        : `${tenureBits[0][0].toUpperCase()}${tenureBits[0].slice(1)}, with ${tenureBits
            .slice(1)
            .join(' and ')}.`
    );
  }

  const placeBits = [];
  if (location) placeBits.push(`based in ${location}`);
  if (managerName) placeBits.push(`reports to ${managerName}`);
  if (empCode) placeBits.push(`employee ID ${empCode}`);
  if (placeBits.length) {
    sentences.push(
      placeBits.length === 1
        ? `${placeBits[0][0].toUpperCase()}${placeBits[0].slice(1)}.`
        : `${placeBits[0][0].toUpperCase()}${placeBits[0].slice(1)}${
            placeBits.length === 2
              ? ` and ${placeBits[1]}`
              : `, ${placeBits.slice(1, -1).join(', ')}, and ${placeBits[placeBits.length - 1]}`
          }.`
    );
  }

  const paragraph = sentences.join(' ');

  const facts = [
    role ? { label: 'Role', value: role } : null,
    department ? { label: 'Department', value: department } : null,
    employmentType ? { label: 'Employment', value: employmentType } : null,
    statusLabel && statusLabel !== 'N/A' && statusLabel !== '—'
      ? { label: 'Status', value: statusLabel }
      : null,
    managerName ? { label: 'Manager', value: managerName } : null,
    location ? { label: 'Location', value: location } : null,
  ].filter(Boolean);

  return { paragraph, facts };
};

/** Shared display helpers for About boxes / chips (all employees). */
export const formatAboutFieldValue = (label, value) => {
  if (value == null || value === '') return value;
  if (label === 'Full Name' || label === 'Manager') return formatPersonName(value);
  if (label === 'Status') return formatStatusLabel(value);
  return displayText(value);
};

const timelineDateLabel = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const timelineSortKey = (value) => {
  const t = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Build Career Progression Timeline events from live employee fields.
 * Newest first. First item is the active (highlighted) milestone.
 */
export const buildCareerProgressionEvents = (employee, managerPreview = null) => {
  if (!employee) return [];

  const events = [];
  const role = employee.jobTitle || employee.position || null;
  const location = employee.workLocation || employee.location || employee.city || null;
  const managerName = managerPreview
    ? getFullName(managerPreview)
    : typeof employee.manager === 'string' &&
        !['Admin', 'CEO'].includes(String(employee.manager).trim())
      ? employee.manager
      : employee.manager?.name
        ? getFullName(employee.manager)
        : null;

  if (employee.status === 'terminated') {
    const date = employee.terminationDate || employee.updatedAt;
    events.push({
      id: 'terminated',
      title: 'Employment terminated',
      date,
      dateLabel: timelineDateLabel(date),
      description: employee.terminationReason || 'Employment ended.',
    });
  }

  const experiences = [
    ...(employee.professionalExperience || []),
    ...(employee.workHistory || []).map((w) => ({
      companyName: w.company,
      jobTitle: w.position,
      startDate: w.startDate,
      endDate: w.endDate,
      description: w.description,
      location: w.location,
    })),
  ];

  experiences.forEach((exp, i) => {
    const title =
      exp.jobTitle && exp.companyName
        ? `${exp.jobTitle} at ${exp.companyName}`
        : exp.jobTitle || (exp.companyName ? `Role at ${exp.companyName}` : null);
    if (!title) return;
    const date = exp.startDate || exp.endDate;
    const bits = [];
    if (exp.employmentType) bits.push(exp.employmentType);
    if (exp.location) bits.push(exp.location);
    if (exp.currentlyWorking) bits.push('Current role');
    else if (exp.endDate) bits.push(`Until ${timelineDateLabel(exp.endDate)}`);
    const description =
      exp.description ||
      (bits.length ? bits.join(' · ') : null) ||
      (exp.companyName ? `Professional experience at ${exp.companyName}.` : 'Professional experience.');
    events.push({
      id: `exp-${exp._id || i}`,
      title: exp.currentlyWorking && exp.jobTitle ? `Current: ${exp.jobTitle}` : title,
      date,
      dateLabel: timelineDateLabel(date),
      description,
    });
  });

  if (employee.probation?.status === 'Confirmed' && employee.probation.confirmedAt) {
    const date = employee.probation.confirmedAt;
    events.push({
      id: 'probation-confirmed',
      title: 'Probation confirmed',
      date,
      dateLabel: timelineDateLabel(date),
      description: employee.probation.endDate
        ? `Cleared after probation ending ${formatDate(employee.probation.endDate)}.`
        : 'Probation cleared successfully.',
    });
  }

  if (employee.joiningDate) {
    const date = employee.joiningDate;
    const title = role ? `Joined as ${role}` : 'Joined organization';
    const bits = [];
    if (location) bits.push(`Onboarded in ${location}`);
    if (managerName) bits.push(`reporting to ${managerName}`);
    if (employee.department) bits.push(`${employee.department} department`);
    if (
      employee.probation?.status === 'Confirmed' &&
      employee.probation.confirmedAt
    ) {
      bits.push(`Probation cleared on ${formatDate(employee.probation.confirmedAt)}`);
    } else if (employee.probation?.status && employee.probation.status !== 'None') {
      bits.push(`Probation: ${employee.probation.status}`);
    }
    events.push({
      id: 'joined',
      title,
      date,
      dateLabel: timelineDateLabel(date),
      description: bits.length ? `${bits.join('. ')}.` : 'Started employment with the organization.',
    });
  }

  const seen = new Set();
  return events
    .filter((e) => e.date && e.dateLabel)
    .sort((a, b) => timelineSortKey(b.date) - timelineSortKey(a.date))
    .filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    })
    .map((e, index) => ({ ...e, active: index === 0 }));
};
