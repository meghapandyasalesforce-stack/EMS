# Payroll — how pay is calculated

This document describes how payroll works in this EMS: attendance, half day, proration, salary split, PF, ESI, professional tax, and TDS.

Settings take effect on the next generate or regenerate. Existing payslips stay as they were until that month is regenerated.

## 1. What a payroll run covers

Each employee has one monthly payroll record per month. Extra payments (bonus, full-and-final, correction) are separate off-cycle records that sit on top of that month.

A run includes only employees whose monthly salary is greater than 0, and who are either active, or terminated with a last working date or termination date inside that month.

The monthly gross used for the run is the salary that is effective for that month (`salary`, or the matching row in `salaryRevisions`). A hike applies from the month it becomes effective. Earlier months in the year stay at the old amount.

## 2. When payroll is created

| Action | What happens | Status saved |
|---|---|---|
| Admin preview | Mid-month estimate. Math still uses the full calendar month, not "up to today". | Pending (provisional) |
| Admin final | Allowed on or after the last day of that month in the organization timezone. | Processed |
| Automatic job | 1st of each month at 02:00, for the previous month only. | Processed |

Future months cannot be generated. Paid, Processed, or locked rows are skipped on regenerate. Cancelled is a void status and is excluded from year-to-date tax.

The employee can see the slip as soon as it is generated (`isVisible` is true).

## 3. The pay formula

Salary is divided by the number of calendar days in the full month, not by working days. Weekends and holidays inside the employment window are paid. Pay is reduced only when a working day is not fully paid.

```
unpaid working days = working days in the service window − paid presence
paid payroll days   = calendar days employed this month − unpaid working days
payable gross       = round(monthly salary × paid payroll days ÷ days in the full month)
```

**Service window** is the overlap of the calendar month with employment: from the joining date (if they joined this month) through the last working date or termination date (if they left this month). Otherwise it is the 1st through the last day of the month.

**Working days** come from the organization calendar for that year: weekdays marked working, minus active holidays. If there is no calendar, Monday–Friday are working and Saturday–Sunday are not.

**Paid presence** (stored as `presentDays`) is the sum, over each working day in the service window, of:

```
min(1, attendance credit + approved paid leave)
```

Loss of pay does not add to paid presence.

### Example — full month, one unpaid day

April has 30 calendar days and 22 working days. The employee is fully paid on 21 working days and unpaid on 1.

- Unpaid working days = 1
- Paid payroll days = 30 − 1 = 29
- Payable gross = round(salary × 29 / 30)

The weekend days are still inside the 29. Only the one missing working day is cut.

### Example — joined on 16 April, no absence

- Days employed = 15 (16th through 30th)
- If every working day in that window is fully paid, unpaid = 0
- Payable gross = round(salary × 15 / 30)

### Example — joined on 16 April and missed 1 working day

- Paid payroll days = 15 − 1 = 14
- Payable gross = round(salary × 14 / 30)

If the service window is empty (joined after they left, or outside the month), the payslip is all zeros.

## 4. Attendance credit — two modes

Set this under organization Payroll Settings. The default is **Work Hours Based**.

Hours used for credit are `grossHours` when that is greater than 0, otherwise `effectiveHours`. If both are 0, credit is 0.

If several attendance rows exist for the same day, the highest credit is kept, and it cannot exceed 1. Punches on a non-working day (weekend or holiday) are ignored for pay credit.

### 4.1 Work Hours Based (default)

Credit is fractional against a fixed 8-hour day. The "min hours for full day / half day" settings are not used in this mode.

| Attendance status | Credit |
|---|---|
| `present` or `loggedout` | hours ÷ 8, capped at 1 |
| `half-day` | hours ÷ 8, capped at 0.5 |
| anything else, or 0 hours | 0 |

Examples:

- 8 hours, present → 1.0
- 6 hours, present → 0.75
- 4 hours, present → 0.5
- 4 hours, half-day → 0.5
- 7 hours, half-day → 0.5 (the half-day status caps it)
- Punch-in only, 0 hours → 0

### 4.2 Day Based

The employee must have punched out (`clockOut` or `checkOut`) and the status must be `present`, `loggedout`, or `half-day`. No punch-out means 0 credit, even if hours are stored.

Default thresholds (editable in Payroll Settings; half-day hours must be lower than full-day hours):

| Hours worked | Credit |
|---|---|
| ≥ min hours for full day (default 8) | 1.0 |
| ≥ min hours for half day (default 4) and below full day | 0.5 |
| below half-day minimum | 0 |

Two extra caps then apply:

- Status `half-day` caps credit at 0.5, even if they worked 8 hours.
- If **Mark half day if late** is on and the row is a late arrival, credit is capped at 0.5.

"Late" means clock-in is after office start plus the check-in grace from Attendance Rules. Example: office start 10:00 and grace 30 minutes → late after 10:30. If the first half of that day is already leave or a half-day holiday, the late line starts at the second-half start instead.

That same late rule also writes the attendance status as `half-day` on punch-in and keeps it on punch-out, so the day stays half-day even when the person later works a full set of hours.

In Day Based mode, 6 hours is 0.5 (it crossed 4 and not 8). In Work Hours mode, those same 6 hours are 0.75.

## 5. Half day — three different things

These stack. They are separate rules.

**A. Approved half-day leave**

An approved leave with `isHalfDay` or duration 0.5 gives 0.5 paid-leave credit on the first overlapping working day only. It does not spread 0.5 across every day of a range.

**B. Attendance marked half-day**

Clock-out sets status `half-day` when any of these is true:

- The day plan expects only half a day (approved half-day leave, or a half-day holiday).
- Worked hours are below half of the expected hours for that day.
- Day Based mode is on, "mark half day if late" is on, and the person was late.

Payroll then applies the credit rules in section 4.

**C. Overlap of punch and leave on the same date**

Approved leave wins for the portion it covers. Pending or rejected leave is ignored.

```
leave coverage = min(1, paid leave + loss-of-pay fraction)
attendance credit is capped at 1 − leave coverage
day total = min(1, capped attendance + paid leave)
```

A half-day paid leave plus a punch on the other half can still total 1.0. A full-day approved leave zeros the attendance credit for that day, so a punch is not paid on top of full leave. A full-day loss of pay also zeros attendance credit for that day and adds no paid leave, so the day is unpaid.

## 6. Leave and loss of pay

Only **approved** leave in the service window is used.

| Leave | Effect on pay |
|---|---|
| Sick, casual, vacation, annual, paid, other (not loss of pay) | Counts as paid leave. Full day = 1 on each working day in the overlap. Half day = 0.5 on the first overlapping working day. |
| `loss_of_pay` | Does not add paid days. It only blocks attendance credit on those days so a punch is not paid as well. |

Paid leave days are stored separately as `paidLeaveDays`. Unpaid leave stored on the slip is `working days − present days`.

Weekends and holidays inside a leave range are not counted as leave days.

## 7. How the payable gross is split

The system looks up a salary structure in this order:

1. The structure assigned on the employee, if it is active.
2. An active structure matching department, position, or level.
3. An active structure that applies to everyone.

### With a salary structure

All of these are calculated on the **payable gross** (after attendance proration), then rounded to rupees:

| Component | Base |
|---|---|
| Basic | % of payable gross, or a fixed amount |
| HRA, transport, medical | % of basic, or a fixed amount |
| Special allowance | payable gross − basic − HRA − transport − medical (never negative) |
| Performance, project, attendance bonus | % of payable gross, only if that bonus is enabled, then capped by its max amount |
| Overtime | added on top; see below |

### With no salary structure

| Component | Formula |
|---|---|
| Basic | 50% of payable gross |
| HRA | 40% of basic |
| Special allowance | payable gross − basic − HRA |
| Transport, medical, bonuses | 0 |
| Gratuity on the monthly slip | 0 (gratuity is paid through full-and-final, not the monthly split) |

## 8. Overtime

Overtime hours are the sum of `overtimeHours` on attendance rows for that month. Attendance itself sets overtime when effective hours exceed the expected hours for that day.

```
one calendar-day rate = full monthly salary ÷ days in the full month
hourly rate          = (one calendar-day rate ÷ 8) × multiplier
overtime pay         = round(capped overtime hours × hourly rate)
```

The default multiplier is 1.5. With a salary structure, overtime can be turned off, the multiplier can be set (1 to 3), and hours are capped by max hours per month (default 50). The day cap on the structure is not applied again inside payroll; the monthly cap is.

Overtime is paid on top of the prorated gross. It is not reduced again by absent days.

## 9. PF, ESI, and professional tax

These are calculated on the prorated month, then income tax is calculated after them.

**PF**

- PF wage = basic, capped at ₹15,000.
- Employee PF and employer PF are each that wage × the structure percentage (default 12%), rounded.
- With no structure, both are 12% of the capped wage.
- If the employee's `deductPf` is false, both employee and employer PF are set to 0.

**ESI**

ESI uses statutory wages, not the full gross.

- Included: basic (plus dearness and retaining allowance if those amounts are passed in; the monthly payroll split does not currently send dearness or retaining as separate fields).
- Excluded at first: HRA, transport, medical, special allowance, overtime, and bonuses.
- If excluded pay is more than 50% of total remuneration, the excess is added back into wages.
- ESI applies only when those statutory wages are ₹21,000 or less.
- With a structure: employee and employer percentages on those wages (defaults 0.75% and 3.25%).
- With no structure: employee 0.75%, employer 3.25%.
- If `deductEsi` is false, both employee and employer ESI are 0.

**Professional tax**

- With a structure: the configured percentage or fixed amount, applied to payable gross.
- With no structure: 0.

**Advances, loans, and other deductions** are 0 on a generated monthly slip. They can be entered on a manual edit or on an off-cycle record.

## 10. Take-home and CTC stored on the slip

```
total earnings = basic + HRA + transport + medical + special
               + overtime + bonuses + gratuity
               + employer PF + employer ESI

total deductions = employee PF + employee ESI + professional tax
                 + income tax (TDS) + advance + loan + other

CTC stored        = total earnings
in-hand stored    = total earnings − total deductions
```

Employer PF and employer ESI sit inside total earnings and are not in deductions, so the stored in-hand figure includes them. The employee's actual bank credit is total earnings minus employer PF, employer ESI, and total deductions.

## 11. TDS (income tax)

TDS is Indian income tax using the FY 2025-26 rules in the code: slab tax, rebate under section 87A, surcharge with marginal relief, then 4% cess. The financial year runs April to March.

The organization chooses the monthly cut in Payroll Settings. The default is **Past TDS adjustment (cumulative)**.

Tax regime comes from the employee's financial details. A blank regime is treated as **New**. Regime **N/A** means payroll TDS is 0. A month with no salary is also 0.

### 11.1 What is taxed

Employee taxable gross for a month is:

basic + HRA + special + transport + medical + overtime + performance bonus + project bonus + attendance bonus

Employer PF, employer ESI, and gratuity are not in this gross.

Year-to-date figures come from earlier monthly slips in the same financial year that are visible and not cancelled. If more than one slip exists for a month, the latest update is used.

Projected annual income is:

```
year-to-date taxable gross
+ this month's taxable gross
+ (monthly salary effective this month × months still left after this month)
```

A future hike is not assumed early. Remaining months are projected at this month's salary. Basic and HRA used for old-regime HRA exemption are scaled by the same ratio (projected annual gross ÷ full-year gross at this month's salary).

The employment window respects joining date and last working or termination date, in the organization timezone. Someone who joined in July is not treated as employed since April. Someone who has already exited before this payroll month gets 0 TDS.

### 11.2 New regime

```
total income = projected annual gross − ₹75,000 standard deduction
```

Slabs:

| Annual income | Rate |
|---|---|
| Up to ₹4,00,000 | 0% |
| ₹4,00,001 – ₹8,00,000 | 5% |
| ₹8,00,001 – ₹12,00,000 | 10% |
| ₹12,00,001 – ₹16,00,000 | 15% |
| ₹16,00,001 – ₹20,00,000 | 20% |
| ₹20,00,001 – ₹24,00,000 | 25% |
| Above ₹24,00,000 | 30% |

If total income is ₹12,00,000 or less, rebate under 87A wipes tax up to ₹60,000. Declarations (80C, 80D, HRA, home loan) are not applied in the new regime.

### 11.3 Old regime

Deductions apply only when the employee's tax declaration financial year matches this payroll financial year.

```
total income = projected annual gross
             − ₹50,000 standard deduction
             − section 80C (declared only, cap ₹1,50,000)
             − section 80D
             − section 80E (education-loan interest)
             − section 24(b) home-loan interest (cap ₹2,00,000)
             − HRA exemption
             − annual professional tax
```

80C is only what was declared (EPF, PPF, LIC, ELSS, tuition, home-loan principal, other). Declared EPF is capped at ₹21,600. Payroll PF is not added automatically. A blank EPF declaration means no PF reduction.

80D caps: ₹25,000 for self/family, ₹50,000 if senior citizen; same caps for parents.

HRA exemption is the lowest of:

- annual HRA
- annual rent − 10% of annual basic
- 50% of annual basic in a metro, otherwise 40%

Old slabs:

| Annual income | Rate |
|---|---|
| Up to ₹2,50,000 | 0% |
| ₹2,50,001 – ₹5,00,000 | 5% |
| ₹5,00,001 – ₹10,00,000 | 20% |
| Above ₹10,00,000 | 30% |

If total income is ₹5,00,000 or less, rebate under 87A wipes tax up to ₹12,500.

### 11.4 Surcharge and cess

Surcharge is on tax after rebate, with marginal relief so crossing a band does not increase tax-plus-surcharge by more than the extra income.

| Taxable income | Old regime | New regime |
|---|---|---|
| Up to ₹50 lakh | 0% | 0% |
| ₹50 lakh – ₹1 crore | 10% | 10% |
| ₹1 – ₹2 crore | 15% | 15% |
| ₹2 – ₹5 crore | 25% | 25% |
| Above ₹5 crore | 37% | 25% |

Annual tax = round((tax after rebate + surcharge) × 1.04).

### 11.5 How much TDS is cut this month

**Cumulative (default) — past TDS is adjusted**

The divisor is the employee's months in this financial year (join month through March, or through the exit month), not always 12.

```
tax due till this month = round(annual tax × months elapsed ÷ employment months in the FY)
TDS this month         = max(0, tax due till this month − TDS already deducted this FY)
```

If earlier months deducted too little, this month catches up. If they deducted too much, this month's TDS is 0. Past slips are not rewritten.

Example: joined in April, annual tax ₹1,20,000, this is July (4th month), ₹30,000 already deducted.

- Tax due till July = round(1,20,000 × 4 / 12) = ₹40,000
- TDS in July = 40,000 − 30,000 = ₹10,000

Example: joined in October, still employed through March (6 employment months), this is October (1st month), nothing deducted yet, annual tax ₹60,000.

- Tax due = round(60,000 × 1 / 6) = ₹10,000
- TDS in October = ₹10,000

**Independent — remaining tax spread over months left**

```
months left including this month = months after this month + 1
TDS this month = round((annual tax − TDS already deducted) ÷ those months)
```

If this month's taxable gross is 0, TDS this month is 0.

Example: annual tax ₹1,20,000, ₹30,000 already deducted, this is July (July through March = 9 months).

- TDS in July = round(90,000 / 9) = ₹10,000

July in both examples can match. They diverge when earlier months were short or heavy: cumulative reloads the shortfall into this month; independent only spreads whatever tax is still left.

## 12. Off-cycle pay

| Subtype | Use |
|---|---|
| bonus | Extra earning |
| correction | Earning, deduction, or full override |
| fnf | Full-and-final settlement |

Only off-cycle rows that are Processed or Paid are added into the month total.

A full override replaces the monthly base. Adjustments created before that override are left out. Adjustments created on or after it are still added.

Full-and-final, when the payroll bridge is enabled, creates one off-cycle `fnf` row:

- Pending dues + leave encashment → special allowance
- Bonus → performance bonus
- Gratuity estimate → gratuity
- Recoveries → other deductions
- Tax on the settlement → income tax
- Net = those earnings − those deductions (not below 0)

## 13. What is stored on the monthly slip

| Field | Meaning |
|---|---|
| `basicSalary` | Payable gross after proration (not the basic-wage component) |
| `workingDays` | Working days in the service window |
| `presentDays` | Paid presence (attendance + paid leave, max 1 per working day) |
| `paidLeaveDays` | Approved paid leave only |
| `unpaidLeave` | Working days − present days |
| `earnings.*` | Split above, including employer PF/ESI inside total earnings |
| `deductions.incomeTax` | This month's TDS |
| `deductions.total` | All employee deductions |
| `ctc` | Total earnings |
| `inHandSalary` | Total earnings − total deductions |
| `status` | Pending, Processed, Paid, or Cancelled |

Payslip "salary paid days" is the same as paid payroll days: calendar days employed minus unpaid working days.

## 14. Settings checklist

**Payroll Settings**

- Calculation mode: Work Hours Based or Day Based
- Day Based only: min hours for full day (default 8), min hours for half day (default 4)
- Day Based only: mark half day if late
- TDS: cumulative or independent

**Attendance rules**

- Office start and check-in grace (used for the late → half-day rule)
- Expected hours (used to mark half-day on clock-out and to compute overtime hours)

**Calendar**

- Working weekdays and active holidays for the year

**Employee**

- Monthly salary and revision dates
- Joining date, last working date, termination date
- Salary structure assignment
- `deductPf`, `deductEsi`
- Tax regime and a tax declaration whose financial year matches the payroll year

Changing any of these does not rewrite an existing slip. Generate or regenerate that month to apply it. Paid, Processed, and locked slips are left unchanged.
