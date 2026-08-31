import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { FaHeadset } from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatCard from '../../components/StatCard';
import { 
  useEmployees, 
  useProjects, 
  usePayrolls,
  useAttendanceSummary 
} from '../../Hooks/useDashboardData';
import { handleApiError } from '../../utils/errorHandler';
import AnnouncementBanner from '../../components/AnnouncementBanner';
import axios from '../../utils/axios';
import { BOTH_CELEBRATION_ENDPOINT } from '../../utils/constant';


const CELEBRATION_REACTIONS = ['❤️', '🎉', '👏', '🥳'];
const sortCelebrations = (items = []) => [...items].sort((a,b)=>{const ad=Number.isFinite(Number(a?.daysUntil))?Number(a.daysUntil):9999; const bd=Number.isFinite(Number(b?.daysUntil))?Number(b.daysUntil):9999; if(ad!==bd) return ad-bd; const order={birthday:1, marriage_anniversary:2, anniversary:3}; return (order[a?.type]||99)-(order[b?.type]||99);});
function CelebrationDashboardCard({ item, isSelf=false, event, reacting=false, onReact, onWishes }) {
  const isToday=item?.daysUntil===0; const isMarriage=item?.type==='marriage_anniversary'; const isWork=item?.type==='anniversary';
  const icon=isMarriage?'💍':isWork?'🎉':'🎂'; const typeLabel=isMarriage?'Marriage Anniversary':isWork?'Work Anniversary':'Birthday';
  const dateLabel=item?.birthday||item?.anniversaryDate||item?.date||''; const whenLabel=item?.daysUntil===0?'Today':item?.daysUntil===1?'Tomorrow':`in ${item?.daysUntil} days`;
  const counts=event?.reactionCounts||{}; const header=isSelf?(isMarriage?'YOUR MARRIAGE ANNIVERSARY':isWork?'YOUR WORK ANNIVERSARY':"IT'S YOUR BIRTHDAY"):(isMarriage?'MARRIAGE ANNIVERSARY':isWork?'WORK ANNIVERSARY':'BIRTHDAY');
  return <li className={`min-w-0 overflow-hidden rounded-2xl border p-3.5 ${isToday?'border-amber-200 bg-gradient-to-br from-amber-50 via-rose-50 to-emerald-50 shadow-sm':'border-slate-100 bg-[#F8F9FB]'}`}>
    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wide text-orange-600">{header}</p><p className="truncate font-semibold text-slate-800">{icon} {isSelf?'You':item?.name||'Team member'}</p><p className="text-xs text-slate-500">{(isMarriage||isWork)&&item?.completedYears?`${item.completedYears} ${item.completedYears===1?'year':'years'} · `:''}{dateLabel?`${dateLabel} · `:''}{typeLabel} · {whenLabel}</p></div>{onWishes?<button type="button" onClick={()=>onWishes(item)} className="shrink-0 rounded-full bg-[#20C997] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1ab589]">{isToday ? 'Wishes' : 'Upcoming'}</button>:null}</div>
    {isToday&&onReact?<div className="mt-3 flex flex-wrap gap-1.5">{CELEBRATION_REACTIONS.map((emoji)=>{const count=counts[emoji]||0; return <button key={emoji} type="button" disabled={reacting} onClick={()=>onReact(item,emoji)} className={`inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-sm shadow-sm transition hover:border-emerald-300 hover:bg-white disabled:opacity-50 ${count>0?'border-emerald-200':'border-slate-200'}`} aria-label={`React ${emoji}`}><span>{emoji}</span>{count>0?<span className="text-xs font-semibold text-slate-600">{count}</span>:null}</button>})}</div>:null}
  </li>;
}

const DashboardTech = () => {
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    
    const position = employee?.position || user?.position || '';
    const department = employee?.department || user?.department || '';
    const [celebrations, setCelebrations] = useState([]);
    const [celebrationEvents, setCelebrationEvents] = useState({});
    const [celebrationReacting, setCelebrationReacting] = useState(false);
    
    // Use React Query hooks for parallel data fetching
    const {
        data: employeeData = { employees: [], total: 0 },
        isLoading: employeesLoading,
        error: employeesError
    } = useEmployees();
    const employees = employeeData?.employees ?? [];
    const employeeTotal = employeeData?.total ?? employees.length;
    
    const { 
        data: projectsData, 
        isLoading: projectsLoading, 
        error: projectsError 
    } = useProjects();
    
    const { 
        data: payrollsData, 
        isLoading: payrollsLoading, 
        error: payrollsError 
    } = usePayrolls();
    
    const { 
        data: attendanceData, 
        isLoading: attendanceLoading, 
        error: attendanceError 
    } = useAttendanceSummary();
    
    // Handle errors
    if (employeesError) handleApiError(employeesError);
    if (projectsError) handleApiError(projectsError);
    if (payrollsError) handleApiError(payrollsError);
    if (attendanceError) handleApiError(attendanceError);
    
    const isLoading = employeesLoading || projectsLoading || payrollsLoading || attendanceLoading;
    

    useEffect(() => {
        const fetchCelebrations = async () => {
            try {
                const { data } = await axios.get('/v1/both/profile-details/upcoming-birthdays', { withCredentials: true });
                const birthdays = data?.birthdays || [];
                const marriageAnniversaries = data?.marriageAnniversaries || [];
                const celebrationItems = data?.celebrations || [
                    ...birthdays.map((item) => ({ ...item, type: item.type || 'birthday' })),
                    ...marriageAnniversaries.map((item) => ({ ...item, type: 'marriage_anniversary' })),
                ];
                setCelebrations(sortCelebrations(celebrationItems));
            } catch {
                setCelebrations([]);
            }
        };
        fetchCelebrations();
    }, []);

    const selfEmployeeId = String(employee?._id || user?.employeeId || user?._id || '');
    const getCelebrationItemKey = (item) => `${item?.type || 'birthday'}_${item?.employeeId}`;
    const openTodayCelebrationEvent = async (item) => {
        const { data } = await axios.post(`${BOTH_CELEBRATION_ENDPOINT}/events/open`, { employeeId: item.employeeId, type: item.type || 'birthday' }, { withCredentials: true });
        const event = data?.data;
        if (event?._id) setCelebrationEvents((prev) => ({ ...prev, [getCelebrationItemKey(item)]: event }));
        return event;
    };
    const handleOpenCelebrationWishes = async (item) => {
        if (!item?.employeeId) return;
        try {
            if (item.daysUntil !== 0) { navigate('/celebrations'); return; }
            const itemKey = getCelebrationItemKey(item);
            const event = celebrationEvents[itemKey] || await openTodayCelebrationEvent(item);
            navigate(event?._id ? `/celebrations/${event._id}` : '/celebrations');
        } catch { navigate('/celebrations'); }
    };
    const handleCelebrationReact = async (item, emoji) => {
        if (item?.daysUntil !== 0) return;
        setCelebrationReacting(true);
        try {
            const itemKey = getCelebrationItemKey(item);
            const opened = celebrationEvents[itemKey] || await openTodayCelebrationEvent(item);
            if (!opened?._id) return;
            const { data } = await axios.post(`${BOTH_CELEBRATION_ENDPOINT}/events/${opened._id}/react`, { emoji }, { withCredentials: true });
            const eventStateKey = data?.data?.type && data?.data?.employeeId ? `${data.data.type}_${data.data.employeeId}` : itemKey;
            setCelebrationEvents((prev) => ({ ...prev, [eventStateKey]: { ...opened, ...(prev[eventStateKey] || {}), reactions: data?.data?.reactions || [], reactionCounts: data?.data?.reactionCounts || {} } }));
        } finally { setCelebrationReacting(false); }
    };

    if (isLoading) {
        return <LoadingSpinner message="Loading technology dashboard..." />;
    }
    
    const totalEmployees = employeeTotal;
    const totalProjects = projectsData?.length || 0;
    const totalPayrolls = payrollsData?.length || 0;
    const attendanceRate = attendanceData?.attendanceRate || 0;
    
    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <AnnouncementBanner />
            <div className="mb-6 flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Technology Dashboard</h1>
                    <p className="text-gray-600 mt-2">
                        Welcome to the Technology Department Dashboard
                    </p>
                </div>
                <Link
                    to="/helpdesk"
                    className="rounded-full border border-gray-200 bg-white p-2.5 text-gray-600 shadow-sm hover:bg-gray-50"
                    title="HR Helpdesk"
                >
                    <FaHeadset />
                </Link>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <StatCard
                    title="Total Employees"
                    value={totalEmployees}
                    icon="👥"
                    color="blue"
                />
                <StatCard
                    title="Active Projects"
                    value={totalProjects}
                    icon="📊"
                    color="green"
                />
                <StatCard
                    title="Payroll Records"
                    value={totalPayrolls}
                    icon="💰"
                    color="yellow"
                />
                <StatCard
                    title="Attendance Rate"
                    value={`${attendanceRate}%`}
                    icon="✅"
                    color="purple"
                />
            </div>

            {celebrations.length > 0 ? (
                <div className="mb-6 rounded-2xl border bg-white shadow-sm">
                    <div className="rounded-t-2xl bg-[#20C997] px-5 py-3">
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">🎂 Upcoming celebrations</h2>
                    </div>
                    <div className="p-5">
                        <ul className="space-y-3">
                            {celebrations.slice(0, 3).map((item, idx) => {
                                const itemKey = `${item.type || 'birthday'}_${item.employeeId}`;
                                return (
                                    <CelebrationDashboardCard key={`${item.type || 'birthday'}_${item.employeeId || idx}`} item={item} isSelf={Boolean(selfEmployeeId) && String(item.employeeId) === selfEmployeeId} event={celebrationEvents[itemKey]} reacting={celebrationReacting} onReact={handleCelebrationReact} onWishes={handleOpenCelebrationWishes} />
                                );
                            })}
                        </ul>
                    </div>
                </div>
            ) : null}
            
            {/* Department Info */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Department Information</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-gray-600">Department:</p>
                        <p className="text-lg font-semibold">{department || 'Technology'}</p>
                    </div>
                    <div>
                        <p className="text-gray-600">Position:</p>
                        <p className="text-lg font-semibold">{position || 'N/A'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardTech;

