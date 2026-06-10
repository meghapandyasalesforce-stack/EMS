import axios from './axios';
import { inferSystemRoleFromWorkInfo } from './inferSystemRole';
import { DEFAULT_SYSTEM_ROLE } from './systemRoles';

export const fetchSuggestedSystemRole = async ({ department, jobTitle, position } = {}) => {
  try {
    const res = await axios.get('/v1/admin/platform-roles/suggest', {
      params: { department, jobTitle, position },
      withCredentials: true,
    });
    const data = res.data?.data || res.data;
    return {
      systemRoleId: data.systemRoleId || DEFAULT_SYSTEM_ROLE,
      reason: data.reason || null,
      label: data.label || data.shortLabel || null,
    };
  } catch {
    const fallback = inferSystemRoleFromWorkInfo({ department, jobTitle, position });
    return {
      systemRoleId: fallback.systemRoleId,
      reason: fallback.reason,
      label: null,
    };
  }
};

export const fetchEmployeeAccess = async (employeeId) => {
  const res = await axios.get(`/v1/admin/platform-roles/employees/${employeeId}/access`, {
    withCredentials: true,
  });
  return res.data?.data || res.data;
};

export const assignEmployeeSystemRole = async (employeeId, systemRole) => {
  const res = await axios.patch(
    `/v1/admin/platform-roles/employees/${employeeId}/system-role`,
    { systemRole },
    { withCredentials: true }
  );
  return res.data?.data || res.data;
};
