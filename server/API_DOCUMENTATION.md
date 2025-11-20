# API Documentation

## Base URL
- **Development:** `http://localhost:5000/api`
- **Production:** Set via `VITE_API_URL` or `VITE_BACKEND_URL` environment variable

## Authentication

All protected endpoints require authentication via JWT access token. The token can be provided in two ways:
1. **Cookie:** `jwt` cookie (for same-site requests)
2. **Header:** `Authorization: Bearer <access-token>` (for cross-site requests)

**Token Expiration:**
- **Access Token:** Expires after 1 hour (configurable via `JWT_ACCESS_EXPIRE` environment variable)
- **Refresh Token:** Expires after 30 days (configurable via `JWT_REFRESH_EXPIRE` environment variable)

**Token Refresh:**
When an access token expires (401 error), clients should automatically refresh it using the refresh token endpoint:
- **Employee:** `POST /api/v1/employee/auth/refresh-token`
- **Admin:** `POST /api/v1/admin/auth/refresh-token`

The frontend axios interceptor handles token refresh automatically. Refresh tokens can be provided via:
- **Cookie:** `refreshToken` cookie (HttpOnly, secure)
- **Header:** `Authorization: Bearer <refresh-token>`
- **localStorage:** `refreshToken` (for cross-site scenarios)

For state-changing requests (POST, PUT, PATCH, DELETE), a CSRF token is also required:
- **Header:** `X-CSRF-Token: <csrf-token>`

---

## Response Format

All API responses follow a standardized format:

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### Common Error Codes
- `NO_TOKEN` - Authentication token missing
- `INVALID_TOKEN` - Invalid or expired token
- `UNAUTHORIZED` - Not authorized to access resource
- `FORBIDDEN` - Access denied
- `VALIDATION_ERROR` - Input validation failed
- `NOT_FOUND` - Resource not found
- `DUPLICATE_EMAIL` - Email already exists
- `INTERNAL_ERROR` - Server error

---

## Authentication Endpoints

### Employee Authentication

#### Register Employee
**POST** `/api/v1/employee/auth/register`

**Request Body:**
```json
{
  "name": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "password": "optional", // Auto-generated if not provided
  "position": "Senior",
  "department": "Engineering",
  "manager": "Jane Smith",
  "jobTitle": "Software Engineer",
  "jobCategory": "Information Technology",
  "salary": 75000
}
```

**Response:**
```json
{
  "success": true,
  "message": "Employee registered successfully",
  "emailSent": true,
  "token": "jwt_access_token",
  "refreshToken": "jwt_refresh_token",
  "csrfToken": "csrf_token",
  "employee": { ... }
}
```

#### Login Employee
**POST** `/api/v1/employee/auth/login`

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "jwt_access_token",
  "refreshToken": "jwt_refresh_token",
  "csrfToken": "csrf_token",
  "employee": { ... }
}
```

#### Refresh Access Token
**POST** `/api/v1/employee/auth/refresh-token`

**Headers:** `Authorization: Bearer <refresh-token>` (optional, can also use `refreshToken` cookie)

**Description:** Refreshes the access token using a valid refresh token. Access tokens expire after 1 hour (configurable), while refresh tokens last 30 days.

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "token": "new_jwt_access_token",
  "csrfToken": "new_csrf_token"
}
```

**Error Responses:**
- `401` - Refresh token expired or invalid
- `403` - Account inactive

#### Logout Employee
**POST** `/api/v1/employee/auth/logout`

**Response:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

#### Reset Employee Password
**PATCH** `/api/v1/employee/auth/reset-password`

**Headers:** `Authorization: Bearer <token>`, `X-CSRF-Token: <csrf-token>`

**Request Body:**
```json
{
  "newPassword": "newSecurePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successful. Please login with your new password.",
  "logout": true
}
```

---

### Admin Authentication

#### Register Admin
**POST** `/api/v1/admin/auth/register`

**Request Body:**
```json
{
  "name": "Admin",
  "email": "admin@example.com",
  "password": "securePassword123"
}
```

#### Login Admin
**POST** `/api/v1/admin/auth/login`

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "jwt_access_token",
  "refreshToken": "jwt_refresh_token",
  "csrfToken": "csrf_token",
  "user": { ... }
}
```

#### Refresh Access Token
**POST** `/api/v1/admin/auth/refresh-token`

**Headers:** `Authorization: Bearer <refresh-token>` (optional, can also use `refreshToken` cookie)

**Description:** Refreshes the access token using a valid refresh token. Access tokens expire after 1 hour (configurable), while refresh tokens last 30 days.

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "token": "new_jwt_access_token",
  "csrfToken": "new_csrf_token"
}
```

**Error Responses:**
- `401` - Refresh token expired or invalid
- `403` - Account inactive

---

## Employee Management (Admin Only)

### Get All Employees
**GET** `/api/v1/employee/auth/get-all-employees`

**Headers:** `Authorization: Bearer <token>`, `X-CSRF-Token: <csrf-token>`

**Response:**
```json
{
  "success": true,
  "message": "Employees retrieved successfully",
  "employees": [ ... ]
}
```

### Update Employee Status
**PATCH** `/api/v1/both/profile-details/admin/update-status/:employeeId`

**Headers:** `Authorization: Bearer <token>`, `X-CSRF-Token: <csrf-token>`

**Request Body:**
```json
{
  "active": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Employee activated successfully",
  "employee": { ... }
}
```

### Delete Employee
**DELETE** `/api/v1/employee/auth/delete-employee/:employeeId`

**Headers:** `Authorization: Bearer <token>`, `X-CSRF-Token: <csrf-token>`

**Response:**
```json
{
  "success": true,
  "message": "Employee deleted successfully"
}
```

---

## Email Configuration

### Get Email Status
**GET** `/api/v1/both/email/status`

**Headers:** `Authorization: Bearer <admin-token>`, `X-CSRF-Token: <csrf-token>`

**Response:**
```json
{
  "success": true,
  "configured": true,
  "validated": true,
  "provider": "Gmail",
  "emailHost": "gmail (service)",
  "emailPort": "N/A (service)",
  "emailFrom": "user@***",
  "emailUser": "user@***",
  "hasPassword": true,
  "validationMessage": "Email configuration is valid"
}
```

### Test Email
**POST** `/api/v1/both/email/test`

**Headers:** `Authorization: Bearer <admin-token>`, `X-CSRF-Token: <csrf-token>`

**Request Body:**
```json
{
  "testEmail": "test@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Test email sent successfully. Please check your inbox.",
  "testEmail": "test@example.com"
}
```

### Validate Email Configuration
**POST** `/api/v1/both/email/validate`

**Headers:** `Authorization: Bearer <admin-token>`, `X-CSRF-Token: <csrf-token>`

**Response:**
```json
{
  "success": true,
  "message": "Email configuration is valid",
  "details": {
    "provider": "Gmail",
    "emailHost": "gmail (service)",
    "emailPort": "N/A"
  }
}
```

---

## Rate Limiting

- **Login/Register endpoints:** Limited to prevent brute force attacks
- **General API:** 100 requests per 15 minutes per IP

---

## Error Handling

All errors follow the standardized format:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

---

## Notes

- All timestamps are in ISO 8601 format
- All IDs are MongoDB ObjectIds
- Passwords are never returned in responses
- Email addresses are case-insensitive
- CSRF tokens are required for all state-changing operations

---

## Environment Variables

### Required
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens (min 32 characters)
- `EMAIL_USER` or `EMAIL_USERNAME` - Email account username
- `EMAIL_PASS` or `EMAIL_PASSWORD` - Email account password

### Optional
- `EMAIL_HOST` - SMTP host (not needed for Gmail)
- `EMAIL_PORT` - SMTP port (default: 587)
- `FRONTEND_URL` - Frontend URL for CORS
- `CROSS_SITE_COOKIES` - Set to "true" for cross-site cookie support
- `JWT_ACCESS_EXPIRE` - Access token expiration time (default: "1h"). Examples: "15m", "1h", "2h"
- `JWT_REFRESH_EXPIRE` - Refresh token expiration time (default: "30d"). Examples: "7d", "30d", "90d"

---

**Last Updated:** 2025-01-10

