import { describe, it, expect } from 'vitest';
import { buildDailyReport, durationLabel } from './dailyReportUtils';
const calendar = { workingDays: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false }, holidays: [] };
const makeRows = (changes = {}) => buildDailyReport({ month: '2026-10', logs: { sessions: [], dailyStats: {} }, calendar, timezone: 'Asia/Kolkata', now: new Date('2026-10-29T06:00:00Z'), ...changes });
const day = (rows, date) => rows.find((r) => r.day === date);
describe('complete daily attendance log', () => {
 it('includes every calendar day without fabricating LOP, future absences or weekend absences', () => {
  const rows=makeRows(); expect(rows).toHaveLength(31);
  expect(day(rows,'2026-10-01').status).toBe('No punch');expect(day(rows,'2026-10-04').status).toBe('Weekly off');
  expect(day(rows,'2026-10-29').status).toBe('Not punched in');expect(day(rows,'2026-10-30').status).toBe('Upcoming');
  expect(rows.some(r=>r.status==='LOP')).toBe(false);
 });
 it('shows approved LOP and half-day leave while preserving pending and rejected history', () => {
  const rows=makeRows({leaves:[
   {leaveType:'loss_of_pay',startDate:'2026-10-05T00:00:00Z',endDate:'2026-10-05T00:00:00Z',status:'approved'},
   {leaveType:'casual',startDate:'2026-10-06',endDate:'2026-10-06',status:'approved',isHalfDay:true,halfDayType:'first_half'},
   {leaveType:'loss_of_pay',startDate:'2026-10-07',endDate:'2026-10-07',status:'pending'},
   {leaveType:'casual',startDate:'2026-10-08',endDate:'2026-10-08',status:'rejected'},
  ]});
  expect(day(rows,'2026-10-05').status).toBe('LOP');expect(day(rows,'2026-10-06').status).toBe('Half-day leave');
  expect(day(rows,'2026-10-06').leaveLabel(day(rows,'2026-10-06').leaves[0])).toContain('First half');
  expect(day(rows,'2026-10-07').status).toBe('No punch');expect(day(rows,'2026-10-08').leaves[0].status).toBe('rejected');
 });
 it('honors company holidays, working-day overrides and employment boundaries', () => {
  const rows=makeRows({employee:{joiningDate:'2026-10-02',lastWorkingDate:'2026-10-28'},calendar:{...calendar,holidays:[
   {name:'Holiday',date:'2026-10-02',isActive:true},{name:'Working Saturday',date:'2026-10-03',workModeOverride:'office',isActive:true},
   {name:'Half holiday',date:'2026-10-06',isHalfDay:true,isActive:true},
  ]}});
  expect(day(rows,'2026-10-01').status).toBe('Outside employment');expect(day(rows,'2026-10-02').status).toBe('Holiday');
  expect(day(rows,'2026-10-03').status).toBe('No punch');expect(day(rows,'2026-10-06').status).toBe('No punch');
  expect(day(rows,'2026-10-29').status).toBe('Outside employment');
 });
 it('retains multiple punches, authoritative hours, breaks and all regularization states', () => {
  const rows=makeRows({regularizations:['pending','approved','rejected','cancelled'].map(status=>({attendanceDate:'2026-10-28',status})),logs:{sessions:[
   {attendanceDateKey:'2026-10-28',clockIn:'2026-10-28T04:30:00Z',clockOut:'2026-10-28T07:30:00Z',workLocation:'office',isLateArrival:true,breaks:[{breakIn:'2026-10-28T05:30:00Z',breakOut:'2026-10-28T06:00:00Z'}]},
   {attendanceDateKey:'2026-10-28',clockIn:'2026-10-28T08:00:00Z',clockOut:'2026-10-28T12:30:00Z',workLocation:'work_from_home'},
  ],dailyStats:{'2026-10-28':{effectiveHours:7,status:'present'}}}});
  const row=day(rows,'2026-10-28');expect(row.sessions).toHaveLength(2);expect(row.netHours).toBe(7);expect(row.breakSeconds).toBe(1800);
  expect(row.requests).toHaveLength(4);expect(row.regularized).toBe(true);expect(row.late).toBe(true);expect(row.locations).toEqual(['office','work_from_home']);
  expect(row.checkIn).toBe(Date.parse('2026-10-28T04:30:00Z'));expect(row.checkOut).toBe(Date.parse('2026-10-28T12:30:00Z'));
 });
 it('shows an ongoing break at refresh time without inventing a checkout', () => {
  const rows=makeRows({logs:{sessions:[{attendanceDateKey:'2026-10-29',clockIn:'2026-10-28T23:30:00Z',breaks:[{breakIn:'2026-10-29T05:30:00Z'}]}],dailyStats:{'2026-10-29':{effectiveHours:0}}}});
  const row=day(rows,'2026-10-29');expect(row.status).toBe('On break');expect(row.checkOut).toBeNull();expect(durationLabel(row.breakSeconds)).toBe('0h 30m');
  expect(row.hasPunch).toBe(true);expect(row.active).toBe(true);
 });
 it('handles leap years and does not assume a weekend schedule when the calendar is unavailable', () => {
  expect(makeRows({month:'2024-02'})).toHaveLength(29);expect(day(makeRows({calendar:null}),'2026-10-04').status).toBe('No punch');
 });
});
