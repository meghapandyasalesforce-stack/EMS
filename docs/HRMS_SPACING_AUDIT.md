# HRMS frontend spacing audit

## Scope and review method

Reviewed the centralized route configuration, authenticated application shell, shared page/canvas rules, responsive breakpoints, role dashboard variants, and reachable frontend module components. The source scan followed **156 route declarations and 370 reachable JS/JSX/CSS files**; 206 files contained height, stretch, or spacing patterns requiring classification. Pattern matches were treated as review candidates, not automatically removed. Archived duplicate components without an active import path were left alone.

This is a source audit across the application plus representative browser checks with temporary fixtures. It is **not** a claim that every live page or every role permission was tested against a running backend.

## Modules inspected and fixes

| Module / pages | Findings and targeted changes |
| --- | --- |
| Admin, HR, Manager, Employee, Finance, Tech, Administration dashboards | Removed redundant viewport-height wrappers and accidental equal-height dashboard columns; shorter cards align at the start. Existing chart dimensions and intentional KPI/card grouping remain. |
| Employee directory, add employee, employee details, nested documents and leave tabs | Content-height wrappers; reduced compounded section/empty-state spacing and kept mobile actions within available width. |
| Profile: Personal, Contact, Education, Experience, Family, Documents, Financial, Security; legacy View Profile inspected | Removed desktop viewport-height measurement and spare-space allocation. Summary ends 20px after completion; navigation and selected content have independent natural heights. Personal field gaps are 14px with 16px padding; Security groups have 16px spacing. Existing three-column desktop structure and vertical tabs remain. Mobile Profile component dimensions, spacing, and fonts match the committed version. |
| Leave, attendance, attendance history, regularization, WFH, leave policy/balance, approval workflows | Removed redundant page heights, duplicate sidebar offset in the attendance page, excessive nested padding and empty-state gaps; kept table and map dimensions where functional. |
| Payroll: employee, admin, employee payroll, add/update; salary structure | Natural page/card height and consistent form/summary gaps. No payroll formulas or form handlers changed. |
| Recruitment and ATS: jobs, job detail/editor, pipeline, workspace, requisitions, calendar, inbox, candidates, employee internal jobs and manager hiring requests | Scoped ATS containers/empty states no longer grow to fill leftover viewport space. Workspace/job-detail sections use content height. Specialized pipeline/calendar canvases and PDF previews remain functional. |
| Onboarding, offboarding, BGV, lifecycle, workflow builder, documents, training, activity, verification, statutory compliance, lifecycle reports/enterprise | Removed fixed/minimum panel heights and compounded padding. Adjacent lifecycle switcher/body shells share their edge padding rather than adding both. Existing workflow sections and role gates remain. |
| Organization chart, structure, role hierarchy, users/roles | Preserved chart canvas/pan/zoom geometry; updated structure/role pages' excessive wrapper/section spacing and wrapping/indentation at small widths. |
| Organization owner profile, dashboard, settings, analytics, onboarding, subscription, checkout, verification, referrals, domain verification | Natural wrapper heights, independent adjacent cards, and responsive controls/spacing. |
| Projects/tasks, organizer/personal one-on-one meetings | Removed unnecessary page minimum heights and stretching so shorter detail/sidebar sections do not inherit taller siblings' height. |
| Engagement, surveys/pulse, feedback, recognition, suggestions, learning/courses, benefits, team learning | Removed redundant page or form minimum heights and excessive empty-state/section gaps. |
| Employee/HR/admin documents, document requests/templates/versions, Digital ID | Natural wrappers and wrapping controls. On Documents & ID, Company Docs follows Upload in the desktop content column instead of waiting for the taller ID-card rail. Mobile visual order is preserved; ID card internals/aspect ratio and upload/download/share handlers are unchanged. |
| Settings, notifications, sent announcements, calendars, celebrations, daily report | Removed excess page/section heights and spacing; preserved underlying forms, event layout and calendar content dimensions. |
| Succession, workforce planning, helpdesk, analytics/reports, platform organization list/detail | Content-height wrappers and short panels; responsive filter/action spacing and removal of redundant nested scrolling in reports. |
| Shared loading/error fallback | LoadingSpinner and RouteErrorBoundary have scoped natural-height spacing inside the authenticated scroll area. Standalone initialization loading retains its existing viewport layout. |
| Authentication, public careers/offer/application portals, platform shell, navigation and route permissions | Inspected as shared-layout boundaries; authentication, public page logic, shell/navigation and permission configuration remain unchanged. |

## Shared layout/CSS changes

- `src/index.css`: correct the authenticated canvas minimum height to zero so it can fit below the existing header; remove blanket full-height constraints on arbitrary single-child page wrappers. Canvas background remains on the canvas itself.
- `src/index.css`: desktop-only Profile changes remove stretch/spare-space rules; mobile Profile CSS remains unchanged. Short Profile panels and navigation use natural height.
- `src/index.css` and `src/styles/recruitmentUI.css`: content-height authenticated ATS wrappers and empty-state ancestors; preserve theme and specialized content dimensions.
- `src/styles/lifecycleUI.css`: scoped adjacent-shell spacing for the lifecycle switcher and its body, including the existing mobile breakpoint.
- No blanket reduction of all padding, no new dependencies, no API/configuration changes, and no new overflow-hiding rules to conceal content.

## Validation

- **Production build:** `npx vite build --outDir /tmp/hrms-spacing-final-build` passed. Existing circular-chunk warnings remain; build/server configuration was not changed.
- **Vitest:** 70 passed / 3 failed (73 total). The same three failures were reproduced against an archived, unchanged HEAD baseline: one existing navigation expectation and two existing ErrorBoundary import/test failures. They were left outside this UI task.
- **ESLint baseline comparison:** the original 116 changed JSX files have exactly the baseline 175 errors / 76 warnings and no introduced messages. The subsequently changed loading, route fallback, and sent-announcement files lint without errors; Documents & ID retains its two baseline unused-variable errors. Existing lint debt was not altered outside scope.
- **210 browser layout checks:** all eight Profile tabs for Admin/HR/Manager/Employee fixtures at 320, 390, 768, 1024, 1366 and 1920px; Documents & ID and a short shared-shell fixture at 320, 375, 390, 430, 768, 1024, 1366 and 1920px; long Education/Experience fixtures. Verified viewport fit, no outer-body/page horizontal overflow, natural desktop panel/footer spacing, long-content scrolling and the desktop Upload/Company Docs gap.
- **24 additional browser checks:** role hierarchy/create-role UI, recruitment empty state and organization settings at 320, 375, 390, 430, 768, 1024, 1366 and 1920px. Checked controls fit without clipping.
- **24 baseline comparisons:** all eight mobile/tablet Profile tabs at 320, 390 and 768px have identical component geometry, padding, gaps and font sizes to committed CSS.
- **48 interaction checks:** Profile Personal/Contact/Financial Edit/Cancel, mocked Personal Save, password visibility and photo-modal opening across four role fixtures at 375 and 1366px.
- **Documents mobile order:** confirmed Upload precedes the ID card, which precedes Company Docs at 320, 390 and 768px. Desktop screenshots inspected; card aspect ratio preserved.
- **Organization chart regression:** passed 20/50/200/500-employee fixture checks for hierarchy counts, expand/collapse, ID search/focus, department filtering, minimap, zoom/fit, fullscreen, Records and Levels.
- **Static preservation check:** all 119 modified JSX files have unchanged API call expressions and event-handler expressions. Routes, Redux/context, permission utilities, backend, dependencies, environment, API URLs and Vite configuration have no diff.
- Temporary browser harnesses and fixture data live under ignored `vite_client/.cache/spacing-check`; no test employees or other records were created in a database.

## Manual verification required

The backend on port 10000 is not running in this cloud workspace and no real role sessions were available. Browser checks use actual components with temporary mocked responses; they do not validate authorization or backend transactions.

At `http://localhost:5173`, with your existing `http://localhost:10000` backend, verify Admin, HR Manager/Executive, Line Manager, Employee, Owner, Finance/Tech/Executive and platform roles as applicable:

1. Open each module listed above with empty and populated data, including long lists and multiple records, at mobile, tablet, laptop and desktop widths.
2. Verify Profile Edit/Save/Cancel, photo upload, document uploads/downloads, password validation/update, and role-specific field visibility.
3. Verify leave/WFH approvals, attendance filters/maps, payroll create/update and export, recruitment pipeline/calendar, lifecycle/BGV workflows and meeting actions.
4. Verify document previews/downloads and real ID-card PDF export/share; these require backend files and browser permissions.
5. Verify dashboard widgets, reports and charts with real data, and unchanged navigation/permissions for each role.

## Exact modified frontend files

- `vite_client/src/Admin/ApprovalWorkflows/PendingApprovals.jsx`
- `vite_client/src/Admin/ApprovalWorkflows/WorkflowManager.jsx`
- `vite_client/src/Admin/Attendance/AllAttendanceStatsComponent.jsx`
- `vite_client/src/Admin/Attendance/AttendanceRules.jsx`
- `vite_client/src/Admin/Attendance/TodayStatusComponent.jsx`
- `vite_client/src/Admin/Calendar/CalendarManagement.jsx`
- `vite_client/src/Admin/DashboardAdmin.jsx`
- `vite_client/src/Admin/Documents/DocumentManagement.jsx`
- `vite_client/src/Admin/Documents/DocumentTemplateManager.jsx`
- `vite_client/src/Admin/Employee/AddEmployee.jsx`
- `vite_client/src/Admin/Employee/EmployeeDetailsPage.jsx`
- `vite_client/src/Admin/Employee/EmployeesPage.jsx`
- `vite_client/src/Admin/Employee/employeeDetails/tabs/DocumentsTab.jsx`
- `vite_client/src/Admin/Employee/employeeDetails/tabs/LeaveTab.jsx`
- `vite_client/src/Admin/Employee/employeeDetails/widgets/LeaveBalancesWidget.jsx`
- `vite_client/src/Admin/IdCards/IdCardGenerator.jsx`
- `vite_client/src/Admin/Leave/EmployeeLeaveBalanceViewer.jsx`
- `vite_client/src/Admin/LeaveManagement.jsx`
- `vite_client/src/Admin/Organization/CheckoutPaymentPage.jsx`
- `vite_client/src/Admin/Organization/DomainVerification.jsx`
- `vite_client/src/Admin/Organization/OrgStructurePage.jsx`
- `vite_client/src/Admin/Organization/OrganizationAnalytics.jsx`
- `vite_client/src/Admin/Organization/OrganizationDashboard.jsx`
- `vite_client/src/Admin/Organization/OrganizationOnboarding.jsx`
- `vite_client/src/Admin/Organization/OrganizationProfile.jsx`
- `vite_client/src/Admin/Organization/OrganizationSettings.jsx`
- `vite_client/src/Admin/Organization/OrganizationVerification.jsx`
- `vite_client/src/Admin/Organization/ReferralProgram.jsx`
- `vite_client/src/Admin/Organization/SubscriptionManagement.jsx`
- `vite_client/src/Admin/Payroll/AddPayroll.jsx`
- `vite_client/src/Admin/Payroll/AdminEmployeePayroll.jsx`
- `vite_client/src/Admin/Payroll/AdminPayroll.jsx`
- `vite_client/src/Admin/Payroll/UpdatePayroll.jsx`
- `vite_client/src/Admin/RoleManagement/RoleHierarchy.jsx`
- `vite_client/src/Admin/RoleManagement/UsersRolesPage.jsx`
- `vite_client/src/Admin/SalaryStructure/SalaryStructureManager.jsx`
- `vite_client/src/Admin/SentAnnouncementsPage.jsx`
- `vite_client/src/Admin/Settings/AdminSettings.jsx`
- `vite_client/src/Admin/project/ProjectDetailPage.jsx`
- `vite_client/src/Admin/project/ProjectPage.jsx`
- `vite_client/src/Administration/Dashboard/DashboardAdministration.jsx`
- `vite_client/src/Both/AttendanceDashboard.jsx`
- `vite_client/src/Both/CelebrationEventPage.jsx`
- `vite_client/src/Both/Notifications.jsx`
- `vite_client/src/Employee/Attendance/AttendanceStats.jsx`
- `vite_client/src/Employee/AttendanceRegularization/MyRegularizationRequests.jsx`
- `vite_client/src/Employee/Calendar/EmployeeCalendar.jsx`
- `vite_client/src/Employee/Dashboard/DashboardEmployee.jsx`
- `vite_client/src/Employee/Dashboard/NotificationFeed.jsx`
- `vite_client/src/Employee/Dashboard/Todo.jsx`
- `vite_client/src/Employee/Documents/DocumentRequestsLanding.jsx`
- `vite_client/src/Employee/Documents/EmployeeDocumentRequests.jsx`
- `vite_client/src/Employee/Documents/MyDocumentsPage.jsx`
- `vite_client/src/Employee/Documents/SelfServiceDocuments.jsx`
- `vite_client/src/Employee/DocumentsAndId/DocumentsAndIdPage.jsx`
- `vite_client/src/Employee/Engagement/EmployeeEngagementPage.jsx`
- `vite_client/src/Employee/Learning/BenefitsLearningHub.jsx`
- `vite_client/src/Employee/Learning/CourseDetailsPage.jsx`
- `vite_client/src/Employee/Learning/MyTeamLearningPage.jsx`
- `vite_client/src/Employee/Leave/LeaveEncashment.jsx`
- `vite_client/src/Employee/Leave/MyLeave.jsx`
- `vite_client/src/Employee/LeaveAttendance/LeaveAttendanceHub.jsx`
- `vite_client/src/Employee/OneOnOne/EmployeeOneOnOnePage.jsx`
- `vite_client/src/Employee/Payroll/EmployeePayroll.jsx`
- `vite_client/src/Employee/Profile details/ProfileDetails.jsx`
- `vite_client/src/Employee/Project/EmployeeProjects.jsx`
- `vite_client/src/Employee/Project/EmployeeTasks.jsx`
- `vite_client/src/Finance/Dashboard/DashboardFinance.jsx`
- `vite_client/src/HR/Analytics/HRAnalyticsPage.jsx`
- `vite_client/src/HR/Benefits/BenefitDetailPage.jsx`
- `vite_client/src/HR/Benefits/BenefitsPage.jsx`
- `vite_client/src/HR/Dashboard/DashboardHR.jsx`
- `vite_client/src/HR/Documents/DocumentVersions.jsx`
- `vite_client/src/HR/Documents/DocumentsPage.jsx`
- `vite_client/src/HR/Engagement/EngagementFormShell.jsx`
- `vite_client/src/HR/Engagement/EngagementPage.jsx`
- `vite_client/src/HR/Engagement/FeedbackPanel.jsx`
- `vite_client/src/HR/Engagement/PulsePrograms.jsx`
- `vite_client/src/HR/Engagement/RecognitionPanel.jsx`
- `vite_client/src/HR/Engagement/SuggestionsPanel.jsx`
- `vite_client/src/HR/Engagement/SurveyDetailPage.jsx`
- `vite_client/src/HR/Helpdesk/HelpdeskPage.jsx`
- `vite_client/src/HR/Learning/CourseFormShell.jsx`
- `vite_client/src/HR/Learning/LearningPage.jsx`
- `vite_client/src/HR/Leave/LeavePolicyManagement.jsx`
- `vite_client/src/HR/Offboarding/OffboardingHub.jsx`
- `vite_client/src/HR/Onboarding/DocumentHub.jsx`
- `vite_client/src/HR/Onboarding/EmployeeLifecycle.jsx`
- `vite_client/src/HR/Onboarding/LifecycleEnterpriseHub.jsx`
- `vite_client/src/HR/Onboarding/LifecycleReportsHub.jsx`
- `vite_client/src/HR/Onboarding/LmsDashboard.jsx`
- `vite_client/src/HR/Onboarding/OnboardingActivityTab.jsx`
- `vite_client/src/HR/Onboarding/OnboardingBgvPanel.jsx`
- `vite_client/src/HR/Onboarding/OnboardingHub.jsx`
- `vite_client/src/HR/Onboarding/OnboardingTrainingTab.jsx`
- `vite_client/src/HR/Onboarding/OnboardingVerificationTab.jsx`
- `vite_client/src/HR/Onboarding/StatutoryCompliancePanel.jsx`
- `vite_client/src/HR/Onboarding/WorkflowBuilder.jsx`
- `vite_client/src/HR/Recruitment/JobDetailPage.jsx`
- `vite_client/src/HR/Recruitment/WorkspacePage.jsx`
- `vite_client/src/HR/Reports/HRReportsLayout.jsx`
- `vite_client/src/HR/Reports/components/ReportDataTable.jsx`
- `vite_client/src/HR/Succession/SuccessionDetailPage.jsx`
- `vite_client/src/HR/Succession/SuccessionPage.jsx`
- `vite_client/src/HR/Workforce/WorkforceDetailPage.jsx`
- `vite_client/src/HR/Workforce/WorkforcePage.jsx`
- `vite_client/src/HR/Workforce/components/workforceUi.jsx`
- `vite_client/src/Manager/AttendanceRegularization/RegularizationRequests.jsx`
- `vite_client/src/Manager/AttendanceRegularization/TeamWfhRequestsPanel.jsx`
- `vite_client/src/Manager/Dashboard/DashboardManager.jsx`
- `vite_client/src/Manager/OneOnOne/OneOnOnePage.jsx`
- `vite_client/src/Manager/TeamLearning/TeamLearningPage.jsx`
- `vite_client/src/Others/DailyReport.jsx`
- `vite_client/src/Platform/OrganizationDetail.jsx`
- `vite_client/src/Platform/OrganizationsList.jsx`
- `vite_client/src/Tech/Dashboard/DashboardTech.jsx`
- `vite_client/src/components/LoadingSpinner.jsx`
- `vite_client/src/components/OneOnOne/OneOnOneMeetingHub.jsx`
- `vite_client/src/components/RouteErrorBoundary.jsx`
- `vite_client/src/index.css`
- `vite_client/src/styles/lifecycleUI.css`
- `vite_client/src/styles/recruitmentUI.css`
