# WFH requirement review and implementation

Employee applications now work independently of the HR calendar. An applicable HR schedule is a direct WFH assignment: it grants WFH punch permission and reserves those dates against a second employee application. Other employees and dates remain eligible for independent requests.

The existing Calendar.wfhDates entries, employee access lists, WfhRequest model, review API, notification functions, and attendance day-plan engine are reused. No parallel WFH business model or replacement approval workflow was introduced. UI changes are limited to the missing coverage selector, cancellation actions, correct status rendering, and explanatory messages.

## Requirement matrix

Numbering matches the supplied requirement document. “Already Implemented” describes functionality inspected and preserved; “Fixed” describes existing functionality corrected or extended; “Newly Implemented” identifies a missing capability added here.

| Requirement | Status | Result / evidence |
| --- | --- | --- |
| 1.1 Independent applications | Fixed | No HR-enabled-date prerequisite in API or employee form. |
| 1.2 Single and multiple dates | Already Implemented | Existing inclusive from/to range and half-day fields preserved. |
| 1.3 Existing application interface | Already Implemented | Existing employee WFH panel and POST endpoint reused. |
| 1.4 Existing approval workflow | Already Implemented | Existing manager/HR/admin review and email threading retained. |
| 1.5 Pending/approved/rejected/cancelled | Fixed | Added cancelled enum, owner cancellation endpoint, and employee/manager rendering. |
| 1.6 Pending cannot punch home | Already Implemented | Attendance classifier accepts only approved requests. |
| 1.7 Approved dates authorize home | Already Implemented | Approved date/half classification and punch gate retained and tested. |
| 1.8 Rejected/cancelled cannot authorize home | Fixed | Both are excluded from attendance authorization; cached UI schedule clears when authorization disappears. |
| 1.9 Duplicate/overlapping applications | Newly Implemented | Active-request overlap check returns every conflicting date. Organization-scoped MongoDB write coordination serializes WFH mutations across app workers. |
| 1.10 Unrestricted dates remain available | Fixed | Absence of an applicable HR assignment allows independent application. |
| 2.1 HR assigns individuals | Fixed | Existing only_these coverage mode is now selectable and preserved by the modal. |
| 2.2 HR assigns department | Fixed | Reuses existing paginated department roster picker with only_these coverage. |
| 2.3 HR assigns everyone | Already Implemented | Existing all_except mode with an empty exclusion list covers everyone. |
| 2.4 Single date/range schedules | Already Implemented | Existing calendar range endpoints reused. Working-day and calendar-year rules remain. |
| 2.5 Edit schedules | Fixed | Coverage mode preserved; moving/resizing explicitly removes former dates; unrelated adjacent coverage is not merged into the edited block. |
| 2.6 Remove schedules | Already Implemented | Existing DELETE API retained; deletion removes the assignment and its application restriction. |
| 2.7 View employees/dates | Already Implemented | Existing date-range modal and populated employee chips retained; coverage meaning is explicit. |
| 3.1 Block covered Employee A | Fixed | Shared predicate checks actual HR assignment coverage. |
| 3.2 Allow uncovered Employee B | Fixed | Other employees can apply on the same dates. |
| 3.3 Department-only restriction | Fixed | Selected department roster IDs restrict those employees only. |
| 3.4 Everyone restriction | Fixed | all_except assigns everyone other than explicit exclusions. |
| 3.5 Dates outside schedule | Fixed | Inclusive day comparison checks only the requested intersection. |
| 3.6 Removal releases restriction | Fixed | Eligibility reads current calendar entries on every submission. |
| 3.7 Date/coverage changes update restrictions | Fixed | Current saved dates and coverage drive both application checks and punch plans. |
| 4: 8–9 November | Fixed | Allowed against an assignment on 10–12 November. |
| 4: 10 November | Fixed | Rejected with 10 November identified. |
| 4: 11–12 November | Fixed | Rejected with both dates identified. |
| 4: 13–15 November | Fixed | Allowed. |
| 4: 8–15 November | Fixed | Entire request rejected with 10, 11, 12 November identified. |
| 4: 12–14 November | Fixed | Entire request rejected with 12 November identified. |
| 4: Never partially accept employee ranges | Fixed | All eligibility and duplicate checks run before request creation. |
| 5.1 HR versus pending request | Newly Implemented | 409 conflict with dates and request/employee IDs. |
| 5.2 HR versus approved request | Newly Implemented | Same conflict; HR must resolve/cancel the employee request before assigning those dates. |
| 5.3 No unnoticed schedule overlap | Newly Implemented | Existing schedules require explicit edit; moving an existing schedule into a different saved schedule is rejected. |
| 5.4 Adjacent non-overlapping dates | Fixed | Employee approval on 10 November does not prevent HR assignment on 11 November. |
| 5.5 Reapply after rejection/cancellation | Fixed | Only pending, legacy submitted, and approved requests reserve dates. |
| 5.6 Recheck changes | Newly Implemented | Creation, approval, HR range edits, coverage edits, and holiday-to-home conversion validate conflicts. |
| 6.1 Approved request OR HR assignment | Fixed | Both feed the same authoritative attendance day plan. |
| 6.2 Inactive request statuses excluded | Fixed | Pending/submitted/rejected/cancelled do not authorize home punch. |
| 6.3 HR assignments authorize home | Newly Implemented | Applicable calendar coverage resolves to full-day WFH. |
| 6.4 No authorization outside coverage | Fixed | Date and employee predicates gate the plan; existing attendance endpoint enforces it. |
| 6.5 Preserve normal attendance | Already Implemented | Geofence, normal punches, clock-out, regularization, holiday/leave and half-day calculations were not rewritten. Existing regression suites pass. |
| 7: HR-restricted feedback | Fixed | Explicit schedule conflict message. |
| 7: Conflicting dates visible | Newly Implemented | API details.dates plus date lists in frontend messages. |
| 7: Duplicate feedback | Newly Implemented | Clear active-request overlap message. |
| 7: HR conflict feedback | Newly Implemented | Existing calendar error handling displays conflict dates; response also carries request and employee IDs. |
| 7: Date validation on both sides | Fixed | Existing form checks preserved; backend rejects impossible/reversed dates and invalid types; cross-year employee ranges load every intervening calendar year. Supported years remain 2020–2050. |
| 7: Direct API bypass prevention | Newly Implemented | Backend validation is authoritative; tests invoke controller handlers directly, independently of frontend checks. |
| 8: Scope/reuse rules | Already Implemented | No unrelated module changes, dependency declaration edits, design replacement, duplicate fields, or replacement approval pipeline. |
| 9.1–9.6 Verification | Fixed | Automated WFH, HR calendar, attendance and regularization tests described below. |
| 9.7 Requirement report | Newly Implemented | This matrix. |
| 9.8 Exact changed files | Newly Implemented | File inventory below. |

Employee date editing is **Not Applicable** as a separate operation: the existing request interface has no date-edit endpoint. Employees cancel and reapply; review/status changes recheck the relevant conflicts. Department selection intentionally reuses the existing roster snapshot, rather than introducing a second dynamic department-assignment schema. HR can update the roster when membership changes.

## Verification and limits

- Backend: **112 tests passed in 9 suites**. Includes independent applications; all supplied overlap examples; covered/uncovered employees; department roster and everyone coverage; duplicate requests; approval/rejection/cancellation; HR schedule create/edit/remove and coverage changes; holiday conversion; punch-plan authorization; concurrent WFH write coordination; and existing attendance/regularization regression tests.
- Frontend: **14 tests passed in 2 suites**. Covers independent application, schedule conflicts, uncovered employees, duplicates, reapplication after rejection/cancellation, cancellation, everyone/targeted HR assignments, department selection, and preserving coverage on edits.
- Frontend production build passed. Vite reports the repository's existing circular-chunk warnings.
- Database operations and outbound emails are mocked in automated controller tests. No live tenant database, production punch, or outbound email delivery was exercised; this is not a claim of live deployment validation. Organization-specific geolocation, holidays, and credentials still require deployment smoke testing.
- Backend dependency installation encountered an existing incomplete lockfile and Redis/BullMQ peer conflict. Dependencies were installed for validation using legacy peer resolution without changing package.json or lockfiles.

## Persistence and rollout

No WFH business-data migration is performed. The new cancelled status is accepted by the existing model. A technical `wfh_write_locks` collection is created automatically on first WFH mutation; its unique `_id` coordinates writes per organization. Leases are released after processing, renewed during longer requests, checked before persistence, and recover after expiry if a worker crashes. MongoDB credentials need the usual read/write and collection-creation permissions. This collection contains no request, schedule, or employee business records.

Existing calendar entries previously acted as eligibility dates. Under the requested behavior, those same saved entries now act as direct HR assignments with their existing employee coverage. HR should review legacy calendars before rollout. A pending legacy employee request that overlaps an existing HR assignment will now show the requested conflict at approval; resolve the overlap explicitly rather than deleting or rewriting historical records automatically.

## Exact changed files

| File | Why changed |
| --- | --- |
| server/helpers/wfhCalendarHelper.js | Centralizes HR coverage, independent eligibility, request overlaps, strict civil dates and schedule conflict checks. |
| server/helpers/wfhWriteLock.js | Serializes WFH mutations across app workers without a duplicate WFH business model. |
| server/controllers/wfh/wfhRequestController.js | Checks duplicates and schedule overlaps, rechecks approvals, protects review/cancel status transitions, adds owner cancellation. |
| server/models/wfhRequest.model.js | Adds cancelled to the existing status enum. |
| server/routes/Both/WfhRequestRoutes.js | Registers authenticated owner cancellation on the existing request resource. |
| server/controllers/admin/calendarController.js | Checks create/edit/coverage/holiday-home conflicts, validates tenant employee IDs, requires explicit edits, removes former dates on a move. |
| server/models/calendar.model.js | Updates field documentation to describe HR assignments. |
| server/routes/Admin/CalendarRoutes.js | Corrects stale WFH route documentation. |
| server/controllers/employee/employeeCalendarController.js | Returns per-employee scheduled coverage without exposing other employees' IDs. |
| server/helpers/attendanceDayContextHelper.js | Incorporates applicable HR assignments into the existing day-plan engine. |
| server/controllers/attendance/attendanceController.js | Corrects the punch denial message to explain both authorization paths. |
| vite_client/src/Employee/Wfh/WfhRequestPanel.jsx | Removes HR prerequisite, checks actual restrictions/duplicates, adds request cancellation and cancelled display. |
| vite_client/src/Admin/Calendar/CalendarManagement.jsx | Exposes existing coverage modes, preserves saved selections, tracks explicit schedule edits, corrects messages and range handling. |
| vite_client/src/Employee/Attendance/AttendanceBox.jsx | Clears stale WFH state and explains approved-request/HR-assignment authorization. |
| vite_client/src/Manager/AttendanceRegularization/TeamWfhRequestsPanel.jsx | Displays cancelled requests correctly. |
| server/tests/unit/wfhCalendarHelper.test.js | Replaces tests of the old HR prerequisite with the requested eligibility/overlap matrix. |
| server/tests/unit/wfhWorkflows.test.js | Exercises controller and punch-plan decisions with database/email boundaries mocked. |
| server/tests/unit/wfhWriteLock.test.js | Tests simultaneous updates, tenant isolation, lease expiry/loss and fail-closed behavior. |
| vite_client/src/Employee/Wfh/WfhRequestPanel.test.jsx | Tests employee application and cancellation behavior. |
| vite_client/src/Admin/Calendar/CalendarManagement.test.jsx | Tests HR everyone/employee/department coverage and explicit edits. |
| docs/WFH_REVIEW_REPORT.md | Requirement matrix, evidence, limitations, rollout notes and file inventory. |

## Pull

Account: `meghapandyasalesforce-stack` · Repository: `EMS` · Branch: `main`

```bash
git switch main
git pull https://github.com/meghapandyasalesforce-stack/EMS.git main
```
