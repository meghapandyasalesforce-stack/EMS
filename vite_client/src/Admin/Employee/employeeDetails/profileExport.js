import { formatDate } from './utils';

const date = (value) => value ? formatDate(value) : '';
const address = (value) => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  return [value.line1, value.line2, value.street, value.city, value.state,
    value.postalCode || value.zipCode, value.country].filter(Boolean).join(', ');
};

// Export named profile fields only; never serialize the complete employee record.
export const getAdditionalProfileDetails = (employee, hidePayrollFields) => {
  const personal = employee.personalDetails || {};
  const contact = employee.contactDetails || {};
  const details = {
    'Personal Email': employee.personalEmail || contact.personalEmail || '',
    'Secondary Phone': employee.phone2 || contact.phone2 || '',
    'Permanent Residential Address': address(employee.address || contact.address),
    City: employee.city || contact.city || '',
    'Date of Birth': date(employee.birthDate || employee.dateOfBirth || personal.birthDate),
    Gender: employee.gender || personal.gender || '',
    'Blood Group': employee.bloodGroup || personal.bloodGroup || contact.bloodGroup || '',
    'Marital Status': employee.maritalStatus || contact.maritalStatus || personal.maritalStatus || '',
    'Spouse Name': employee.spouseName || personal.spouseName || '',
    'Marriage Date': date(employee.marriageDate || employee.anniversaryDate),
    'National ID Type': employee.nationalIdType || '',
    'National ID': employee.nationalId || '',
    'Professional Bio': employee.professionalBio || employee.bio || employee.about || employee.summary || '',
    'Job Category': employee.jobCategory || '',
    'Role Level': employee.roleLevel ?? '',
    'Work Mode': employee.workMode || '',
    Shift: employee.shiftName || (typeof employee.shift === 'string' ? employee.shift : employee.shift?.name) || '',
    'Probation Status': employee.probation?.status || '',
    'Probation Start Date': date(employee.probation?.startDate),
    'Probation End Date': date(employee.probation?.endDate),
    'Probation Confirmed Date': date(employee.probation?.confirmedAt),
    'Last Working Date': date(employee.lastWorkingDate),
    'Termination Date': date(employee.terminationDate),
    'Emergency Contact Name': employee.emergencyContactName || '',
    'Emergency Contact Phone': employee.emergencyContactPhone || '',
    'Emergency Contact Relationship': employee.emergencyContactRelationship || '',
    Skills: (Array.isArray(employee.skills) ? employee.skills : [])
      .map((skill) => typeof skill === 'string' ? skill : skill?.name).filter(Boolean).join('; '),
  };

  const addRecords = (label, records, fields) => {
    if (!Array.isArray(records)) return;
    records.forEach((record, index) => {
      if (!record) return;
      fields.forEach(([heading, key, format]) => {
        const value = typeof record === 'string' ? (key === 'name' ? record : '') : record[key];
        details[`${label} ${index + 1} - ${heading}`] = format ? format(value) : value ?? '';
      });
    });
  };
  const contactFields = [['Name', 'name'], ['Relationship', 'relationship'], ['Phone', 'phone'],
    ['Email', 'email'], ['Priority', 'priority'], ['Occupation', 'occupation'], ['Address', 'address', address]];
  addRecords('Emergency Contact', employee.emergencyContacts, contactFields);
  addRecords('Next of Kin', employee.nextOfKins, contactFields);
  addRecords('Guarantor', employee.guarantors, contactFields);
  addRecords('Family Member', employee.familyDetails, [['Name', 'fullName'], ['Relationship', 'relationship'],
    ['Phone', 'phoneNo'], ['Occupation', 'occupation'], ['Address', 'address', address]]);
  addRecords('Education', employee.academicRecords, [['Institution', 'institution'], ['Degree', 'degree'],
    ['Certificate', 'certificate'], ['Field of Study', 'fieldOfStudy'], ['Start Date', 'startDate', date],
    ['End Date', 'endDate', date], ['Year', 'year'], ['CGPA', 'cgpa'], ['Details', 'details']]);
  addRecords('Qualification', employee.professionalQualifications, [['Title', 'title'],
    ['Organization', 'organization'], ['Duration', 'duration'], ['Description', 'description']]);
  addRecords('Experience', employee.professionalExperience, [['Company', 'companyName'], ['Job Title', 'jobTitle'],
    ['Employment Type', 'employmentType'], ['Location', 'location'], ['Start Date', 'startDate', date],
    ['End Date', 'endDate', date], ['Currently Working', 'currentlyWorking'], ['Description', 'description']]);
  const assets = employee.assets || employee.assignedAssets || employee.equipment;
  addRecords('Asset', Array.isArray(assets) ? assets.map((asset) => typeof asset === 'string' ? asset : {
    name: asset?.name || asset?.title || asset?.assetName || asset?.type,
    code: asset?.code || asset?.assetTag,
    serialNumber: asset?.serialNumber,
  }) : [], [['Name', 'name'], ['Code', 'code'], ['Serial Number', 'serialNumber']]);

  if (!hidePayrollFields) {
    const financial = employee.financialDetails || {};
    Object.assign(details, {
      'Bank Name': financial.bankName || '',
      'Bank Account Name': financial.accountName || '',
      'Bank Account Number': financial.accountNo || '',
      'IFSC Code': financial.ifsc || '',
      'PAN Number': financial.panNumber || '',
      'EPF UAN': financial.epfUan || '',
      'Tax Regime': financial.taxRegime || financial.taxId || '',
    });
  }
  return details;
};
