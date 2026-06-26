import Employee from '../../models/employee.model.js';
import User from '../../models/user.model.js';
import mongoose from 'mongoose';
import logger from '../../helpers/logger.js';
import { validateAndNormalizeNationalId } from '../../helpers/nationalIdValidation.js';
import { mergeLegacyAndCanonicalEmployeeDocuments } from '../../helpers/employeeDocumentUploadHelper.js';
import { getEffectiveFunctionalRoles } from '../../helpers/functionalRolesHelper.js';
import { isEmployeeLinkedToManager } from '../../helpers/managerHelper.js';
import { sanitizeTaxDeclarationInput } from '../../helpers/taxDeclarationHelper.js';
import { getIndianFinancialYear } from '../../helpers/incomeTaxCalculation.js';

/** Only HR staff may view another employee's uploaded documents (not admin/manager). */
const isRequesterHrStaff = async (req) => {
  if (!req.employee?._id) return false;
  const requester = await Employee.findById(req.employee._id)
    .select('functionalRoles department position jobTitle')
    .lean();
  return !!(requester && getEffectiveFunctionalRoles(requester).includes('hr'));
};

// Employee updates their additional information
export const updateEmployeeInfo = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        const updateData = { ...req.body };

        // Fields that cannot be updated through this endpoint
        const restrictedFields = [
            'name', 'lastName', 'email', 'password', 'position', 
            'department', 'manager', 'jobTitle', 'jobCategory', 
            'salary', 'role', 'active', 'guarantors', 'nextOfKins',
            'familyDetails', 'academicRecords', 'professionalQualifications'
        ];

        // Check if update includes restricted fields
        const invalidUpdates = Object.keys(updateData).filter(
            field => restrictedFields.includes(field)
        );

        if (invalidUpdates.length > 0) {
            return res.status(400).json({
                message: `Cannot update restricted fields: ${invalidUpdates.join(', ')}`
            });
        }

        // Validate phone numbers if provided
        if (updateData.phone1) {
            if (!/^\d{10,15}$/.test(updateData.phone1)) {
                return res.status(400).json({ message: 'Phone1 must be 10-15 digits' });
            }
        }

        if (updateData.phone2) {
            if (!/^\d{10,15}$/.test(updateData.phone2)) {
                return res.status(400).json({ message: 'Phone2 must be 10-15 digits' });
            }
        }

        // Validate personal email if provided
        if (updateData.personalEmail) {
            const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
            if (!emailRegex.test(updateData.personalEmail)) {
                return res.status(400).json({ message: 'Please provide a valid personal email' });
            }
        }

        // Normalize optional fields: treat empty string as "not provided"
        if (typeof updateData.birthDate === 'string' && !updateData.birthDate.trim()) {
            delete updateData.birthDate;
        }
        if (typeof updateData.gender === 'string' && !updateData.gender.trim()) {
            delete updateData.gender;
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'professionalBio')) {
            updateData.professionalBio = String(updateData.professionalBio || '').trim();
        }

        const unsetFields = {};

        // National ID: explicit clear (empty string) removes stored id + type
        if (Object.prototype.hasOwnProperty.call(req.body, 'nationalId') && (!req.body.nationalId || !String(req.body.nationalId).trim())) {
            unsetFields.nationalId = '';
            unsetFields.nationalIdType = '';
            delete updateData.nationalId;
            delete updateData.nationalIdType;
        } else {
            if (typeof updateData.nationalIdType === 'string' && !updateData.nationalIdType.trim()) {
                delete updateData.nationalIdType;
            }
            if (typeof updateData.nationalId === 'string' && !updateData.nationalId.trim()) {
                delete updateData.nationalId;
            }

            const hasId = !!(updateData.nationalId && String(updateData.nationalId).trim());
            const hasType = !!(updateData.nationalIdType && String(updateData.nationalIdType).trim());

            if (hasId && !hasType) {
                return res.status(400).json({ message: 'Select a national ID document type' });
            }
            if (hasType && !hasId) {
                return res.status(400).json({ message: 'Enter the national ID number for the selected document type' });
            }
            if (hasId && hasType) {
                const result = validateAndNormalizeNationalId(updateData.nationalIdType, updateData.nationalId);
                if (!result.ok) {
                    return res.status(400).json({ message: result.message });
                }
                updateData.nationalId = result.normalized;
            }
        }

        // Validate birth date if provided
        if (updateData.birthDate) {
            const birthDate = new Date(updateData.birthDate);
            if (Number.isNaN(birthDate.getTime())) {
                return res.status(400).json({ message: 'Please provide a valid birth date' });
            }
            if (birthDate > new Date()) {
                return res.status(400).json({ message: 'Birth date cannot be in the future' });
            }
        }

        // Validate gender if provided
        if (updateData.gender) {
            const allowedGenders = ['Male', 'Female', 'Other', 'Prefer not to say'];
            if (!allowedGenders.includes(updateData.gender)) {
                return res.status(400).json({ message: 'Invalid gender value' });
            }
        }

        // Update the employee document
        const mongoUpdate = {};
        if (Object.keys(updateData).length > 0) {
            mongoUpdate.$set = updateData;
        }
        if (Object.keys(unsetFields).length > 0) {
            mongoUpdate.$unset = unsetFields;
        }

        if (!mongoUpdate.$set && !mongoUpdate.$unset) {
            return res.status(400).json({ message: 'No valid fields to update' });
        }

        const updatedEmployee = await Employee.findByIdAndUpdate(
            employeeId,
            mongoUpdate,
            { 
                new: true, 
                runValidators: true,
                fields: { 
                    password: 0,
                    ...Object.fromEntries(restrictedFields.map(field => [field, 0]))
                }
            }
        ).select('-password');

        if (!updatedEmployee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        res.status(200).json({
            message: 'Employee information updated successfully',
            employee: updatedEmployee
        });

    } catch (error) {
        logger.error('Error updating employee info', { error: error.message, stack: error.stack });
        res.status(500).json({ 
            message: 'Failed to update employee information',
            error: error.message,
            ...(error.errors && { detailedErrors: error.errors })
        });
    }
};

// Employee adds academic records (max 3)
export const addAcademicRecord = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        const {
            institution,
            details,
            degree,
            fieldOfStudy,
            startDate,
            endDate,
            cgpa,
        } = req.body;

        const inst = institution != null ? String(institution).trim() : '';
        const deg = degree != null ? String(degree).trim() : '';
        const det = details != null ? String(details).trim() : '';

        if (!inst || (!deg && !det)) {
            return res.status(400).json({
                message: 'Institution and degree (or details) are required',
            });
        }

        const parseDate = (v) => {
            if (v == null || v === '') return undefined;
            const d = new Date(v);
            return Number.isNaN(d.getTime()) ? undefined : d;
        };

        const field = fieldOfStudy != null ? String(fieldOfStudy).trim() : '';
        const cgpaVal = cgpa != null ? String(cgpa).trim() : '';

        const newRecord = { institution: inst };
        if (deg) newRecord.degree = deg;
        if (det) newRecord.details = det;
        if (field) newRecord.fieldOfStudy = field;
        const sd = parseDate(startDate);
        const ed = parseDate(endDate);
        if (sd) newRecord.startDate = sd;
        if (ed) newRecord.endDate = ed;
        if (cgpaVal) newRecord.cgpa = cgpaVal;

        // Check current count of academic records
        const employee = await Employee.findById(employeeId);
        if (employee.academicRecords.length >= 3) {
            return res.status(400).json({ 
                message: 'Maximum limit of 3 academic records reached' 
            });
        }

        const updatedEmployee = await Employee.findByIdAndUpdate(
            employeeId,
            { $push: { academicRecords: newRecord } },
            { new: true }
        ).select('academicRecords');

        res.status(201).json({
            message: 'Academic record added successfully',
            academicRecords: updatedEmployee.academicRecords
        });

    } catch (error) {
        logger.error('Error adding academic record', { error: error.message, stack: error.stack });
        res.status(500).json({ 
            message: 'Failed to add academic record',
            error: error.message
        });
    }
};

// Employee updates an academic record (by subdocument _id)
export const updateAcademicRecord = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        const {
            academicRecordId,
            institution,
            details,
            degree,
            fieldOfStudy,
            startDate,
            endDate,
            cgpa,
        } = req.body;

        if (!academicRecordId || !mongoose.isValidObjectId(academicRecordId)) {
            return res.status(400).json({ message: 'Valid academicRecordId is required' });
        }

        const inst = institution != null ? String(institution).trim() : '';
        const deg = degree != null ? String(degree).trim() : '';
        const det = details != null ? String(details).trim() : '';

        if (!inst || (!deg && !det)) {
            return res.status(400).json({
                message: 'Institution and degree (or details) are required',
            });
        }

        const parseDate = (v) => {
            if (v == null || v === '') return undefined;
            const d = new Date(v);
            return Number.isNaN(d.getTime()) ? undefined : d;
        };

        const field = fieldOfStudy != null ? String(fieldOfStudy).trim() : '';
        const cgpaVal = cgpa != null ? String(cgpa).trim() : '';
        const sd = parseDate(startDate);
        const ed = parseDate(endDate);

        const result = await Employee.updateOne(
            { _id: employeeId, 'academicRecords._id': academicRecordId },
            {
                $set: {
                    'academicRecords.$.institution': inst,
                    'academicRecords.$.degree': deg || '',
                    'academicRecords.$.details': det || '',
                    'academicRecords.$.fieldOfStudy': field || '',
                    'academicRecords.$.startDate': sd || null,
                    'academicRecords.$.endDate': ed || null,
                    'academicRecords.$.cgpa': cgpaVal || ''
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Academic record not found' });
        }

        const updatedEmployee = await Employee.findById(employeeId).select('academicRecords');
        res.status(200).json({
            message: 'Academic record updated successfully',
            academicRecords: updatedEmployee.academicRecords
        });
    } catch (error) {
        logger.error('Error updating academic record', { error: error.message, stack: error.stack });
        res.status(500).json({
            message: 'Failed to update academic record',
            error: error.message
        });
    }
};

// Employee deletes an academic record (by subdocument _id)
export const deleteAcademicRecord = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        const { academicRecordId } = req.body;

        if (!academicRecordId || !mongoose.isValidObjectId(academicRecordId)) {
            return res.status(400).json({ message: 'Valid academicRecordId is required' });
        }

        const result = await Employee.updateOne(
            { _id: employeeId, 'academicRecords._id': academicRecordId },
            { $pull: { academicRecords: { _id: academicRecordId } } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Academic record not found' });
        }

        const updatedEmployee = await Employee.findById(employeeId).select('academicRecords');
        res.status(200).json({
            message: 'Academic record deleted successfully',
            academicRecords: updatedEmployee.academicRecords
        });
    } catch (error) {
        logger.error('Error deleting academic record', { error: error.message, stack: error.stack });
        res.status(500).json({
            message: 'Failed to delete academic record',
            error: error.message
        });
    }
};

// Employee adds/updates guarantor (only 1 allowed)
export const addGuarantorDetails = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        const { name, occupation, phone, relationship, address } = req.body;

        // Validate required fields
        if (!name || !occupation || !phone) {
            return res.status(400).json({ 
                message: 'Name, occupation and phone are required' 
            });
        }

        // Validate phone number format
        if (!/^\d{10,15}$/.test(phone)) {
            return res.status(400).json({ 
                message: 'Phone must be 10-15 digits' 
            });
        }

        const newGuarantor = { 
            name,
            occupation,
            phone,
            relationship: relationship || 'Relative',
            address: address || '',
            addedAt: new Date()
        };

        // Use $set to replace the entire guarantors array with just the new one
        const updatedEmployee = await Employee.findByIdAndUpdate(
            employeeId,
            { $set: { guarantors: [newGuarantor] } }, // Only one guarantor allowed
            { new: true }
        ).select('guarantors');

        res.status(201).json({
            message: 'Guarantor details updated successfully',
            guarantors: updatedEmployee.guarantors
        });

    } catch (error) {
        logger.error('Error adding guarantor details', { error: error.message, stack: error.stack });
        res.status(500).json({ 
            message: 'Failed to update guarantor details',
            error: error.message
        });
    }
};

// Employee adds professional qualification
  export const addProfessionalQualification = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        const { title, organization, duration, description } = req.body;

        if (!title || !organization) {
            return res.status(400).json({ message: 'Title and organization are required' });
        }

        const newQualification = { 
            title, 
            organization, 
            duration: duration || '', 
            description: description || '' 
        };

        const updatedEmployee = await Employee.findByIdAndUpdate(
            employeeId,
            { $push: { professionalQualifications: newQualification } },
            { new: true }
        ).select('professionalQualifications');

        res.status(201).json({
            message: 'Professional qualification added successfully',
            professionalQualifications: updatedEmployee.professionalQualifications
        });

    } catch (error) {
        logger.error('Error adding professional qualification', { error: error.message, stack: error.stack });
        res.status(500).json({ 
            message: 'Failed to add professional qualification',
            error: error.message
        });
    }
};

// Employee updates professional qualification (by subdocument _id)
export const updateProfessionalQualification = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        const { professionalQualificationId, title, organization, duration, description } = req.body;

        if (!professionalQualificationId || !mongoose.isValidObjectId(professionalQualificationId)) {
            return res.status(400).json({ message: 'Valid professionalQualificationId is required' });
        }

        const ttl = title != null ? String(title).trim() : '';
        const org = organization != null ? String(organization).trim() : '';
        if (!ttl || !org) {
            return res.status(400).json({ message: 'Title and organization are required' });
        }

        const result = await Employee.updateOne(
            { _id: employeeId, 'professionalQualifications._id': professionalQualificationId },
            {
                $set: {
                    'professionalQualifications.$.title': ttl,
                    'professionalQualifications.$.organization': org,
                    'professionalQualifications.$.duration': duration != null ? String(duration).trim() : '',
                    'professionalQualifications.$.description': description != null ? String(description).trim() : ''
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Professional qualification not found' });
        }

        const updatedEmployee = await Employee.findById(employeeId).select('professionalQualifications');
        res.status(200).json({
            message: 'Professional qualification updated successfully',
            professionalQualifications: updatedEmployee.professionalQualifications
        });
    } catch (error) {
        logger.error('Error updating professional qualification', { error: error.message, stack: error.stack });
        res.status(500).json({
            message: 'Failed to update professional qualification',
            error: error.message
        });
    }
};

// Employee deletes professional qualification (by subdocument _id)
export const deleteProfessionalQualification = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        const { professionalQualificationId } = req.body;

        if (!professionalQualificationId || !mongoose.isValidObjectId(professionalQualificationId)) {
            return res.status(400).json({ message: 'Valid professionalQualificationId is required' });
        }

        const result = await Employee.updateOne(
            { _id: employeeId, 'professionalQualifications._id': professionalQualificationId },
            { $pull: { professionalQualifications: { _id: professionalQualificationId } } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Professional qualification not found' });
        }

        const updatedEmployee = await Employee.findById(employeeId).select('professionalQualifications');
        res.status(200).json({
            message: 'Professional qualification deleted successfully',
            professionalQualifications: updatedEmployee.professionalQualifications
        });
    } catch (error) {
        logger.error('Error deleting professional qualification', { error: error.message, stack: error.stack });
        res.status(500).json({
            message: 'Failed to delete professional qualification',
            error: error.message
        });
    }
};

// Employee adds/updates next of kin (only 1 allowed)
export const addNextOfKin = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        const { name, occupation, phone, relationship, address } = req.body;

        // Validate required fields
        if (!name || !relationship || !phone) {
            return res.status(400).json({ 
                message: 'Name, relationship and phone are required' 
            });
        }

        // Validate phone number format
        if (!/^\d{10,15}$/.test(phone)) {
            return res.status(400).json({ 
                message: 'Phone must be 10-15 digits' 
            });
        }

        const newNextOfKin = {
            name,
            occupation: occupation || '',
            phone,
            relationship,
            address: address || '',
            addedAt: new Date()
        };

        // Use $set to replace the entire nextOfKins array with just the new one
        const updatedEmployee = await Employee.findByIdAndUpdate(
            employeeId,
            { $set: { nextOfKins: [newNextOfKin] } }, // Only one next of kin allowed
            { new: true }
        ).select('nextOfKins');

        res.status(201).json({
            message: 'Next of kin updated successfully',
            nextOfKins: updatedEmployee.nextOfKins
        });

    } catch (error) {
        logger.error('Error adding next of kin', { error: error.message, stack: error.stack });
        res.status(500).json({ 
            message: 'Failed to update next of kin',
            error: error.message
        });
    }
};

// Employee adds family details (max 4)
export const addFamilyDetail = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        const { fullName, relationship, phoneNo, address, occupation } = req.body;

        if (!fullName || !relationship) {
            return res.status(400).json({ message: 'Full name and relationship are required' });
        }

        // Check current count of family details
        const employee = await Employee.findById(employeeId);
        if (employee.familyDetails.length >= 4) {
            return res.status(400).json({ 
                message: 'Maximum limit of 4 family members reached' 
            });
        }

        const newFamilyMember = { 
            fullName, 
            relationship,
            phoneNo: phoneNo || '',
            address: address || '',
            occupation: occupation || ''
        };

        const updatedEmployee = await Employee.findByIdAndUpdate(
            employeeId,
            { $push: { familyDetails: newFamilyMember } },
            { new: true }
        ).select('familyDetails');

        res.status(201).json({
            message: 'Family detail added successfully',
            familyDetails: updatedEmployee.familyDetails
        });

    } catch (error) {
        logger.error('Error adding family detail', { error: error.message, stack: error.stack });
        res.status(500).json({ 
            message: 'Failed to add family detail',
            error: error.message
        });
    }
};

// Employee updates an existing family member (by subdocument _id)
export const updateFamilyDetail = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        const { familyMemberId, fullName, relationship, phoneNo, address, occupation } = req.body;

        if (!familyMemberId || !mongoose.isValidObjectId(familyMemberId)) {
            return res.status(400).json({ message: 'Valid familyMemberId is required' });
        }
        if (!fullName || !relationship) {
            return res.status(400).json({ message: 'Full name and relationship are required' });
        }

        const result = await Employee.updateOne(
            { _id: employeeId, 'familyDetails._id': familyMemberId },
            {
                $set: {
                    'familyDetails.$.fullName': fullName,
                    'familyDetails.$.relationship': relationship,
                    'familyDetails.$.phoneNo': phoneNo != null ? String(phoneNo) : '',
                    'familyDetails.$.address': address != null ? String(address) : '',
                    'familyDetails.$.occupation': occupation != null ? String(occupation) : ''
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Family member not found' });
        }

        const updatedEmployee = await Employee.findById(employeeId).select('familyDetails');

        res.status(200).json({
            message: 'Family detail updated successfully',
            familyDetails: updatedEmployee.familyDetails
        });
    } catch (error) {
        logger.error('Error updating family detail', { error: error.message, stack: error.stack });
        res.status(500).json({
            message: 'Failed to update family detail',
            error: error.message
        });
    }
};

// Employee updates financial details
export const updateFinancialDetails = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        const { bankName, ifsc, accountNo, accountName, panNumber, epfUan, taxRegime, metroCity } = req.body;

        if (!bankName || !ifsc || !accountNo || !accountName) {
            return res.status(400).json({ message: 'Bank name, IFSC, account number and account name are required' });
        }

        // Basic validation
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase())) {
            return res.status(400).json({ message: 'Invalid IFSC format (e.g. SBIN0001234)' });
        }

        if (!/^\d{9,18}$/.test(accountNo)) {
            return res.status(400).json({ message: 'Account number must be 9-18 digits' });
        }

        const existing = await Employee.findById(employeeId).select('financialDetails').lean();
        const prev = existing?.financialDetails || {};

        const normalizedRegime = (taxRegime != null && String(taxRegime).trim())
            ? String(taxRegime).trim()
            : (prev.taxRegime || 'New');

        const financialDetails = {
            ...prev,
            bankName,
            ifsc,
            accountNo,
            accountName,
            panNumber: (panNumber != null && String(panNumber).trim()) ? String(panNumber).trim() : '',
            epfUan: (epfUan != null && String(epfUan).trim()) ? String(epfUan).trim() : '',
            taxRegime: normalizedRegime,
            metroCity: metroCity === true || metroCity === 'true' || metroCity === 1 || metroCity === '1'
        };

        const updatedEmployee = await Employee.findByIdAndUpdate(
            employeeId,
            { financialDetails },
            { new: true }
        ).select('financialDetails');

        res.status(200).json({
            message: 'Financial details updated successfully',
            financialDetails: updatedEmployee.financialDetails
        });

    } catch (error) {
        logger.error('Error updating financial details', { error: error.message, stack: error.stack });
        res.status(500).json({ 
            message: 'Failed to update financial details',
            error: error.message
        });
    }
};

export const getTaxDeclaration = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        const financialYear = req.query.financialYear || getIndianFinancialYear();

        const employee = await Employee.findById(employeeId).select('financialDetails').lean();
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const fin = employee.financialDetails || {};
        const declaration = fin.taxDeclaration || {};
        const matchesYear = declaration.financialYear === financialYear;

        res.status(200).json({
            financialYear,
            taxRegime: fin.taxRegime || 'New',
            taxDeclaration: matchesYear ? declaration : null,
            metroCity: fin.metroCity || false
        });
    } catch (error) {
        logger.error('Error fetching tax declaration', { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Failed to fetch tax declaration', error: error.message });
    }
};

export const updateTaxDeclaration = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        const taxDeclaration = sanitizeTaxDeclarationInput(req.body);

        const employee = await Employee.findById(employeeId).select('financialDetails').lean();
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const fin = employee.financialDetails || {};
        const financialDetails = {
            ...fin,
            metroCity: taxDeclaration.hra.metroCity || fin.metroCity || false,
            taxDeclaration
        };

        const updatedEmployee = await Employee.findByIdAndUpdate(
            employeeId,
            { financialDetails },
            { new: true }
        ).select('financialDetails');

        res.status(200).json({
            message: 'Tax declaration saved successfully',
            financialDetails: updatedEmployee.financialDetails
        });
    } catch (error) {
        logger.error('Error updating tax declaration', { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Failed to update tax declaration', error: error.message });
    }
};

export const getTaxDeclarationByAdmin = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const financialYear = req.query.financialYear || getIndianFinancialYear();

        const employee = await Employee.findById(employeeId).select('financialDetails organizationId').lean();
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const fin = employee.financialDetails || {};
        const declaration = fin.taxDeclaration || {};
        const matchesYear = declaration.financialYear === financialYear;

        res.status(200).json({
            financialYear,
            taxRegime: fin.taxRegime || 'New',
            taxDeclaration: matchesYear ? declaration : null,
            metroCity: fin.metroCity || false
        });
    } catch (error) {
        logger.error('Error fetching employee tax declaration (admin)', { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Failed to fetch tax declaration', error: error.message });
    }
};

// Admin gets employee's additional information

export const getEmployeeInfoByAdmin = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ message: 'Invalid employee ID' });
    }

    // Get organizationId from authenticated context
    const organizationId = req.user?.organizationId || req.employee?.organizationId || req.organizationId;
    if (!organizationId) {
      return res.status(400).json({ message: 'Organization ID is required' });
    }

    // Fetch employee and include active status and salary
    // Use lean() to get plain object and explicitly ensure salary is included
    // Filter by organizationId for multi-tenancy
    const employee = await Employee.findOne({ 
      _id: employeeId,
      organizationId 
    })
      .select('-password -role') // Exclude only password and role
      .lean(); // Get plain JavaScript object (no Mongoose document methods)

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Manager can access only employees linked to them.
    const isManagerScope = !!req.employee && req.employee?.isManager && !req.employee?.isHR && !req.user;
    if (isManagerScope) {
      const linked = isEmployeeLinkedToManager(employee, req.employee);
      if (!linked) {
        return res.status(403).json({
          message: 'Access denied. You can only view employees linked to you.'
        });
      }
    }

    // Ensure salary field is explicitly included (even if it's 0 or null)
    // The select should already include it, but we verify it's present
    if (employee.salary === undefined) {
      // If somehow salary is missing, fetch it separately
      const employeeWithSalary = await Employee.findById(employeeId)
        .select('salary')
        .lean();
      employee.salary = employeeWithSalary?.salary || 0;
    }

    // Debug log (only in development)
    if (process.env.NODE_ENV === 'development') {
      logger.info('Admin fetched employee', { employeeId, salary: employee.salary });
    }

    const requesterIsHr = await isRequesterHrStaff(req);
    if (requesterIsHr) {
      await mergeLegacyAndCanonicalEmployeeDocuments(employee);
    } else {
      delete employee.documents;
    }

    res.status(200).json({ employee });
  } catch (error) {
    logger.error('Error fetching employee info', { error: error.message, stack: error.stack });
    res.status(500).json({ 
      message: 'Failed to fetch employee information',
      error: error.message
    });
  }
};

export const getEmployeeInfoByEmployee = async (req, res) => {
    try {
        const employeeId = req.employee?._id;

        if (!employeeId) {
            const adminUserId = req.user?._id || req.user?.id;
            if (adminUserId) {
                const userDoc = await User.findById(adminUserId)
                    .select('name email phone title position role organizationId roles')
                    .lean();

                if (!userDoc) {
                    return res.status(401).json({
                        message: 'Unauthorized. Please log in.',
                    });
                }

                let timezoneContext = null;
                const organizationId = userDoc.organizationId || req.organizationId;
                if (organizationId) {
                    const { getTimezoneContext } = await import('../../helpers/organizationTimezoneService.js');
                    timezoneContext = await getTimezoneContext(
                        organizationId.toString?.() ? organizationId : organizationId
                    );
                }

                return res.status(200).json({
                    message: 'Your information has been retrieved successfully.',
                    employee: null,
                    user: {
                        _id: userDoc._id,
                        id: userDoc._id,
                        name: userDoc.name,
                        email: userDoc.email,
                        phone: userDoc.phone,
                        title: userDoc.title,
                        position: userDoc.position,
                        role: userDoc.role || 'admin',
                        organizationId: userDoc.organizationId,
                        platformRoles: userDoc.roles || [],
                    },
                    timezone: timezoneContext?.timezone || 'UTC',
                    timezoneContext,
                });
            }

            return res.status(401).json({
                message: 'Unauthorized. Please log in.',
            });
        }

        const requestedId = req.params.employeeId;
        if (requestedId && requestedId !== employeeId.toString()) {
            return res.status(403).json({ 
                message: 'Forbidden. You can only access your own data.' 
            });
        }

        const employee = await Employee.findById(employeeId)
            .select('-password -active -role -salary -manager');

        if (!employee) {
            return res.status(404).json({ 
                message: 'Employee not found.' 
            });
        }

        const employeeObj = employee.toObject ? employee.toObject() : employee;
        await mergeLegacyAndCanonicalEmployeeDocuments(employeeObj);

        let timezoneContext = null;
        const organizationId =
            employeeObj.organizationId || req.employee?.organizationId || req.user?.organizationId;
        if (organizationId) {
            const { getTimezoneContext } = await import('../../helpers/organizationTimezoneService.js');
            timezoneContext = await getTimezoneContext(organizationId.toString?.() ? organizationId : organizationId);
        }

        res.status(200).json({
            message: 'Your information has been retrieved successfully.',
            employee: employeeObj,
            timezone: timezoneContext?.timezone || 'UTC',
            timezoneContext,
        });

    } catch (error) {
        logger.error('Error fetching employee info', { error: error.message, stack: error.stack });
        res.status(500).json({ 
            message: 'Failed to fetch employee data.',
            error: error.message,
        });
    }
};

// Update location permission status
export const updateLocationPermission = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        const { status } = req.body;

        if (!employeeId) {
            return res.status(401).json({ 
                message: 'Unauthorized. Please log in.' 
            });
        }

        // Validate status
        const validStatuses = ['granted', 'denied', 'prompt', 'not-requested'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ 
                message: 'Invalid permission status. Must be one of: granted, denied, prompt, not-requested' 
            });
        }

        // Prepare update object
        const updateData = {
            'locationPermission.status': status,
            'locationPermission.lastCheckedAt': new Date()
        };

        // Set grantedAt or deniedAt based on status
        if (status === 'granted') {
            updateData['locationPermission.grantedAt'] = new Date();
            // Clear deniedAt if it was previously denied
            updateData['locationPermission.deniedAt'] = null;
        } else if (status === 'denied') {
            updateData['locationPermission.deniedAt'] = new Date();
            // Clear grantedAt if it was previously granted
            updateData['locationPermission.grantedAt'] = null;
        }

        const updatedEmployee = await Employee.findByIdAndUpdate(
            employeeId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select('locationPermission');

        if (!updatedEmployee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        logger.info('Location permission updated', { 
            employeeId, 
            status,
            timestamp: new Date()
        });

        res.status(200).json({
            message: 'Location permission status updated successfully',
            locationPermission: updatedEmployee.locationPermission
        });

    } catch (error) {
        logger.error('Error updating location permission', { 
            error: error.message, 
            stack: error.stack 
        });
        res.status(500).json({ 
            message: 'Failed to update location permission',
            error: error.message
        });
    }
};

// Get upcoming birthdays (next 10 days)
export const getUpcomingBirthdays = async (req, res) => {
    try {
        const today = new Date();
        const upcomingWindowDays = 10;
        const organizationId = req.user?.organizationId || req.employee?.organizationId || req.organizationId;
        if (!organizationId) {
            return res.status(400).json({ message: 'Organization ID is required' });
        }

        // Find active employees for this organization with birth dates set.
        const employees = await Employee.find({ 
            birthDate: { $exists: true, $ne: null },
            status: 'active',
            organizationId
        }).select('name lastName email profilePhoto birthDate department');

        // Filter and format birthday data
        const upcomingBirthdays = employees
            .filter(emp => {
                if (!emp.birthDate) return false;
                const birthDate = new Date(emp.birthDate);
                const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
                
                // Check if birthday is within the configured upcoming window.
                if (thisYearBirthday < today) {
                    // Birthday already passed this year, check next year
                    const nextYearBirthday = new Date(today.getFullYear() + 1, birthDate.getMonth(), birthDate.getDate());
                    return (nextYearBirthday - today) / (1000 * 60 * 60 * 24) <= upcomingWindowDays;
                }
                return (thisYearBirthday - today) / (1000 * 60 * 60 * 24) <= upcomingWindowDays;
            })
            .map(emp => {
                const birthDate = new Date(emp.birthDate);
                const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
                const daysUntilBirthday = thisYearBirthday < today ? 
                    Math.ceil((new Date(today.getFullYear() + 1, birthDate.getMonth(), birthDate.getDate()) - today) / (1000 * 60 * 60 * 24)) :
                    Math.ceil((thisYearBirthday - today) / (1000 * 60 * 60 * 24));

                return {
                    employeeId: emp._id,
                    name: `${emp.name} ${emp.lastName}`,
                    birthday: `${birthDate.getDate()} ${birthDate.toLocaleDateString('en-US', { month: 'long' })}`,
                    daysUntil: daysUntilBirthday,
                    department: emp.department,
                    profilePhoto: emp.profilePhoto
                };
            })
            .sort((a, b) => a.daysUntil - b.daysUntil)
            .slice(0, 10); // Limit to 10 upcoming birthdays

        res.status(200).json({
            success: true,
            birthdays: upcomingBirthdays,
            total: upcomingBirthdays.length
        });

    } catch (error) {
        logger.error('Error fetching upcoming birthdays', { error: error.message, stack: error.stack });
        res.status(500).json({ 
            message: 'Failed to fetch upcoming birthdays',
            error: error.message,
        });
    }
};

// HR/Admin sends birthday wishes to the selected employee
export const sendBirthdayWishes = async (req, res) => {
    try {
        const senderEmployeeId = req.employee?._id;
        const senderUserId = req.user?._id;

        const recipientEmployeeId = req.body?.employeeId;
        if (!recipientEmployeeId) {
            return res.status(400).json({ message: 'employeeId is required' });
        }

        if (!mongoose.Types.ObjectId.isValid(recipientEmployeeId)) {
            return res.status(400).json({ message: 'Invalid employeeId' });
        }

        const organizationId = req.user?.organizationId || req.employee?.organizationId || req.organizationId;
        if (!organizationId) {
            return res.status(400).json({ message: 'Organization ID is required' });
        }

        const recipient = await Employee.findOne({
            _id: recipientEmployeeId,
            organizationId,
            status: 'active'
        }).select('_id name lastName email birthDate').lean();

        if (!recipient) {
            return res.status(404).json({ message: 'Birthday employee not found' });
        }

        const senderType = senderEmployeeId ? 'Employee' : 'User';
        const senderId = senderEmployeeId || senderUserId;
        if (!senderId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const message = `Happy Birthday ${recipient.name}${recipient.lastName ? ` ${recipient.lastName}` : ''}!`;

        const notification = await Notification.create({
            organizationId,
            recipient: recipientEmployeeId,
            recipientType: 'Employee',
            sender: senderId,
            senderType,
            message,
            type: 'announcement',
            priority: 'low',
            isBroadcast: false,
            metadata: {
                birthdayEmployeeId: recipientEmployeeId,
                birthdayDate: recipient.birthDate,
            }
        });

        res.status(201).json({
            success: true,
            message: 'Birthday wishes sent successfully',
            notification
        });
    } catch (error) {
        logger.error('Error sending birthday wishes', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: 'Failed to send birthday wishes',
            error: error.message
        });
    }
};

