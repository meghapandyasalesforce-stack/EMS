import React from 'react';
import { FiEdit, FiUser } from 'react-icons/fi';
import SectionCard from '../SectionCard';
import EmployeeFieldGrid from '../EmployeeFieldGrid';
import SimpleDataTable from '../SimpleDataTable';
import {
  getFullName,
  formatDate,
  calculateAge,
  getEmergencyContactSummary,
} from '../utils';

const PersonalTab = ({ employee, canEditName = false, onEditName }) => {
  const personalFields = [
    { label: 'Full Name', value: getFullName(employee) },
    { label: 'Date of Birth', value: formatDate(employee.birthDate) },
    { label: 'Age', value: calculateAge(employee.birthDate) },
    { label: 'Gender', value: employee.gender },
    { label: 'Work Email', value: employee.email, highlight: true },
    { label: 'Personal Email', value: employee.personalEmail, highlight: !!employee.personalEmail },
    { label: 'Primary Phone', value: employee.phone1 },
    { label: 'Secondary Phone', value: employee.phone2 },
    { label: 'City', value: employee.city },
    { label: 'Current Address', value: employee.address },
    { label: 'National ID Type', value: employee.nationalIdType },
    { label: 'National ID Number', value: employee.nationalId },
    { label: 'Emergency Contact', value: getEmergencyContactSummary(employee) },
  ];

  return (
    <div className="space-y-6">
      <SectionCard
        title="Personal Information"
        icon={FiUser}
        action={
          canEditName && onEditName ? (
            <button
              type="button"
              onClick={onEditName}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#20C997] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#1ba87f]"
            >
              <FiEdit className="h-3.5 w-3.5" />
              Edit name
            </button>
          ) : null
        }
      >
        <EmployeeFieldGrid fields={personalFields} />
      </SectionCard>

      {employee.familyDetails?.length > 0 && (
        <SectionCard title={`Family Details (${employee.familyDetails.length})`} icon={FiUser}>
          <SimpleDataTable
            columns={[
              { key: 'fullName', label: 'Name' },
              { key: 'relationship', label: 'Relationship' },
              { key: 'phoneNo', label: 'Phone' },
              { key: 'occupation', label: 'Occupation' },
              { key: 'address', label: 'Address' },
            ]}
            rows={employee.familyDetails}
          />
        </SectionCard>
      )}

      {employee.nextOfKins?.length > 0 && (
        <SectionCard title={`Next of Kin (${employee.nextOfKins.length})`}>
          <SimpleDataTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'relationship', label: 'Relationship' },
              { key: 'phone', label: 'Phone' },
              { key: 'occupation', label: 'Occupation' },
              { key: 'address', label: 'Address' },
            ]}
            rows={employee.nextOfKins}
          />
        </SectionCard>
      )}

      {employee.guarantors?.length > 0 && (
        <SectionCard title={`Guarantors (${employee.guarantors.length})`}>
          <SimpleDataTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'relationship', label: 'Relationship' },
              { key: 'phone', label: 'Phone' },
              { key: 'occupation', label: 'Occupation' },
            ]}
            rows={employee.guarantors}
          />
        </SectionCard>
      )}

      {employee.emergencyContacts?.length > 0 && (
        <SectionCard title={`Emergency Contacts (${employee.emergencyContacts.length})`}>
          <SimpleDataTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'relationship', label: 'Relationship' },
              { key: 'phone', label: 'Phone' },
              { key: 'email', label: 'Email' },
              { key: 'priority', label: 'Priority' },
            ]}
            rows={employee.emergencyContacts}
          />
        </SectionCard>
      )}

      {employee.academicRecords?.length > 0 && (
        <SectionCard title={`Academic Records (${employee.academicRecords.length})`}>
          <SimpleDataTable
            columns={[
              { key: 'institution', label: 'Institution' },
              {
                key: 'degree',
                label: 'Degree',
                render: (r) => r.degree || r.certificate || r.details || '—',
              },
              { key: 'fieldOfStudy', label: 'Field' },
              {
                key: 'period',
                label: 'Period',
                render: (r) => {
                  if (r.startDate || r.endDate) {
                    const s = r.startDate ? formatDate(r.startDate) : '';
                    const e = r.endDate ? formatDate(r.endDate) : s ? 'Present' : '';
                    return [s, e].filter(Boolean).join(' → ');
                  }
                  return r.year ? String(r.year) : '—';
                },
              },
              {
                key: 'grade',
                label: 'Grade',
                render: (r) => r.cgpa || r.gpa || r.grade || '—',
              },
            ]}
            rows={employee.academicRecords}
          />
        </SectionCard>
      )}

      {employee.professionalQualifications?.length > 0 && (
        <SectionCard title={`Professional Qualifications (${employee.professionalQualifications.length})`}>
          <SimpleDataTable
            columns={[
              { key: 'title', label: 'Title' },
              { key: 'organization', label: 'Organization' },
              { key: 'duration', label: 'Duration' },
              { key: 'description', label: 'Description' },
            ]}
            rows={employee.professionalQualifications}
          />
        </SectionCard>
      )}
    </div>
  );
};

export default PersonalTab;
