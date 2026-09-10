/**
 * Template Field Detector
 * 
 * Detects employee/company-related fields from plain-text template bodies.
 * Supports multiple formats:
 *   - {{placeholder}} syntax (existing)
 *   - [Field Name] bracket syntax
 *   - Field Name: _________ (label + underscores/blank)
 *   - Field Name: value patterns
 *   - **[Field Name]** markdown bold brackets
 *
 * Auto-maps detected fields to HRMS employee/organization data.
 * Internally converts detected plain-text fields to {{placeholder}} syntax
 * so the PDF generator can resolve them uniformly.
 */

// ─── Comprehensive HRMS Field Mapping ────────────────────────────────────────
// Maps normalized label text → internal placeholder key + HRMS source

const HRMS_MAPPINGS = [
  // Employee name variations
  { patterns: ['employee name', 'candidate name', 'full name', 'name of employee', 'emp name', 'employee full name'], key: 'employeeName', source: 'employee', field: 'name', label: 'Employee Name', fieldType: 'text' },
  // Employee ID
  { patterns: ['employee id', 'emp id', 'employee code', 'emp code', 'employee number', 'emp no'], key: 'employeeId', source: 'employee', field: 'employeeId', label: 'Employee ID', fieldType: 'text' },
  // Designation / Position / Job Title
  { patterns: ['designation', 'position', 'job title', 'role', 'job role', 'title'], key: 'designation', source: 'employee', field: 'jobTitle', label: 'Designation', fieldType: 'text' },
  // Department
  { patterns: ['department', 'dept', 'department name', 'dept name'], key: 'department', source: 'employee', field: 'department', label: 'Department', fieldType: 'text' },
  // Joining date
  { patterns: ['joining date', 'date of joining', 'doj', 'join date', 'start date', 'employment start date', 'date of employment'], key: 'joiningDate', source: 'employee', field: 'joiningDate', label: 'Joining Date', fieldType: 'date' },
  // Last working date
  { patterns: ['last working date', 'last date', 'end date', 'termination date', 'relieving date', 'date of relieving', 'separation date'], key: 'lastWorkingDate', source: 'employee', field: 'lastWorkingDate', label: 'Last Working Date', fieldType: 'date' },
  // Salary
  { patterns: ['salary', 'basic salary', 'monthly salary', 'annual salary', 'ctc', 'compensation', 'salary in words'], key: 'salary', source: 'employee', field: 'salary', label: 'Salary', fieldType: 'text' },
  // Email
  { patterns: ['email', 'email address', 'email id', 'employee email'], key: 'email', source: 'employee', field: 'email', label: 'Email', fieldType: 'text' },
  // Phone
  { patterns: ['phone', 'phone number', 'contact number', 'mobile', 'mobile number', 'contact'], key: 'phone', source: 'employee', field: 'phone1', label: 'Phone', fieldType: 'text' },
  // Company name
  { patterns: ['company name', 'organization', 'organisation', 'company', 'firm name', 'employer name', 'org name'], key: 'companyName', source: 'organization', field: 'name', label: 'Company Name', fieldType: 'text' },
  // Company address
  { patterns: ['company address', 'office address', 'registered address', 'address'], key: 'companyAddress', source: 'organization', field: 'address', label: 'Company Address', fieldType: 'text' },
  // Manager
  { patterns: ['manager', 'reporting manager', 'supervisor', 'manager name'], key: 'manager', source: 'employee', field: 'manager', label: 'Manager', fieldType: 'text' },
  // Date (current)
  { patterns: ['date', 'current date', 'today date', 'issue date', 'letter date'], key: 'currentDate', source: 'system', field: 'currentDate', label: 'Date', fieldType: 'date' },
];

/**
 * Normalize a label for matching — lowercase, remove special chars, collapse spaces
 */
function normalizeForMatch(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find HRMS mapping for a detected label
 */
function findHrmsMapping(label) {
  const normalized = normalizeForMatch(label);
  for (const mapping of HRMS_MAPPINGS) {
    for (const pattern of mapping.patterns) {
      if (normalized === pattern || normalized.includes(pattern) || pattern.includes(normalized)) {
        return mapping;
      }
    }
  }
  return null;
}

/**
 * Generate a camelCase key from a label
 */
function labelToKey(label) {
  const key = label
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
  return key || 'field'; // fallback if empty after cleaning
}

// ─── Detection Patterns ──────────────────────────────────────────────────────

/**
 * Detect fields from template body content.
 * Supports:
 *   1. {{placeholder}} — existing syntax
 *   2. [Field Name] — bracket syntax
 *   3. **[Field Name]** — markdown bold bracket syntax
 *   4. Label: _________ — colon + underscores/blanks
 *   5. Label: [value] — colon + bracketed value
 *
 * Returns array of detected fields with HRMS mapping info.
 */
export function detectFieldsFromContent(bodyContent) {
  if (!bodyContent) return [];

  const detected = new Map(); // key → field object (dedup by key)

  // 1. Existing {{placeholder}} syntax
  const placeholderRegex = /\{\{\s*([^}]+?)\s*\}\}/g;
  let match;
  while ((match = placeholderRegex.exec(bodyContent)) !== null) {
    const rawKey = match[1].trim();
    // Skip stamp placeholder — it's not an employee-fillable field
    if (/^company\s*stamp$/i.test(rawKey) || rawKey === 'companyStamp') continue;
    const mapping = findHrmsMapping(rawKey);
    const key = mapping?.key || rawKey;
    if (!detected.has(key)) {
      detected.set(key, {
        key,
        label: mapping?.label || rawKey.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim(),
        fieldType: mapping?.fieldType || (rawKey.toLowerCase().includes('date') ? 'date' : 'text'),
        required: true,
        source: mapping?.source || 'manual',
        hrmsField: mapping?.field || '',
        autoMapped: !!mapping,
        detectedAs: match[0],
        options: [],
        defaultValue: '',
        placeholder: '',
      });
    }
  }

  // 2. [Field Name] and **[Field Name]** bracket patterns
  const bracketRegex = /\*{0,2}\[([^\]]{2,40})\]\*{0,2}/g;
  while ((match = bracketRegex.exec(bodyContent)) !== null) {
    const label = match[1].trim();
    // Skip if it looks like a URL or markdown link
    if (label.startsWith('http') || label.startsWith('/')) continue;
    // Skip common non-field brackets
    if (['x', 'X', ' '].includes(label)) continue;
    // Skip [Company Stamp] — it's a special document placeholder, not a data field
    if (/^company\s*stamp$/i.test(label)) continue;

    const mapping = findHrmsMapping(label);
    const key = mapping?.key || labelToKey(label);
    if (!detected.has(key)) {
      detected.set(key, {
        key,
        label: mapping?.label || label,
        fieldType: mapping?.fieldType || (label.toLowerCase().includes('date') ? 'date' : 'text'),
        required: true,
        source: mapping?.source || 'manual',
        hrmsField: mapping?.field || '',
        autoMapped: !!mapping,
        detectedAs: match[0],
        options: [],
        defaultValue: '',
        placeholder: '',
      });
    }
  }

  // 3. Label: _________ or Label: blank patterns (line-by-line)
  const lines = bodyContent.split('\n');
  for (const line of lines) {
    // Pattern: "Label: ____" or "Label: " (trailing space/nothing after colon)
    const colonMatch = line.match(/^[\s*]*([A-Za-z][A-Za-z\s/()]{1,35}):\s*[_.\-\s]*$/);
    if (colonMatch) {
      const label = colonMatch[1].trim();
      const mapping = findHrmsMapping(label);
      const key = mapping?.key || labelToKey(label);
      if (!detected.has(key)) {
        detected.set(key, {
          key,
          label: mapping?.label || label,
          fieldType: mapping?.fieldType || (label.toLowerCase().includes('date') ? 'date' : 'text'),
          required: true,
          source: mapping?.source || 'manual',
          hrmsField: mapping?.field || '',
          autoMapped: !!mapping,
          detectedAs: colonMatch[0].trim(),
          options: [],
          defaultValue: '',
          placeholder: '',
        });
      }
    }

    // Pattern: "Label: [Some Value]" — colon with bracketed sample value
    const colonBracketMatch = line.match(/^[\s*]*([A-Za-z][A-Za-z\s/()]{1,35}):\s*\[([^\]]+)\]/);
    if (colonBracketMatch) {
      const label = colonBracketMatch[1].trim();
      const mapping = findHrmsMapping(label);
      const key = mapping?.key || labelToKey(label);
      if (!detected.has(key)) {
        detected.set(key, {
          key,
          label: mapping?.label || label,
          fieldType: mapping?.fieldType || (label.toLowerCase().includes('date') ? 'date' : 'text'),
          required: true,
          source: mapping?.source || 'manual',
          hrmsField: mapping?.field || '',
          autoMapped: !!mapping,
          detectedAs: colonBracketMatch[0].trim(),
          options: [],
          defaultValue: '',
          placeholder: '',
        });
      }
    }
  }

  return Array.from(detected.values()).filter(f => f.key && f.key.length > 0);
}

/**
 * Convert plain-text field references in template body to {{placeholder}} syntax.
 * This is called when saving a template — the stored bodyContent will use {{key}} 
 * so the PDF generator can resolve placeholders uniformly.
 *
 * @param {string} bodyContent - Original template body
 * @param {Array} detectedFields - Fields detected by detectFieldsFromContent
 * @returns {string} Body content with plain-text field references converted to {{key}}
 */
export function convertToPlaceholderSyntax(bodyContent, detectedFields) {
  if (!bodyContent || !detectedFields?.length) return bodyContent;

  let converted = bodyContent;

  for (const field of detectedFields) {
    const detectedAs = field.detectedAs;
    if (!detectedAs) continue;

    // Don't convert if already in {{}} syntax
    if (detectedAs.startsWith('{{') && detectedAs.endsWith('}}')) continue;

    // Replace the detected pattern with {{key}}
    // Use a safe replacement that handles special regex chars
    const escapedPattern = detectedAs.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedPattern, 'g');
    converted = converted.replace(regex, `{{${field.key}}}`);
  }

  return converted;
}

/**
 * Get the full HRMS pre-population map for an employee + organization.
 * Used by getTemplateForEmployee to pre-fill detected fields.
 */
export function buildHrmsPrePopulationMap(employee, organization) {
  const fullName = `${employee?.name || ''} ${employee?.lastName || ''}`.trim();
  const companyName = organization?.name || organization?.legalName || '';
  const companyAddr = organization?.address
    ? [organization.address.street, organization.address.city, organization.address.state, organization.address.country, organization.address.zipCode].filter(Boolean).join(', ')
    : '';

  return {
    employeeName: fullName,
    candidateName: fullName,
    fullName: fullName,
    name: employee?.name || '',
    lastName: employee?.lastName || '',
    email: employee?.email || '',
    employeeId: employee?.employeeId || '',
    empId: employee?.employeeId || '',
    department: employee?.department || '',
    designation: employee?.jobTitle || employee?.position || '',
    jobTitle: employee?.jobTitle || '',
    position: employee?.position || '',
    joiningDate: employee?.joiningDate ? formatDateForField(employee.joiningDate) : '',
    dateOfJoining: employee?.joiningDate ? formatDateForField(employee.joiningDate) : '',
    lastWorkingDate: employee?.lastWorkingDate ? formatDateForField(employee.lastWorkingDate) : '',
    salary: employee?.salary ? String(employee.salary) : '',
    phone: employee?.phone1 || '',
    manager: employee?.manager || '',
    companyName,
    organization: companyName,
    company: companyName,
    companyLegalName: organization?.legalName || organization?.name || '',
    companyAddress: companyAddr,
    companyEmail: organization?.email || '',
    companyPhone: organization?.phone || '',
    currentDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
  };
}

function formatDateForField(dateVal) {
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0]; // YYYY-MM-DD for input[type=date]
  } catch {
    return '';
  }
}
