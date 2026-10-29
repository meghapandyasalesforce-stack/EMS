import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DailyReport from './DailyReport';
import axios from '../utils/axios';
import { BOTH_ATTENDANCE_ENDPOINT, EMPLOYEE_LEAVE_ENDPOINT } from '../utils/constant';
vi.mock('../utils/axios', () => ({ default: { get: vi.fn() } }));
vi.mock('react-redux', () => ({ useSelector: (selector) => selector({ timezone: { timezone: 'Asia/Kolkata' }, employeeDetails: { employee: null } }) }));
const calendar = { holidays: [], workingDays: { monday:true,tuesday:true,wednesday:true,thursday:true,friday:true,saturday:false,sunday:false } };
let logs;
const respond=async url=> url.endsWith('/get-logs')?{data:logs}:url.endsWith('/get-my-leaves')?{data:{leaves:[]}}:url.includes('/attendance-regularization/')?{data:{data:[],pagination:{pages:1}}}:{data:calendar};
beforeEach(()=>{vi.clearAllMocks();logs={sessions:[],dailyStats:{}};axios.get.mockImplementation(respond);});
const open=async()=>{render(<MemoryRouter><DailyReport/></MemoryRouter>);fireEvent.change(screen.getByLabelText('Report month'),{target:{value:'2026-10'}});await screen.findByRole('heading',{name:'October 2026'});};
const rowFor=day=>screen.getByRole('button',{name:`Details for ${day}`}).closest('tr');
describe('Daily attendance report',()=>{
 it('shows all days, uses self-only APIs, filters logs and preserves server-calculated hours',async()=>{
  logs={sessions:[{attendanceDateKey:'2026-10-29',clockIn:'2026-10-29T04:30:00Z',clockOut:'2026-10-29T12:30:00Z'}],dailyStats:{'2026-10-29':{effectiveHours:7.25,status:'present'}}};
  await open();expect(screen.getAllByRole('button',{name:/Details for/})).toHaveLength(31);expect(within(rowFor('2026-10-29')).getByText('7.25 hrs')).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(`${BOTH_ATTENDANCE_ENDPOINT}/get-logs`,{params:{startDate:'2026-10-01',endDate:'2026-10-31'},withCredentials:true});
  expect(axios.get).toHaveBeenCalledWith(`${EMPLOYEE_LEAVE_ENDPOINT}/get-my-leaves`,{withCredentials:true});
  fireEvent.change(screen.getByLabelText('Filter logs'),{target:{value:'punched'}});expect(screen.getAllByRole('button',{name:/Details for/})).toHaveLength(1);
 });
 it('loads every regularization page and keeps requested times separate from actual punches',async()=>{
  axios.get.mockImplementation(async(url,options)=>url.includes('/attendance-regularization/')?{data:{data:options.params.page===1?[{_id:'r1',attendanceDate:'2026-10-29',status:'pending',regularizationType:'both',reason:'Forgot to punch',requestedClockIn:'2026-10-29T04:30:00Z'}]:[{_id:'r2',attendanceDate:'2026-10-28',status:'rejected'}],pagination:{pages:2}}}:respond(url));
  await open();expect(axios.get).toHaveBeenCalledWith('/v1/both/attendance-regularization/request',{params:{page:2,limit:100},withCredentials:true});
  const row=within(rowFor('2026-10-29'));expect(row.getByText('Pending regularization')).toBeInTheDocument();expect(row.queryByText(/10:00 AM/)).not.toBeInTheDocument();
  fireEvent.click(row.getByRole('button',{name:'Details for 2026-10-29'}));expect(screen.getByText('Forgot to punch')).toBeInTheDocument();expect(screen.getByText(/Requested times: 10:00 AM/)).toBeInTheDocument();
 });
 it('warns about missing supporting sources without hiding attendance',async()=>{
  axios.get.mockImplementation(async url=>{if(url.includes('/get-my-leaves')||url.includes('/employee/calendar/'))throw new Error('Unavailable');return respond(url);});
  await open();expect(screen.getByRole('status')).toHaveTextContent('Leave and LOP records; Company holidays and weekly offs unavailable');expect(screen.getAllByRole('button',{name:/Details for/})).toHaveLength(31);
 });
 it('retries attendance errors and loads the selected month when navigating',async()=>{
  axios.get.mockImplementation(async url=>{if(url.endsWith('/get-logs'))throw new Error('Attendance temporarily unavailable');return respond(url);});
  render(<MemoryRouter><DailyReport/></MemoryRouter>);expect(await screen.findByRole('alert')).toHaveTextContent('Attendance temporarily unavailable');axios.get.mockImplementation(respond);
  fireEvent.click(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('Report month'),{target:{value:'2026-10'}});await screen.findByRole('heading',{name:'October 2026'});fireEvent.click(screen.getByRole('button',{name:'Previous month'}));await screen.findByRole('heading',{name:'September 2026'});
  expect(screen.getAllByRole('button',{name:/Details for/})).toHaveLength(30);
 });
});
