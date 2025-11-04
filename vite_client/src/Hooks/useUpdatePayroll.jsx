import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';
import { updatePayroll } from '../context/payrollSlice'; // Ensure this exists
import { ADMIN_PAYROLL_ENDPOINT } from './../utils/constant';

const useUpdatePayroll = () => {
  const dispatch = useDispatch();
const employeesObj = useSelector((state) => state.employees?.employees?.employees || {});
const employees = employeesObj ? Object.values(employeesObj) : [];



  const updateEmployeePayroll = async (payrollId, payrollData) => {
    console.log(`Updating payroll for payroll ID: ${payrollId}`, payrollData);

    try {
      const res = await axios.put(
        `${ADMIN_PAYROLL_ENDPOINT}/update-payroll/${payrollId}`,
        payrollData,
        {
          withCredentials: true,
        }
      );

      // Handle new API response format (with success field)
      if (res.data?.success) {
        const updatedPayroll = res.data.data || res.data;
        dispatch(updatePayroll(updatedPayroll));
        return { success: true, payroll: updatedPayroll };
      } else if (res.data?.updatedPayroll) {
        // Handle old format for backward compatibility
        dispatch(updatePayroll(res.data.updatedPayroll));
        return { success: true, payroll: res.data.updatedPayroll };
      } else if (res.data) {
        // Direct data response
        dispatch(updatePayroll(res.data));
        return { success: true, payroll: res.data };
      } else {
        console.error("Unexpected response:", res.data);
        return { success: false, error: "Invalid response structure" };
      }
    } catch (error) {
      console.error("Error updating payroll:", error);
      return { 
        success: false, 
        error: error.response?.data?.message || error.message || "Failed to update payroll" 
      };
    }
  };

  return { employees, updateEmployeePayroll };
};

export default useUpdatePayroll;
