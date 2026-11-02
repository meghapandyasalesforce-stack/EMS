# Project detail tabs: functional verification

The four tabs on `/projects/:id` were inspected across the React UI, Redux loading, registered API routes, controller decisions, and persistence calls. Confirmed defects were fixed while preserving the existing layout and workflows.

| Tab | Verified behavior | Result |
| --- | --- | --- |
| Project Details | Deep-link loading, configured start date, project display, edit/save/reload, required-field validation, status selection and update | Passed automated and browser checks |
| Work Plan | Tree loading, task and subtask creation, status/assignment changes, due-date reason/history, comments, deletion including descendants, error handling | Passed automated and browser checks; descendant deletion and notification metadata verified in controller tests |
| Team Daily Logs | Request/loading/error handling; employee, task text, date, status and comments; project/organization-scoped queries | Passed automated and browser checks |
| Daily Updates | Complete paginated history, author/date/status/progress/blockers/next steps, post/update/refresh, posting authorization, validation and load failures | Passed automated and browser checks |

## Confirmed issues fixed

- **Wrong start date:** Project Details displayed `createdAt` under Start Date. It now uses `startDate`, with creation date only as a legacy fallback when no start date exists.
- **Edit action from other tabs:** Edit Project previously switched the toolbar into edit mode without showing the form. It now opens Project Details and its edit form.
- **False not-found state during loading:** Direct project links now distinguish loading, failed requests, and a genuinely missing project.
- **Existing inactive members blocked unrelated edits:** Existing assignments may be retained; new assignments must still be active employees from the same organization. Project leader validation is also organization-scoped.
- **Incomplete daily update history:** The UI previously loaded only the API's default first 20 entries. It now follows all pagination results. The API bounds page size and returns `hasNext`.
- **Load failures appeared empty:** Daily update fetch failures now display an error instead of “No daily updates posted yet.”
- **Unlabelled dropdowns:** Existing project, status, work-item and daily-update selects now have proper label associations. No fields or options were added.
- **HR comment mismatch:** HR-manager comment visibility now agrees with the existing backend permission rule.
- **Invalid writes:** Daily updates now reject invalid dates, impossible civil dates, invalid/non-numeric progress and oversized/non-text fields with validation responses. Work items reject blank titles, malformed trees, invalid statuses/priorities and impossible due dates instead of silently accepting or skipping them.
- **Project boundaries:** Project reads/edits/status/updates/deletion and team-log queries now consistently include the authenticated organization. Cross-organization controller tests return not found without writing.

## Evidence

- **43 backend controller tests passed:** `server/tests/unit/projectDetailTabs.test.js`.
- **18 four-tab UI tests passed:** `vite_client/src/Admin/project/ProjectDetailPage.test.jsx`.
- **5 existing project-card regression tests passed:** `vite_client/src/components/project/ProjectSummaryCard.test.jsx`.
- **66 automated tests passed in total.**
- **Production frontend build passed.** Vite retains its existing circular-chunk warnings.
- Chromium exercised real UI event handlers, Redux updates and HTTP requests against isolated API fixtures: deep-link load; project edit/save/reload; task/subtask creation; comments; due-date reason validation; team logs; a 23-entry update history; posting a daily update; updating project status; and all four tabs at 390px width. Seven write requests were made only to the test fixtures.

Commands:

```bash
cd server
NODE_OPTIONS=--experimental-vm-modules ./node_modules/.bin/jest --runInBand --runTestsByPath tests/unit/projectDetailTabs.test.js

cd ../vite_client
npm test -- --run src/Admin/project/ProjectDetailPage.test.jsx src/components/project/ProjectSummaryCard.test.jsx
npm run build
```

## Limits

Controller persistence and notification boundaries were mocked; browser API responses were isolated fixtures. No live tenant database credentials were available in this execution context. Consequently, these results do **not** establish production database persistence, authentication/session behavior against a deployed server, or actual email/in-app notification delivery. The registered authentication/feature/rate-limit middleware was inspected, but no live user accounts or tenant records were changed. Outbound notification delivery still needs a live-environment smoke test.

## Files changed

- `vite_client/src/Admin/project/ProjectDetailPage.jsx`: start-date/edit/loading/history/error fixes, existing dropdown associations and HR comment visibility.
- `vite_client/src/Hooks/useGetAllProjects.jsx`: exposes loading/error state while preserving existing callers.
- `server/controllers/admin/projectController.js`: organization boundaries, preserving existing inactive assignments, bounded update pagination and daily update validation.
- `server/controllers/admin/projectWorkItemController.js`: validates work-item trees and changes before saving.
- `server/controllers/employee/employeeTaskController.js`: validates project ownership before returning organization-scoped team logs and rejects invalid log dates.
- `server/helpers/workItemDueDateHelper.js`: rejects impossible civil due dates, including whitespace-padded input.
- `server/tests/unit/projectDetailTabs.test.js`: backend functional regressions.
- `vite_client/src/Admin/project/ProjectDetailPage.test.jsx`: four-tab UI regressions.
- `docs/PROJECT_TABS_VERIFICATION.md`: findings, evidence and verification limits.

Account: `meghapandyasalesforce-stack` · Repository: `EMS` · Branch: `main`

```bash
git switch main
git pull https://github.com/meghapandyasalesforce-stack/EMS.git main
```

## Assigned employee daily logging

The assigned employee route (`/employee/projects/:projectId`) now uses the current green project workspace style and shows project description, category, priority, dates, progress, lead, and members. A persistent **Add daily task / Update daily task** action opens **My daily logs**. Logging is available to project members and the project lead without a work-plan item assignment. Today's existing entry is loaded for editing; historical entries remain read only. One entry per employee, project, and day remains the existing rule.

Employee logs save to `tasks` through `/both/project-task/create-task` and `/task-status/:taskId`; the HR/admin **Team daily logs** endpoint reads that same project and organization. The project toolbar's **Daily Update** remains the separate project progress update workflow. Team log guidance now uses the current employee tab name.

Validation includes controller tests for two assigned employees creating logs for the same project, HR reading both records, ownership/organization checks, same-day edits and duplicate prevention, clearing comments, and notification failures after successful writes. Employee component tests cover a newly assigned member with no work-plan tasks, saving and updating today's log, validation/retry, loading existing logs before saving, and read-only history. Request-order regression tests prevent older responses from hiding a newer log. Browser checks exercise save/update and HR display using HTTP fixtures, plus all employee tabs at desktop, tablet, 390px, and 320px. These checks do not use live tenant data.


## Team members posting project updates

Assigned members can now post project updates from the shared project page (`/projects/:id`), including directly inside **Team daily logs**. **Daily Updates** remains available as the project update timeline. Team daily logs now includes those same project updates as well as existing employee daily task records; no duplicate or backfilled records are created. The old guidance directing users to a different page has been removed.

The employee project route also exposes **Post Update** and **Team daily logs**. Employee APIs under `/both/project-task/projects/:id/updates` and `/projects/:projectId/team-logs` authenticate the employee and check membership in the same organization before reading or writing. The posting policy accepts project leaders, members, project managers, and organization owners. The separate project-status policy retains its previous leader/manager/owner restriction.

Controller and middleware tests cover member posting, nonmember rejection, organization scoping, and retaining project-status restrictions. Frontend tests cover posting from the shared member page, refreshing the team feed, employee access to the team update composer, and preserving a failed draft. Browser tests use HTTP fixtures to post from both member views, verify HR can read both posts in Team daily logs and Daily Updates, and check mobile widths of 390px and 320px. Live tenant sessions were unavailable.
