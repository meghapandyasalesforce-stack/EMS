import { describe, expect, it } from 'vitest';
import { getAdditionalProfileDetails } from './profileExport';

const employee = {
  personalEmail: 'personal@example.com', phone2: '0123456789', address: '12 Main Street', city: 'Pune',
  birthDate: '1990-06-15', gender: 'Female', personalDetails: { bloodGroup: 'O+', maritalStatus: 'Married' },
  emergencyContactName: 'Parent', emergencyContactPhone: '555',
  emergencyContacts: [{ name: 'First', phone: '111' }, { name: 'Second', phone: '222', email: 'second@example.com' }],
  familyDetails: [{ fullName: 'Family', phoneNo: '333' }], nextOfKins: [{ name: 'Kin', address: { city: 'Delhi', country: 'India' } }],
  academicRecords: [{ institution: 'University', degree: 'BTech', cgpa: '8.5' }],
  professionalQualifications: [{ title: 'Certificate', filePath: 'private-path' }],
  professionalExperience: [{ companyName: 'Company', currentlyWorking: false }],
  skills: ['React', { name: 'Node' }], assignedAssets: [{ assetName: 'Laptop', assetTag: 'L01' }],
  probation: { status: 'Confirmed', confirmedAt: '2025-01-01' },
  financialDetails: { accountNo: '001234', panNumber: 'ABCDE1234F', epfUan: '001111' },
  password: 'never-export', resetToken: 'never-export',
};

describe('Expanded employee profile export', () => {
  it('includes contact, personal, all repeated records, and employment details', () => {
    const result = getAdditionalProfileDetails(employee, false);
    expect(result).toMatchObject({
      'Personal Email': 'personal@example.com', 'Secondary Phone': '0123456789',
      'Permanent Residential Address': '12 Main Street', City: 'Pune', Gender: 'Female',
      'Blood Group': 'O+', 'Marital Status': 'Married', 'Emergency Contact Name': 'Parent',
      'Emergency Contact 1 - Phone': '111', 'Emergency Contact 2 - Email': 'second@example.com',
      'Family Member 1 - Phone': '333', 'Next of Kin 1 - Address': 'Delhi, India',
      'Education 1 - Degree': 'BTech', 'Education 1 - CGPA': '8.5', 'Qualification 1 - Title': 'Certificate',
      'Experience 1 - Currently Working': false, Skills: 'React; Node', 'Asset 1 - Name': 'Laptop',
      'Asset 1 - Code': 'L01', 'Probation Status': 'Confirmed', 'Bank Account Number': '001234',
    });
    expect(result['Date of Birth']).not.toBe('');
    expect(JSON.stringify(result)).not.toContain('never-export');
    expect(JSON.stringify(result)).not.toContain('private-path');
    expect(Object.values(result).every((value) => typeof value !== 'object')).toBe(true);
  });
  it('omits financial fields when payroll is hidden', () => {
    const result = getAdditionalProfileDetails(employee, true);
    expect(result).not.toHaveProperty('Bank Account Number');
    expect(result).not.toHaveProperty('PAN Number');
    expect(result).not.toHaveProperty('EPF UAN');
    expect(result['Personal Email']).toBe('personal@example.com');
  });
  it('handles an incomplete profile without undefined values', () => {
    const result = getAdditionalProfileDetails({}, false);
    expect(Object.values(result).every((value) => value === '')).toBe(true);
  });
});
