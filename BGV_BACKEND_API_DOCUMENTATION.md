# Enterprise Background Verification (BGV) Backend API Documentation

## Overview

This document describes the complete BGV backend API for employee and HR workflows. All endpoints require authentication and organization context.

## Feature Toggle

All BGV endpoints are gated by the `backgroundVerification` feature toggle. When disabled:
- Endpoints return `{ enabled: false, message: 'Background verification is disabled...' }`
- Historical data is preserved but marked as inactive
- No new BGV cases can be created

---

## Employee Endpoints

### Base URL: `/api/lifecycle/employee`

### 1. Get Employee BGV Dashboard
**GET** `/employee/bgv/dashboard`

Returns comprehensive metrics for the employee's BGV case.

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "hasBgvCase": true,
    "bgvCaseId": "string",
    "overallStatus": "In Progress",
    "totalVerifications": 6,
    "pending": 2,
    "submitted": 1,
    "underReview": 2,
    "verified": 1,
    "rejected": 0,
    "completionPercentage": 16,
    "checks": [
      {
        "checkId": "string",
        "checkType": "employment|education|address|reference|criminal|identity",
        "label": "string",
        "status": "Not Started|Pending Employee Submission|Draft Saved|Submitted|Under HR Review|Additional Information Required|Resubmitted|Verification In Progress|Verified|Rejected",
        "mandatory": true,
        "requiredDocuments": [{ "name": "string", "required": true }],
        "uploadedDocuments": [],
        "submittedAt": "ISODate",
        "lastUpdated": "ISODate",
        "verificationData": {},
        "employeeNotes": "string",
        "hrNotes": "string",
        "infoRequest": { "request": "string", "requestedAt": "ISODate" },
        "canSubmit": true,
        "canEdit": true,
        "canResubmit": true
      }
    ],
    "activityFeed": []
  }
}
```

### 2. Get Employee BGV Case (Real-time)
**GET** `/employee/onboarding/:workflowId/bgv`

Returns the employee's BGV case with enriched data for real-time updates.

**Response:**
```json
{
  "success": true,
  "data": {
    "checks": [
      {
        "checkType": "string",
        "status": "string",
        "requiredDocuments": [],
        "uploadedDocuments": [],
        "pendingDocuments": 0,
        "progress": 50,
        "hrRemarks": "string",
        "infoRequest": {},
        "infoResponse": {},
        "lastUpdated": "ISODate",
        "activityTimeline": []
      }
    ],
    "overallProgress": 50,
    "summary": {
      "completed": 1,
      "pending": 3,
      "rejected": 0,
      "awaitingUpload": 2
    }
  }
}
```

### 3. Save Employment Draft
**POST** `/employee/bgv/:bgvCaseId/checks/:checkId/draft/employment`

Save employment verification data as draft.

**Request Body:**
```json
{
  "previousCompany": "string",
  "designation": "string",
  "joiningDate": "ISODate",
  "relievingDate": "ISODate",
  "hrContact": "string",
  "salary": "number",
  "reasonForLeaving": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* updated BGV case */ },
  "message": "Employment draft saved"
}
```

### 4. Save Education Draft
**POST** `/employee/bgv/:bgvCaseId/checks/:checkId/draft/education`

Save education verification data (multiple records) as draft.

**Request Body:**
```json
{
  "educationRecords": [
    {
      "institution": "string",
      "degree": "string",
      "field": "string",
      "startDate": "ISODate",
      "endDate": "ISODate",
      "grade": "string"
    }
  ]
}
```

### 5. Save Address Draft
**POST** `/employee/bgv/:bgvCaseId/checks/:checkId/draft/address`

Save address verification data as draft.

**Request Body:**
```json
{
  "currentAddress": {
    "line1": "string",
    "line2": "string",
    "city": "string",
    "state": "string",
    "pincode": "string",
    "country": "string"
  },
  "permanentAddress": {
    "line1": "string",
    "line2": "string",
    "city": "string",
    "state": "string",
    "pincode": "string",
    "country": "string"
  }
}
```

### 6. Upload Document
**POST** `/employee/bgv/:bgvCaseId/checks/:checkId/documents`

Upload a document for a verification check.

**Request Body:**
```json
{
  "documentUrl": "string",
  "documentName": "string",
  "documentType": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* updated BGV case */ },
  "message": "Document uploaded"
}
```

### 7. Delete Document
**DELETE** `/employee/bgv/:bgvCaseId/checks/:checkId/documents/:documentId`

Delete a document before submission (only allowed if check not submitted).

### 8. Replace Document
**PUT** `/employee/bgv/:bgvCaseId/checks/:checkId/documents/:documentId`

Replace an uploaded document (creates version history).

**Request Body:**
```json
{
  "documentUrl": "string",
  "documentName": "string",
  "documentType": "string"
}
```

### 9. Submit Check for Review
**POST** `/employee/bgv/:bgvCaseId/checks/:checkId/submit`

Submit a verification check for HR review.

**Request Body:**
```json
{
  "notes": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* updated BGV case */ },
  "message": "Check submitted for review"
}
```

### 10. Respond to Info Request
**POST** `/employee/bgv/:bgvCaseId/checks/:checkId/info-response`

Respond to HR's additional information request.

**Request Body:**
```json
{
  "response": "string",
  "documents": [{ "url": "string", "name": "string", "type": "string" }]
}
```

### 11. Add Reference (Reference Check)
**POST** `/employee/bgv/:bgvCaseId/checks/:checkId/references`

Add a reference for reference check.

**Request Body:**
```json
{
  "name": "string",
  "company": "string",
  "designation": "string",
  "relationship": "string",
  "phone": "string",
  "email": "string"
}
```

### 12. Update Reference
**PUT** `/employee/bgv/:bgvCaseId/checks/:checkId/references/:referenceId`

Update an existing reference.

### 13. Delete Reference
**DELETE** `/employee/bgv/:bgvCaseId/checks/:checkId/references/:referenceId`

Delete a reference.

### 14. Accept Criminal Declaration
**POST** `/employee/bgv/:bgvCaseId/checks/:checkId/declaration`

Accept/decline criminal verification declaration.

**Request Body:**
```json
{
  "accepted": true
}
```

---

## HR/Admin Endpoints

### Base URL: `/api/lifecycle`

### 1. Get HR BGV Dashboard
**GET** `/bgv/hr/dashboard`

Returns comprehensive HR dashboard with all cases and analytics.

**Query Parameters:**
- `status`: Filter by overall status
- `department`: Filter by department
- `vendor`: Filter by vendor
- `assignedTo`: Filter by assigned HR

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "summary": {
      "totalCases": 100,
      "pendingReviews": 25,
      "overdue": 5,
      "awaitingEmployee": 15,
      "verifiedToday": 10,
      "rejectedToday": 2
    },
    "departmentBreakdown": [
      {
        "department": "Engineering",
        "total": 30,
        "pending": 10,
        "verified": 15,
        "rejected": 2,
        "inProgress": 3
      }
    ],
    "vendorBreakdown": [
      {
        "vendor": "springverify",
        "total": 50,
        "pending": 15,
        "verified": 30,
        "rejected": 3,
        "inProgress": 2
      }
    ],
    "avgCompletionDays": 7.5,
    "cases": [
      {
        "_id": "string",
        "employee": { /* employee details */ },
        "overallStatus": "string",
        "vendor": "string",
        "assignedHr": { /* HR details */ },
        "dueDate": "ISODate",
        "createdAt": "ISODate",
        "completedAt": "ISODate",
        "priority": "Normal|High|Low",
        "slaBreached": false,
        "checks": [
          {
            "checkId": "string",
            "checkType": "string",
            "label": "string",
            "status": "string",
            "mandatory": true,
            "submittedAt": "ISODate",
            "lastUpdated": "ISODate",
            "canVerify": true,
            "canRequestInfo": true,
            "canAssignVendor": true
          }
        ]
      }
    ]
  }
}
```

### 2. Get HR BGV Case Detail
**GET** `/bgv/hr/:id/detail`

Get detailed BGV case for HR review with all verification sections.

**Response:**
```json
{
  "success": true,
  "data": {
    "bgvCase": { /* full BGV case */ },
    "employee": { /* employee details */ },
    "checks": [
      {
        "checkId": "string",
        "checkType": "string",
        "label": "string",
        "status": "string",
        "mandatory": true,
        "verificationData": {},
        "documents": [
          {
            "_id": "string",
            "url": "string",
            "name": "string",
            "type": "string",
            "uploadedAt": "ISODate",
            "uploadedBy": "string",
            "uploadedByName": "string",
            "status": "Uploaded",
            "version": 1,
            "versionHistory": [],
            "ocrStatus": "Pending|Processing|Completed|Failed",
            "ocrData": {},
            "ocrProcessedAt": "ISODate",
            "matchStatus": "Pending|Matched|Not Matched",
            "matchScore": 0.95,
            "matchProcessedAt": "ISODate"
          }
        ],
        "submittedAt": "ISODate",
        "submittedBy": "string",
        "employeeNotes": "string",
        "hrNotes": "string",
        "infoRequest": {},
        "infoResponse": {},
        "verifiedAt": "ISODate",
        "verifiedBy": "string",
        "references": [],
        "declarationAccepted": true,
        "vendorReport": { "url": "string", "name": "string", "uploadedAt": "ISODate" },
        "internalNotes": [],
        "timeline": [],
        "canVerify": true,
        "canRequestInfo": true,
        "canAssignVendor": true
      }
    ],
    "activityFeed": [],
    "timeline": []
  }
}
```

### 3. Verify/Reject Check
**POST** `/bgv/:id/checks/:checkId/verify`

Verify or reject a verification check.

**Request Body:**
```json
{
  "verified": true,
  "notes": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* updated BGV case */ },
  "message": "Check verified" // or "Check rejected"
}
```

### 4. Request Additional Information
**POST** `/bgv/:id/checks/:checkId/request-info`

Request additional information from employee.

**Request Body:**
```json
{
  "request": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* updated BGV case */ },
  "message": "Additional information requested"
}
```

### 5. Add HR Remarks
**POST** `/bgv/hr/:id/checks/:checkId/remarks`

Add remarks visible to employee.

**Request Body:**
```json
{
  "remarks": "string"
}
```

### 6. Add Internal Note
**POST** `/bgv/hr/:id/checks/:checkId/internal-notes`

Add internal note (HR-only visibility).

**Request Body:**
```json
{
  "note": "string"
}
```

### 7. Update Verification Details
**PUT** `/bgv/hr/:id/checks/:checkId/verification-details`

Update verification data for a check.

**Request Body:**
```json
{
  "verificationData": {}
}
```

### 8. Update Reference Contact Status
**PUT** `/bgv/hr/:id/checks/:checkId/references/:referenceId/contact`

Update reference contact status for reference check.

**Request Body:**
```json
{
  "contactStatus": "Not Contacted|Attempted|Contacted|Verified|Unreachable",
  "notes": "string"
}
```

### 9. Upload Vendor Report
**POST** `/bgv/hr/:id/checks/:checkId/vendor-report`

Upload vendor verification report.

**Request Body:**
```json
{
  "reportUrl": "string",
  "reportName": "string"
}
```

### 10. Update Document OCR Status
**PUT** `/bgv/:id/checks/:checkId/documents/:documentId/ocr`

Update OCR processing status for a document.

**Request Body:**
```json
{
  "ocrStatus": "Pending|Processing|Completed|Failed",
  "ocrData": {}
}
```

### 11. Update Document Match Status
**PUT** `/bgv/:id/checks/:checkId/documents/:documentId/match`

Update document match status for verification.

**Request Body:**
```json
{
  "matchStatus": "Pending|Matched|Not Matched",
  "matchScore": 0.95
}
```

### 12. Generate BGV Report
**POST** `/bgv/hr/reports`

Generate BGV reports with filters.

**Request Body:**
```json
{
  "reportType": "summary|detailed|department|vendor",
  "filters": {
    "department": "string",
    "status": "string",
    "startDate": "ISODate",
    "endDate": "ISODate"
  }
}
```

### 13. HR Draft Save (Assist Employee)
**POST** `/bgv/:id/checks/:checkId/draft/employment`
**POST** `/bgv/:id/checks/:checkId/draft/education`
**POST** `/bgv/:id/checks/:checkId/draft/address`

HR can save drafts on behalf of employee (same request body as employee endpoints).

### 14. List BGV Cases
**GET** `/bgv`

List all BGV cases with optional filters.

**Query Parameters:**
- `employeeId`: Filter by employee
- `candidateId`: Filter by candidate
- `status`: Filter by status
- `onboardingWorkflowId`: Filter by workflow

### 15. Create BGV Case
**POST** `/bgv`

Create a new BGV case.

**Request Body:**
```json
{
  "subjectType": "employee|candidate",
  "candidateId": "string",
  "employeeId": "string",
  "onboardingWorkflowId": "string",
  "checkTypes": ["employment", "education"]
}
```

### 16. Update BGV Check Status
**PATCH** `/bgv/:id/checks/:checkId`

Direct status update for a check.

**Request Body:**
```json
{
  "status": "Clear|Failed|Waived",
  "notes": "string",
  "resultSummary": "string"
}
```

### 17. Sync Vendor Case
**POST** `/bgv/:id/sync`

Sync BGV case with external vendor.

### 18. Track Timeline
**POST** `/bgv/:id/timeline`

Add timeline milestone.

**Request Body:**
```json
{
  "milestone": "initiated|submitted|verified|rejected|completed"
}
```

### 19. Initiate Approval
**POST** `/bgv/:id/approval`

Initiate approval workflow for failed/discrepancy cases.

### 20. Complete Manual Verification
**POST** `/bgv/:id/checks/:checkId/manual-verification`

Complete manual verification with evidence.

**Request Body:**
```json
{
  "status": "Clear|Failed",
  "notes": "string",
  "evidence": {},
  "verifiedBy": "string",
  "verificationDate": "ISODate"
}
```

### 21. Get BGV Case Analytics
**GET** `/bgv/:id/analytics`

Get BGV case with full timeline and analytics.

### 22. Bulk Sync
**POST** `/bgv/bulk-sync`

Sync all BGV cases with vendor.

### 23. Waive BGV Requirement
**POST** `/bgv/:id/waive`

Waive BGV requirement for an employee.

**Request Body:**
```json
{
  "reason": "string"
}
```

### 24. Get BGV Statistics
**GET** `/bgv/statistics`

Get organization-wide BGV statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "total": 100,
    "byStatus": {
      "Clear": 50,
      "In Progress": 30,
      "Failed": 5,
      "Initiated": 15
    },
    "byVendor": {
      "springverify": 50,
      "manual": 50
    },
    "slaBreached": 5,
    "avgCompletionDays": 7.5,
    "clearanceRate": 50
  }
}
```

---

## Workflow Status Flow

### Employee Side
```
Not Started
↓
Pending Employee Submission
↓
Draft Saved (save draft)
↓
Submitted (submit for review)
↓
Under HR Review
↓
Additional Information Required (if HR requests info)
↓
Resubmitted (respond and resubmit)
↓
Verified (if HR approves)
OR
Rejected (if HR rejects)
```

### HR Side
```
Pending Review (when employee submits)
↓
Under HR Review
↓
Verified (approve)
OR
Rejected (reject)
OR
Additional Information Required (request more info)
```

---

## Required Documents by Check Type

### Employment Verification
- Experience Letter (required)
- Offer Letter (required)
- Relieving Letter (optional)
- Salary Slip (optional)
- Appointment Letter (optional)

### Education Verification
- Degree Certificate (required)
- Marksheet (required)
- Diploma (optional)
- Transcript (optional)

### Address Verification
- Aadhaar (required)
- Passport (optional)
- Driving Licence (optional)
- Utility Bill (optional)

### Identity Verification
- Aadhaar (required)
- PAN (required)
- Passport (optional)

### Criminal Verification
- Police Verification Certificate (optional)
- Government ID (required)

### Reference Check
- No documents required (references entered manually)

---

## Notifications

### Employee Notifications
- `lifecycle_bgv_initiated` - BGV case created
- `lifecycle_bgv_check_assigned` - Check assigned
- `lifecycle_bgv_documents_required` - Documents required
- `lifecycle_bgv_check_submitted` - Check submitted
- `lifecycle_bgv_check_resubmitted` - Check resubmitted
- `lifecycle_bgv_info_requested` - Additional info requested
- `lifecycle_bgv_check_verified` - Check verified
- `lifecycle_bgv_check_rejected` - Check rejected
- `lifecycle_bgv_pending_overdue` - Verification overdue

### HR Notifications
- `lifecycle_bgv_new_submission` - New employee submission
- `lifecycle_bgv_resubmission` - Employee resubmitted
- `lifecycle_bgv_pending_review` - Check pending review
- `lifecycle_bgv_verification_overdue` - Verification overdue
- `lifecycle_bgv_hr_remarks` - HR remarks added

---

## Audit Logs

All BGV actions are logged to lifecycle audit with:
- User (actor)
- Date/Time
- IP address
- Action performed
- Remarks
- Entity details

---

## Configure Integration

When `backgroundVerification` feature is disabled:
- All endpoints return `{ enabled: false, message: '...' }`
- Historical data preserved with `isActive: false`
- No new BGV cases created
- Notifications stopped

When re-enabled:
- Historical data reactivated with `isActive: true`
- Complete workflow restored automatically
- Notifications resume

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE" // optional
}
```

Common error codes:
- `FEATURE_DISABLED` - BGV feature disabled
- `BGV_CASE_NOT_FOUND` - BGV case not found
- `CHECK_NOT_FOUND` - Verification check not found
- `DOCUMENT_NOT_FOUND` - Document not found
- `INVALID_STATUS_TRANSITION` - Invalid status transition
- `PERMISSION_DENIED` - Insufficient permissions

---

## Real-Time Synchronization

All BGV updates trigger:
1. Activity feed updates
2. Timeline updates
3. Progress recalculation
4. Onboarding workflow sync
5. Notification triggers
6. Audit log entries

Employee and HR views stay synchronized through:
- Polling endpoints (dashboard, case detail)
- WebSocket events (if implemented)
- Notification system

---

## Progress Calculation

Progress is calculated dynamically based on check statuses:
- Clear/Waived: 100%
- In Progress: 55%
- Initiated: 25%
- Discrepancy: 40%
- Failed: 0%
- Other: 0%

Overall progress = Average of all check progress values

---

## Version History

Documents maintain version history:
- Each replace creates new version
- Version history includes: version number, URL, name, type, uploadedAt, uploadedBy, status, replacedAt, replacedBy
- Current version always accessible
- Historical versions preserved for audit

---

## Internal Notes

HR can add internal notes for:
- Private HR communication
- Investigation notes
- Decision rationale
- Internal approvals

Internal notes are NOT visible to employees.
