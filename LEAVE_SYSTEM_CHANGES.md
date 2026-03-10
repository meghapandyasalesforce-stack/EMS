# Leave System Fixes – Summary of Changes

This document describes the fixes applied to the leave system so it works correctly for **every role** (Admin, HR, Manager, Employee) and aligns with **leave policies** and **balance** per organization.

---

## 1. Leave type alignment (annual / paid)

**Problem:** The Leave model and UI use **"annual"** for annual leave, while Leave Policy and Leave Balance use **"paid"**. Validation failed when an employee applied for "Annual Leave" if the policy only had "Paid Leave" configured.

**Changes:**
- **New helper:** `server/helpers/leaveTypeHelper.js`
  - `normalizeLeaveTypeForPolicy(leaveType)` – maps `"annual"` → `"paid"` for policy/balance lookups.
  - `getLeaveTypeVariantsForBalance(balanceType)` – for balance type `"paid"`, returns `["paid", "annual"]` so both are counted.
- **Leave model** (`server/models/leave.model.js`): Added `"paid"` to the `leaveType` enum so the API can accept and store both "annual" and "paid".
- **Validation** (`server/services/leaveValidationService.js`): Uses normalized type when finding the policy leave type, so "annual" from the employee is validated against the "paid" policy type.
- **Balance engine** (`server/services/leaveBalanceEngine.js`): When calculating **used** and **pending** balance for type "paid", it now counts Leave documents with `leaveType` **"paid"** or **"annual"**.
- **Employee create leave** (`server/controllers/leave/leaveEmployeeController.js`): When checking balance before creating a request, uses normalized type to find the correct balance (e.g. "annual" → "paid").

**Result:** Employees can apply for "Annual Leave"; it is validated and balanced against the organization’s "Paid Leave" policy. No need to add "annual" to the policy; "paid" is enough.

---

## 2. Real leave balance check in validation

**Problem:** `checkLeaveBalance` in the validation service always returned `{ allowed: true }`, so balance was not actually enforced there.

**Changes:**
- **Validation service** (`server/services/leaveValidationService.js`):
  - Imports `leaveBalanceEngine` and `normalizeLeaveTypeForPolicy`.
  - `checkLeaveBalance` now calls `leaveBalanceEngine.calculateBalance(...)`, finds the balance for the normalized leave type, and checks `available >= requestedDays` (or 0.5 for half-day).
  - Duration is computed once and reused for both balance check and min/max days check.

**Result:** Leave requests are rejected when the employee does not have enough balance for the requested (normalized) leave type.

---

## 3. Payroll leave-day counting per month

**Problem:** When generating payroll, approved leaves that **spanned two months** (e.g. Feb 28–Mar 4) were counted with their **full duration** in **each** month, over-counting and double-counting leave days.

**Changes:**
- **Payroll controller** (`server/controllers/admin/payrollController.js`):
  - Added a helper `leaveWorkingDaysInMonth(lv)` that, for each leave, computes the overlap with the payroll month and counts **only working days (Mon–Fri)** in that overlap.
  - Replaced `leaveDays = approvedLeaves.reduce((sum, lv) => sum + (lv.duration || 0), 0)` with `leaveDays = approvedLeaves.reduce((sum, lv) => sum + leaveWorkingDaysInMonth(lv), 0)`.

**Result:** For each month, only the working days of approved leave that fall inside that month are added to "effective present"; payroll is correct for leaves spanning multiple months.

---

## 4. Admin leave list – stats from policy (no hardcoded 36)

**Problem:** In the admin "get all leaves" API, `totalLeaves` was hardcoded to **36**, so "remaining" was wrong for organizations with different policies.

**Changes:**
- **Leave admin controller** (`server/controllers/leave/leaveAdminController.js`):
  - Imported `LeavePolicy`.
  - Fetches the organization’s **active leave policy** (one per org, `isActive: true`, sorted by `effectiveDate`).
  - `totalLeaves` = sum of `accrual.amount` over all leave types in that policy (or 0 if no policy).
  - `remainingLeaves` = `Math.max(0, totalLeaves - leavesTaken)`.
  - `leavesByType` now includes `"paid"` and any type returned by aggregation (no longer limited to sick/annual/casual).

**Result:** Admin/HR/Manager see total and remaining leave based on the **organization’s leave policy**, not a fixed number.

---

## 5. Employee “My Leaves” – stats from actual balance

**Problem:** Employee "get my leaves" used a hardcoded **36** for total leave and derived remaining from that.

**Changes:**
- **Employee leave controller** (`server/controllers/leave/leaveEmployeeController.js`):
  - For the current year and the employee’s `organizationId`, calls `leaveBalanceEngine.calculateBalance(employeeId, year, organizationId)`.
  - `totalLeaves` = sum of `(accrued + carriedForward)` across all balance types.
  - `remainingLeaves` = sum of `available` across all balance types (when balance exists); otherwise `remainingLeaves = max(0, totalLeaves - leavesTaken)`.
  - `leavesByType` includes "paid" and counts both "annual" and "paid" leave documents for the annual/paid bucket.

**Result:** Employees see **real** entitlement and remaining leave from their **leave balance** (which is driven by the organization’s policy and accrual/carry-forward).

---

## 6. Balance recalculation on reject (and approve)

**Problem:** Balance was recalculated only when leave was **approved**. When leave was **rejected**, pending balance was not updated, so "pending" could stay reserved incorrectly.

**Changes:**
- **Leave admin controller** (`server/controllers/leave/leaveAdminController.js`):
  - After updating leave status, balance is recalculated for **both** `approved` and `rejected` (and the code path supports future use for cancelled).
  - Uses `leave.employee` (populated or ID) and `organizationId` to call `leaveBalanceEngine.calculateBalance(employeeId, year, organizationId)`.

**Result:** Approve → used balance updates; Reject → pending balance is released. Balances stay correct for all roles (Admin, HR, Manager, Employee).

---

## 7. Role behavior (unchanged, but now consistent)

- **Admin / HR:** Can create and manage leave policies, view all leaves (org-scoped), approve/reject any leave, see policy-based stats. Stats now come from the **leave policy** (total) and aggregation (taken/remaining).
- **Manager:** Can view leaves for their team (filtered by manager), approve/reject only those leaves. Same stats as above for the list they see.
- **Employee:** Can apply for leave (validation and balance check use **normalized** type and **real** balance), view "My Leaves" with **actual** balance-based total/remaining and correct leaves by type.

No new routes or permissions were added; existing role checks and filters were kept. The fixes ensure that **policy**, **validation**, **balance**, and **payroll** all use the same rules and data for every role.

---

## 8. Adding / configuring leave policy (for reference)

Companies already add policies via:

- **Backend:** `POST /api/v1/admin/leave/policies` (and GET/PUT/DELETE) in `server/routes/Admin/LeavePolicyRoutes.js`, with `organizationId` from the authenticated user.
- **Frontend:** e.g. HR/Admin leave policy management UI that posts policy payload (policy name, effective date, `leaveTypes` array with type e.g. `paid`, `sick`, accrual, carry-forward, etc.).

Each organization has its own policies; validation and balance use the **applicable policy** for the employee’s org (and applicability rules like all/department/role/employee). No changes were made to how policies are created or stored; only how they are **used** (stats, validation, balance) was fixed.

---

## Files touched

| File | Change |
|-----|--------|
| `server/helpers/leaveTypeHelper.js` | **New.** Normalize annual→paid; leave type variants for balance queries. |
| `server/models/leave.model.js` | Added `"paid"` to `leaveType` enum. |
| `server/services/leaveValidationService.js` | Use normalized type for policy; real balance check; single duration calc. |
| `server/services/leaveBalanceEngine.js` | Used/pending balance by leave type variants (paid + annual). |
| `server/controllers/leave/leaveEmployeeController.js` | Normalized type for balance check; getMyLeaves stats from balance. |
| `server/controllers/leave/leaveAdminController.js` | getAllLeaves stats from policy; balance recalc on approve and reject. |
| `server/controllers/admin/payrollController.js` | Leave days per month = working days of leave in that month only. |

---

## What you should do

1. **Ensure each organization has an active leave policy** (e.g. with leave types like `paid`, `sick`, `casual`) so total/remaining and validation make sense.
2. **Use "Paid Leave" (type `paid`) in the policy** for annual entitlement; employees can still choose "Annual Leave" in the UI – it is normalized to `paid` in the backend.
3. **Run the leave balance job** (or trigger recalculate) after adding or changing policies so existing employees get correct balances.

The leave system is now consistent across roles and aligned with leave policy and balance for every organization.
