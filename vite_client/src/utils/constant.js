

// Base API URL from environment or default
// Use relative paths so axios instance baseURL is used (includes Authorization header)
// Note: axios baseURL already includes '/api', so we use '/v1' here
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/v1';

//==================Admin===================//

export const ADMIN_AUTH_ENDPOINT = `${BASE_URL}/admin/auth`
export const ADMIN_LEAVE_ENDPOINT = `${BASE_URL}/admin/leave`
export const ADMIN_PROJECT_ENDPOINT = `${BASE_URL}/admin/project`
export const ADMIN_PAYROLL_ENDPOINT = `${BASE_URL}/admin/payroll`


//==================Employee===================//

export const EMPLOYEE_AUTH_ENDPOINT = `${BASE_URL}/employee/auth`
export const EMPLOYEE_LEAVE_ENDPOINT = `${BASE_URL}/employee/leave`


//==================Both===================//
export const BOTH_PROFILE_ENDPOINT = `${BASE_URL}/both/profile-details`
export const BOTH_NOTIFICATION_ENDPOINT = `${BASE_URL}/both/notification`
export const BOTH_ATTENDANCE_ENDPOINT = `${BASE_URL}/both/attendance`
export const BOTH_DOCUMENT_ENDPOINT = `${BASE_URL}/both/document`
export const BOTH_PASSWORD_ENDPOINT = `${BASE_URL}/both/password`
export const BOTH_TASK_ENDPOINT = `${BASE_URL}/both/project-task`





