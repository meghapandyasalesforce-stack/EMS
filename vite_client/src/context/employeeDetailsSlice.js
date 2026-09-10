import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../utils/axios';
import { checkAuthSession, logoutUser, setUser } from './Auth/authSlice';

function isEmployeeProfile(user) {
  if (!user) return false;
  if (
    user.organizationId &&
    user.employeeId == null &&
    user.position == null &&
    user.department == null
  ) {
    return false;
  }
  const hasId = user._id != null || user.id != null;
  return (
    hasId &&
    (user.employeeId != null ||
      user.position != null ||
      user.department != null ||
      user.joiningDate != null)
  );
}
import { BOTH_PROFILE_ENDPOINT, ADMIN_EMPLOYEE_ENDPOINT } from '../utils/constant';
// Base URL - use environment variable or default to relative path
const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Async thunk for fetching employee details
export const fetchEmployeeDetails = createAsyncThunk(
  'employeeDetails/fetchEmployeeDetails',
  async (employeeId, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${BOTH_PROFILE_ENDPOINT}/admin/get-info/${employeeId}`,
        { withCredentials: true }
      );
      return response.data.employee;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch employee details');
    }
  }
);

// Async thunk for updating employee status(Active or inactive )
export const updateEmployeeStatus = createAsyncThunk(
  'employeeDetails/updateEmployeeStatus',
  async ({ employeeId, active }, { rejectWithValue }) => {
    try {
      const response = await axios.patch(
        `${BOTH_PROFILE_ENDPOINT}/admin/update-status/${employeeId}`,
        { active },
        { withCredentials: true }
      );
      return response.data.employee;
    } catch (error) {
      const data = error.response?.data;
      return rejectWithValue(
        data?.message ||
          data?.errors?.status ||
          data?.errors?.active ||
          'Failed to update employee status'
      );
    }
  }
);

// Async thunk for updating employee info (Address and phone numbers )
export const updateEmployeeInfo = createAsyncThunk(
  'employeeDetails/updateEmployeeInfo',
  async (updateData, { rejectWithValue, getState }) => {
    try {
      const { employee } = getState().employeeDetails;
      const response = await axios.put(
        `${BOTH_PROFILE_ENDPOINT}/update-info`,
        updateData,
        { withCredentials: true }
      );
      return { ...employee, ...response.data.employee };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update employee info');
    }
  }
);

// Async thunk for updating employee work information
export const updateEmployeeWorkInfo = createAsyncThunk(
  'employeeDetails/updateEmployeeWorkInfo',
  async ({ employeeId, workData }, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${ADMIN_EMPLOYEE_ENDPOINT}/${employeeId}/work-info`,
        workData,
        { withCredentials: true }
      );
      return response.data.employee;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update work information');
    }
  }
);

// Async thunk for updating employee payroll statutory settings (PF/ESI flags)
export const updateEmployeePayrollSettings = createAsyncThunk(
  'employeeDetails/updateEmployeePayrollSettings',
  async ({ employeeId, deductPf, deductEsi }, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${ADMIN_EMPLOYEE_ENDPOINT}/${employeeId}/payroll-settings`,
        { deductPf, deductEsi },
        { withCredentials: true }
      );
      return response.data.employee;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update payroll settings');
    }
  }
);

// Async thunk for adding academic record
export const addAcademicRecord = createAsyncThunk(
  'employeeDetails/addAcademicRecord',
  async (payload, { rejectWithValue, getState }) => {
    try {
      const { employee } = getState().employeeDetails;
      const response = await axios.post(
        `${BOTH_PROFILE_ENDPOINT}/add-academic-record`,
        payload,
        {
          withCredentials: true, // Cookies (including httpOnly JWT) are sent automatically
          headers: {
            'Content-Type': 'application/json'
            // SECURITY FIX: Token is in httpOnly cookie, sent automatically with credentials: 'include'
            // Authorization header will be added by axios interceptor if needed
          }
        }
      );

      // Return the updated employee with new academicRecords
      return {
        ...employee,
        academicRecords: response.data.academicRecords // Changed from response.data.record
      };
    } catch (error) {
      // Removed console.error for production
      return rejectWithValue(error.response?.data?.message || 'Failed to add academic record');
    }
  }
);

// Async thunk for updating academic record
export const updateAcademicRecord = createAsyncThunk(
  'employeeDetails/updateAcademicRecord',
  async (payload, { rejectWithValue, getState }) => {
    try {
      const { employee } = getState().employeeDetails;
      const response = await axios.put(
        `${BOTH_PROFILE_ENDPOINT}/update-academic-record`,
        payload,
        { withCredentials: true }
      );
      return {
        ...employee,
        academicRecords: response.data.academicRecords
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update academic record');
    }
  }
);

// Async thunk for deleting academic record
export const deleteAcademicRecord = createAsyncThunk(
  'employeeDetails/deleteAcademicRecord',
  async (academicRecordId, { rejectWithValue, getState }) => {
    try {
      const { employee } = getState().employeeDetails;
      const response = await axios.delete(
        `${BOTH_PROFILE_ENDPOINT}/delete-academic-record`,
        {
          data: { academicRecordId },
          withCredentials: true
        }
      );
      return {
        ...employee,
        academicRecords: response.data.academicRecords
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete academic record');
    }
  }
);
// Async thunk for adding guarantor details
export const addGuarantor = createAsyncThunk(
  'employeeDetails/addGuarantor',
  async (guarantorData, { rejectWithValue }) => {
    try {
      // Transform data to match backend expectations
      const backendData = {
        name: guarantorData.name,
        occupation: guarantorData.occupation,
        phone: guarantorData.phoneNumber, // Map phoneNumber to phone
        relationship: guarantorData.relationship,
        address: guarantorData.address
      };

      const response = await axios.post(
        `${BOTH_PROFILE_ENDPOINT}/add-guarantor-detail`,
        backendData,
        { withCredentials: true }
      );
      return response.data.guarantors;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to add guarantor');
    }
  }
);
// Async thunk for adding professional qualification
export const addProfessionalQualification = createAsyncThunk(
  'employeeDetails/addProfessionalQualification',
  async (qualificationData, { rejectWithValue }) => {
    try {
      // Removed console.log for production
      const response = await axios.post(
        `${BOTH_PROFILE_ENDPOINT}/add-professional-qualification`,
        qualificationData,
        {
          withCredentials: true, // Cookies (including httpOnly JWT) are sent automatically
          headers: {
            'Content-Type': 'application/json'
            // SECURITY FIX: Token is in httpOnly cookie, sent automatically with credentials: 'include'
            // Authorization header will be added by axios interceptor if needed
          }
        }
      );
      // Removed console.log for production
      return response.data.professionalQualifications;
    } catch (error) {
      // Removed console.error for production
      return rejectWithValue(
        error.response?.data?.message ||
        error.message ||
        'Failed to add professional qualification'
      );
    }
  }
);

// Async thunk for updating professional qualification
export const updateProfessionalQualification = createAsyncThunk(
  'employeeDetails/updateProfessionalQualification',
  async (payload, { rejectWithValue, getState }) => {
    try {
      const { employee } = getState().employeeDetails;
      const response = await axios.put(
        `${BOTH_PROFILE_ENDPOINT}/update-professional-qualification`,
        payload,
        { withCredentials: true }
      );
      return {
        ...employee,
        professionalQualifications: response.data.professionalQualifications
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update professional qualification');
    }
  }
);

// Async thunk for deleting professional qualification
export const deleteProfessionalQualification = createAsyncThunk(
  'employeeDetails/deleteProfessionalQualification',
  async (professionalQualificationId, { rejectWithValue, getState }) => {
    try {
      const { employee } = getState().employeeDetails;
      const response = await axios.delete(
        `${BOTH_PROFILE_ENDPOINT}/delete-professional-qualification`,
        {
          data: { professionalQualificationId },
          withCredentials: true
        }
      );
      return {
        ...employee,
        professionalQualifications: response.data.professionalQualifications
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete professional qualification');
    }
  }
);

export const addProfessionalExperience = createAsyncThunk(
  'employeeDetails/addProfessionalExperience',
  async (experienceData, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        `${BOTH_PROFILE_ENDPOINT}/add-professional-experience`,
        experienceData,
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data.professionalExperience;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
        error.message ||
        'Failed to add professional experience'
      );
    }
  }
);

export const updateProfessionalExperience = createAsyncThunk(
  'employeeDetails/updateProfessionalExperience',
  async (payload, { rejectWithValue, getState }) => {
    try {
      const { employee } = getState().employeeDetails;
      const response = await axios.put(
        `${BOTH_PROFILE_ENDPOINT}/update-professional-experience`,
        payload,
        { withCredentials: true }
      );
      return {
        ...employee,
        professionalExperience: response.data.professionalExperience
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update professional experience');
    }
  }
);

export const deleteProfessionalExperience = createAsyncThunk(
  'employeeDetails/deleteProfessionalExperience',
  async (professionalExperienceId, { rejectWithValue, getState }) => {
    try {
      const { employee } = getState().employeeDetails;
      const response = await axios.delete(
        `${BOTH_PROFILE_ENDPOINT}/delete-professional-experience`,
        {
          data: { professionalExperienceId },
          withCredentials: true
        }
      );
      return {
        ...employee,
        professionalExperience: response.data.professionalExperience
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete professional experience');
    }
  }
);

// Async thunk for adding next of kin
export const addNextOfKin = createAsyncThunk(
  'employeeDetails/addNextOfKin',
  async (nextOfKinData, { rejectWithValue, getState }) => {
    try {
      const { employee } = getState().employeeDetails;
      const response = await axios.post(
        `${BOTH_PROFILE_ENDPOINT}/add-nok-detail`,
        nextOfKinData,
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      return { ...employee, nextOfKins: response.data.nextOfKins };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 
        'Failed to add next of kin'
      );
    }
  }
);
// Async thunk for adding family details
export const addFamilyDetail = createAsyncThunk(
  'employeeDetails/addFamilyDetail',
  async (familyData, { rejectWithValue, getState }) => {
    try {
      const { employee } = getState().employeeDetails;
      const response = await axios.post(
        `${BOTH_PROFILE_ENDPOINT}/add-family-detail`,
        familyData,
        { withCredentials: true }
      );

      // Check if backend returned an array
      const addedFamilyDetails = response.data.familyDetails;
      if (!addedFamilyDetails || !Array.isArray(addedFamilyDetails) || addedFamilyDetails.length === 0) {
        return rejectWithValue('Family detail not returned from server');
        }
        // Removed console.log for production

      return {
        ...employee,
        familyDetails: [...(employee.familyDetails || []), addedFamilyDetails.at(-1)]
      };
    } catch (error) {
      // Removed console.error for production
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to add family detail');
    }

  }
);

// Async thunk for updating an existing family member
export const updateFamilyDetail = createAsyncThunk(
  'employeeDetails/updateFamilyDetail',
  async ({ familyMemberId, ...familyFields }, { rejectWithValue, getState }) => {
    try {
      const { employee } = getState().employeeDetails;
      const response = await axios.put(
        `${BOTH_PROFILE_ENDPOINT}/update-family-detail`,
        { familyMemberId, ...familyFields },
        { withCredentials: true }
      );
      const list = response.data.familyDetails;
      if (!list || !Array.isArray(list)) {
        return rejectWithValue('Family details not returned from server');
      }
      return {
        ...employee,
        familyDetails: list
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to update family detail'
      );
    }
  }
);

// Async thunk for updating financial details
export const updateFinancialDetails = createAsyncThunk(
  'employeeDetails/updateFinancialDetails',
  async (financialData, { rejectWithValue, getState }) => {
    try {
      const { employee } = getState().employeeDetails;
      const response = await axios.put(
        `${BOTH_PROFILE_ENDPOINT}/update-financial-details`,
        financialData,
        { withCredentials: true }
      );
      return {
        ...employee,
        financialDetails: response.data.financialDetails,
        taxRegimeRequest: response.data.taxRegimeRequest || null,
        taxRegimeRequestPending: Boolean(response.data.taxRegimeRequestPending),
        message: response.data.message,
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update financial details');
    }
  }
);

export const fetchTaxDeclaration = createAsyncThunk(
  'employeeDetails/fetchTaxDeclaration',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${BOTH_PROFILE_ENDPOINT}/tax-declaration`, {
        withCredentials: true
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch tax declaration');
    }
  }
);

export const updateTaxDeclaration = createAsyncThunk(
  'employeeDetails/updateTaxDeclaration',
  async (declarationData, { rejectWithValue, getState }) => {
    try {
      const { employee } = getState().employeeDetails;
      const response = await axios.put(
        `${BOTH_PROFILE_ENDPOINT}/tax-declaration`,
        declarationData,
        { withCredentials: true }
      );
      return {
        employee: {
          ...employee,
          financialDetails: response.data.financialDetails
        },
        taxDeclaration: {
          financialYear: response.data.financialDetails?.taxDeclaration?.financialYear,
          taxRegime: response.data.financialDetails?.taxRegime,
          taxDeclaration: response.data.financialDetails?.taxDeclaration,
          metroCity: response.data.financialDetails?.metroCity
        }
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update tax declaration');
    }
  }
);

//Asyn thunk for fetching employee's own info
export const fetchEmployeeOwnInfo = createAsyncThunk(
  'employeeDetails/fetchEmployeeOwnInfo',
  async (_, { rejectWithValue }) => {
      try {
        // Removed console.log for production
        const response = await axios.get(
          `${BOTH_PROFILE_ENDPOINT}/get-my-details`,
          { withCredentials: true }
        );
        // Removed console.log for production
        return response.data.employee;
      } catch (error) {
        // Removed console.error for production
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch your information');
    }
  }
);

const employeeDetailsSlice = createSlice({
  name: 'employeeDetails',
  initialState: {
    employee: null,
    loading: false,
    error: null,
    updatingStatus: false,
    statusUpdateError: null,
    updatingInfo: false,
    updatingWorkInfo: false,
    workInfoError: null,
    updatingPayrollSettings: false,
    payrollSettingsError: null,
    addingRecord: false,
    addingGuarantor: false,
    addingQualification: false,
    addingProfessionalExperience: false,
    addingNextOfKin: false,
    addingFamilyDetail: false,
    updatingFamilyDetail: false,
    updatingFinancialDetails: false,
    taxDeclaration: null,
    loadingTaxDeclaration: false,
    updatingTaxDeclaration: false
  },
  reducers: {
    clearEmployeeDetails: (state) => {
      state.employee = null;
      state.error = null;
      state.statusUpdateError = null;
      state.workInfoError = null;
      state.updatingStatus = false;
      state.updatingWorkInfo = false;
    },
    setEmployeeProfile: (state, action) => {
      if (action.payload) {
        state.employee = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch employee details cases
      .addCase(fetchEmployeeDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.statusUpdateError = null;
        state.workInfoError = null;
      })
      .addCase(fetchEmployeeDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.employee = action.payload;
        state.statusUpdateError = null;
        state.workInfoError = null;
      })
      .addCase(fetchEmployeeDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

       // Fetch employee's own info cases
      .addCase(fetchEmployeeOwnInfo.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEmployeeOwnInfo.fulfilled, (state, action) => {
        state.loading = false;
        state.employee = action.payload;
      })
      .addCase(fetchEmployeeOwnInfo.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(checkAuthSession.fulfilled, (state, action) => {
        state.employee = action.payload?.employee || null;
      })
      .addCase(checkAuthSession.rejected, (state) => {
        state.employee = null;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.employee = null;
      })
      .addCase(logoutUser.rejected, (state) => {
        state.employee = null;
      })
      .addCase(setUser, (state, action) => {
        if (action.payload === null) {
          state.employee = null;
        } else if (isEmployeeProfile(action.payload)) {
          // Merge into existing employee so sub-fields like phone1, address,
          // nationalId, financialDetails etc. are not wiped out.
          state.employee = state.employee
            ? { ...state.employee, ...action.payload }
            : action.payload;
        }
      })

      // Update employee status cases
      .addCase(updateEmployeeStatus.pending, (state) => {
        state.updatingStatus = true;
        state.statusUpdateError = null;
      })
      .addCase(updateEmployeeStatus.fulfilled, (state, action) => {
        state.updatingStatus = false;
        state.employee = action.payload;
      })
      .addCase(updateEmployeeStatus.rejected, (state, action) => {
        state.updatingStatus = false;
        state.statusUpdateError = action.payload;
      })

      // Update employee info cases
      .addCase(updateEmployeeInfo.pending, (state) => {
        state.updatingInfo = true;
      })
      .addCase(updateEmployeeInfo.fulfilled, (state, action) => {
        state.updatingInfo = false;
        state.employee = action.payload;
      })
      .addCase(updateEmployeeInfo.rejected, (state, action) => {
        state.updatingInfo = false;
        state.error = action.payload;
      })

      // Update employee work info cases
      .addCase(updateEmployeeWorkInfo.pending, (state) => {
        state.updatingWorkInfo = true;
        state.workInfoError = null;
      })
      .addCase(updateEmployeeWorkInfo.fulfilled, (state, action) => {
        state.updatingWorkInfo = false;
        state.employee = action.payload;
      })
      .addCase(updateEmployeeWorkInfo.rejected, (state, action) => {
        state.updatingWorkInfo = false;
        state.workInfoError = action.payload;
      })

      .addCase(updateEmployeePayrollSettings.pending, (state) => {
        state.updatingPayrollSettings = true;
        state.payrollSettingsError = null;
      })
      .addCase(updateEmployeePayrollSettings.fulfilled, (state, action) => {
        state.updatingPayrollSettings = false;
        state.employee = action.payload;
      })
      .addCase(updateEmployeePayrollSettings.rejected, (state, action) => {
        state.updatingPayrollSettings = false;
        state.payrollSettingsError = action.payload;
      })

      // Add academic record cases
      .addCase(addAcademicRecord.pending, (state) => {
        state.addingRecord = true;
      })
      .addCase(addAcademicRecord.fulfilled, (state, action) => {
        state.addingRecord = false;
        state.employee = action.payload;
      })
      .addCase(addAcademicRecord.rejected, (state, action) => {
        state.addingRecord = false;
        state.error = action.payload;
      })
      .addCase(updateAcademicRecord.pending, (state) => {
        state.addingRecord = true;
      })
      .addCase(updateAcademicRecord.fulfilled, (state, action) => {
        state.addingRecord = false;
        state.employee = action.payload;
      })
      .addCase(updateAcademicRecord.rejected, (state, action) => {
        state.addingRecord = false;
        state.error = action.payload;
      })
      .addCase(deleteAcademicRecord.pending, (state) => {
        state.addingRecord = true;
      })
      .addCase(deleteAcademicRecord.fulfilled, (state, action) => {
        state.addingRecord = false;
        state.employee = action.payload;
      })
      .addCase(deleteAcademicRecord.rejected, (state, action) => {
        state.addingRecord = false;
        state.error = action.payload;
      })

      // Add guarantor details cases
      .addCase(addGuarantor.pending, (state) => {
        state.updatingGuarantor = true;
        state.guarantorError = null;
      })
      .addCase(addGuarantor.fulfilled, (state, action) => {
        state.addingGuarantor = false;
        if (state.employee) {
          // Ensure we're properly merging the new guarantor with existing ones
          state.employee.guarantors = action.payload;
          // Or if the response returns just the new guarantor:
          // state.employee.guarantors = [...(state.employee.guarantors || []), action.payload];
        }
      })
      .addCase(addGuarantor.rejected, (state, action) => {
        state.updatingGuarantor = false;
        state.guarantorError = action.payload;
      })

      // Add professional qualification cases
      .addCase(addProfessionalQualification.pending, (state) => {
        state.addingQualification = true;
      })
      .addCase(addProfessionalQualification.fulfilled, (state, action) => {
        state.addingQualification = false;
        if (state.employee) {
          state.employee.professionalQualifications = action.payload;
        }
      })
      .addCase(addProfessionalQualification.rejected, (state, action) => {
        state.addingQualification = false;
        state.error = action.payload;
      })
      .addCase(updateProfessionalQualification.pending, (state) => {
        state.addingQualification = true;
      })
      .addCase(updateProfessionalQualification.fulfilled, (state, action) => {
        state.addingQualification = false;
        if (state.employee) {
          state.employee.professionalQualifications = action.payload.professionalQualifications;
        }
      })
      .addCase(updateProfessionalQualification.rejected, (state, action) => {
        state.addingQualification = false;
        state.error = action.payload;
      })
      .addCase(deleteProfessionalQualification.pending, (state) => {
        state.addingQualification = true;
      })
      .addCase(deleteProfessionalQualification.fulfilled, (state, action) => {
        state.addingQualification = false;
        if (state.employee) {
          state.employee.professionalQualifications = action.payload.professionalQualifications;
        }
      })
      .addCase(deleteProfessionalQualification.rejected, (state, action) => {
        state.addingQualification = false;
        state.error = action.payload;
      })

      .addCase(addProfessionalExperience.pending, (state) => {
        state.addingProfessionalExperience = true;
      })
      .addCase(addProfessionalExperience.fulfilled, (state, action) => {
        state.addingProfessionalExperience = false;
        if (state.employee) {
          state.employee.professionalExperience = action.payload;
        }
      })
      .addCase(addProfessionalExperience.rejected, (state, action) => {
        state.addingProfessionalExperience = false;
        state.error = action.payload;
      })
      .addCase(updateProfessionalExperience.pending, (state) => {
        state.addingProfessionalExperience = true;
      })
      .addCase(updateProfessionalExperience.fulfilled, (state, action) => {
        state.addingProfessionalExperience = false;
        if (state.employee) {
          state.employee.professionalExperience = action.payload.professionalExperience;
        }
      })
      .addCase(updateProfessionalExperience.rejected, (state, action) => {
        state.addingProfessionalExperience = false;
        state.error = action.payload;
      })
      .addCase(deleteProfessionalExperience.pending, (state) => {
        state.addingProfessionalExperience = true;
      })
      .addCase(deleteProfessionalExperience.fulfilled, (state, action) => {
        state.addingProfessionalExperience = false;
        if (state.employee) {
          state.employee.professionalExperience = action.payload.professionalExperience;
        }
      })
      .addCase(deleteProfessionalExperience.rejected, (state, action) => {
        state.addingProfessionalExperience = false;
        state.error = action.payload;
      })

      // Add next of kin cases
      .addCase(addNextOfKin.pending, (state) => {
        state.addingNextOfKin = true;
      })
      .addCase(addNextOfKin.fulfilled, (state, action) => {
        state.addingNextOfKin = false;
        if (state.employee) {
          state.employee.nextOfKins = action.payload.nextOfKins;
        }
      })
      .addCase(addNextOfKin.rejected, (state, action) => {
        state.addingNextOfKin = false;
        state.error = action.payload;
      })

      // Add family detail cases
      .addCase(addFamilyDetail.pending, (state) => {
        state.addingFamilyDetail = true;
      })
      .addCase(addFamilyDetail.fulfilled, (state, action) => {
        state.addingFamilyDetail = false;
        state.employee = action.payload;
      })
      .addCase(addFamilyDetail.rejected, (state, action) => {
        state.addingFamilyDetail = false;
        state.error = action.payload;
      })

      // Update family detail cases
      .addCase(updateFamilyDetail.pending, (state) => {
        state.updatingFamilyDetail = true;
      })
      .addCase(updateFamilyDetail.fulfilled, (state, action) => {
        state.updatingFamilyDetail = false;
        state.employee = action.payload;
      })
      .addCase(updateFamilyDetail.rejected, (state, action) => {
        state.updatingFamilyDetail = false;
        state.error = action.payload;
      })

      // Update financial details cases
      .addCase(updateFinancialDetails.pending, (state) => {
        state.updatingFinancialDetails = true;
      })
      .addCase(updateFinancialDetails.fulfilled, (state, action) => {
        state.updatingFinancialDetails = false;
        const {
          taxRegimeRequest: _taxRegimeRequest,
          taxRegimeRequestPending: _taxRegimeRequestPending,
          message: _message,
          ...employeePayload
        } = action.payload || {};
        state.employee = employeePayload;
      })
      .addCase(updateFinancialDetails.rejected, (state, action) => {
        state.updatingFinancialDetails = false;
        state.error = action.payload;
      })

      .addCase(fetchTaxDeclaration.pending, (state) => {
        state.loadingTaxDeclaration = true;
      })
      .addCase(fetchTaxDeclaration.fulfilled, (state, action) => {
        state.loadingTaxDeclaration = false;
        state.taxDeclaration = action.payload;
      })
      .addCase(fetchTaxDeclaration.rejected, (state, action) => {
        state.loadingTaxDeclaration = false;
        state.error = action.payload;
      })

      .addCase(updateTaxDeclaration.pending, (state) => {
        state.updatingTaxDeclaration = true;
      })
      .addCase(updateTaxDeclaration.fulfilled, (state, action) => {
        state.updatingTaxDeclaration = false;
        state.employee = action.payload.employee;
        state.taxDeclaration = action.payload.taxDeclaration;
      })
      .addCase(updateTaxDeclaration.rejected, (state, action) => {
        state.updatingTaxDeclaration = false;
        state.error = action.payload;
      });
  }
});

export const { clearEmployeeDetails, setEmployeeProfile } = employeeDetailsSlice.actions;
export default employeeDetailsSlice.reducer;