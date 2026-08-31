

// Base API URL from environment or default
// Use relative paths so axios instance baseURL is used (includes Authorization header)
// Note: axios baseURL already includes '/api', so we use '/v1' here
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/v1';

//==================Organization===================//

export const ORGANIZATION_ENDPOINT = `${BASE_URL}/admin/organization`
export const ORGANIZATION_AUTH_ENDPOINT = `${BASE_URL}/organization/auth`
export const ORGANIZATION_SUBSCRIPTION_ENDPOINT = `${BASE_URL}/organization/subscription`
export const ORGANIZATION_POLICIES_ENDPOINT = `${BASE_URL}/organization/policies`
export const ORGANIZATION_DASHBOARD_ENDPOINT = `${BASE_URL}/organization/dashboard`

//==================Admin===================//

export const ADMIN_AUTH_ENDPOINT = `${BASE_URL}/admin/auth`
export const ADMIN_LEAVE_ENDPOINT = `${BASE_URL}/admin/leave`
export const ADMIN_PROJECT_ENDPOINT = `${BASE_URL}/admin/project`
export const ADMIN_PAYROLL_ENDPOINT = `${BASE_URL}/admin/payroll`
export const ADMIN_EMPLOYEE_ENDPOINT = `${BASE_URL}/admin/employee`
/** HR / admin document library (upload company docs, etc.) */
export const ADMIN_DOCUMENTS_ENDPOINT = `${BASE_URL}/admin/documents`


//==================Employee===================//

export const EMPLOYEE_AUTH_ENDPOINT = `${BASE_URL}/employee/auth`
export const EMPLOYEE_LEAVE_ENDPOINT = `${BASE_URL}/employee/leave`


//==================Both===================//
export const UNIFIED_AUTH_ENDPOINT = `${BASE_URL}/both/auth`
export const BOTH_PROFILE_ENDPOINT = `${BASE_URL}/both/profile-details`
export const BOTH_NOTIFICATION_ENDPOINT = `${BASE_URL}/both/notification`
export const BOTH_PUSH_SUBSCRIPTION_ENDPOINT = `${BASE_URL}/both/push-subscription`
export const BOTH_ATTENDANCE_ENDPOINT = `${BASE_URL}/both/attendance`
export const BOTH_DOCUMENT_ENDPOINT = `${BASE_URL}/both/document`
/** Canonical document library (employee uploads, HR list) */
export const BOTH_DOCUMENTS_ENDPOINT = `${BASE_URL}/both/documents`
export const BOTH_ONBOARDING_ENDPOINT = `${BASE_URL}/both/onboarding`
export const ADMIN_ONBOARDING_ENDPOINT = `${BASE_URL}/admin/onboarding`
export const ADMIN_LIFECYCLE_ENDPOINT = `${BASE_URL}/admin/lifecycle`
export const BOTH_LIFECYCLE_ENDPOINT = `${BASE_URL}/both/lifecycle`
export const PUBLIC_LIFECYCLE_ENDPOINT = `${BASE_URL}/public/lifecycle`
export const BOTH_OFFBOARDING_ENDPOINT = `${BOTH_ONBOARDING_ENDPOINT}/offboarding`
export const ADMIN_OFFBOARDING_ENDPOINT = `${ADMIN_ONBOARDING_ENDPOINT}/offboarding`
export const BOTH_PASSWORD_ENDPOINT = `${BASE_URL}/both/password`
export const BOTH_TASK_ENDPOINT = `${BASE_URL}/both/project-task`
export const BOTH_CELEBRATION_ENDPOINT = `${BASE_URL}/both/celebrations`
/** Separate employee document request & generation workflow */
export const BOTH_EMPLOYEE_DOCUMENT_REQUEST_ENDPOINT = `${BASE_URL}/both/employee-document-requests`
/** Document templates (Admin CRUD + Employee self-service access) */
export const BOTH_DOCUMENT_TEMPLATES_ENDPOINT = `${BASE_URL}/both/document-templates`
/** Self-service document generation (preview, generate PDF, download) */
export const BOTH_SELF_SERVICE_DOCUMENTS_ENDPOINT = `${BASE_URL}/both/self-service-documents`





