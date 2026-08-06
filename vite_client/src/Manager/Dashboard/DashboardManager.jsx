import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { 
    FaUsers, FaTasks, FaCheckCircle,
    FaCalendarAlt,
    FaBell, FaPlus, FaSearch, FaVideo
} from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import AttendanceBox from '../../Employee/Attendance/AttendanceBox';
import AnnouncementBanner from '../../components/AnnouncementBanner';
import PersonalDashboardKpiRow from '../../components/PersonalDashboardKpiRow';
import LeaveBalanceCard from '../../components/LeaveBalanceCard';
import PasswordResetPopup from '../../Employee/PasswordResetPopup';
import { fetchEmployeeOwnInfo } from '../../context/employeeDetailsSlice';
import { updateLeave } from '../../context/leaveSlice';
import { formatLeaveApprovalStageDisplay } from '../../utils/approvalStatusDisplay';
import { format } from 'date-fns';
import axios from '../../utils/axios';
import { 
  useEmployees, 
  useProjects, 
  useTasks,
  useLeaves,
  useAttendanceSummary 
} from '../../Hooks/useDashboardData';
import { handleApiError } from '../../utils/errorHandler';
import { 
    BOTH_ATTENDANCE_ENDPOINT, 
    BOTH_TASK_ENDPOINT,
    EMPLOYEE_LEAVE_ENDPOINT 
} from '../../utils/constant';

/** Backend may return rate as 0–1 fraction or 0–100 percent */
const normalizeAttendancePercent = (rate) => {
    if (rate == null || typeof rate !== 'number' || Number.isNaN(rate)) return 0;
    let pct = rate >= 0 && rate <= 1 ? rate * 100 : rate;
    pct = Math.round(pct);
    return Math.min(100, Math.max(0, pct));
};

const isTeamLeave = (leave, teamIds) =>
    teamIds.includes(String(leave.employee?._id || '')) ||
    teamIds.includes(String(leave.employee || '')) ||
    teamIds.includes(String(leave.employeeId?._id || '')) ||
    teamIds.includes(String(leave.employeeId || ''));

/** Match admin leave list: pending-only for approvals */
const isLeavePendingStatus = (leave) => String(leave?.status || '').toLowerCase() === 'pending';

const getLeaveDurationDays = (leave) => {
    const d = Number(leave?.duration);
    if (Number.isFinite(d) && d > 0) return d;
    if (leave?.startDate && leave?.endDate) {
        const start = new Date(leave.startDate).getTime();
        const end = new Date(leave.endDate).getTime();
        if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
            return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
        }
    }
    return 1;
};

const getManagerFieldText = (managerField) => {
    if (!managerField) return '';
    if (typeof managerField === 'string') return managerField;
    if (typeof managerField === 'object') {
        const combined = `${managerField.name || ''} ${managerField.lastName || ''}`.trim();
        return combined || String(managerField.username || managerField.email || '');
    }
    return String(managerField);
};

const getMeetingScheduledAt = (meeting) => {
    if (!meeting) return null;

    const baseDate = meeting.scheduledDate ? new Date(meeting.scheduledDate) : null;
    if (!baseDate || Number.isNaN(baseDate.getTime())) return null;

    const timeValue = String(meeting.scheduledTime || '').trim();
    if (!timeValue) return baseDate;

    // Supports "HH:mm", "HH:mm:ss", "hh:mm AM/PM"
    const ampmMatch = timeValue.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (ampmMatch) {
        let hour = Number(ampmMatch[1]);
        const minute = Number(ampmMatch[2]);
        const second = Number(ampmMatch[3] || 0);
        const suffix = ampmMatch[4].toUpperCase();
        if (hour === 12) hour = 0;
        if (suffix === 'PM') hour += 12;
        baseDate.setHours(hour, minute, second, 0);
        return baseDate;
    }

    const plainMatch = timeValue.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (plainMatch) {
        const hour = Number(plainMatch[1]);
        const minute = Number(plainMatch[2]);
        const second = Number(plainMatch[3] || 0);
        if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59) {
            baseDate.setHours(hour, minute, second, 0);
        }
    }

    return baseDate;
};

const DashboardManager = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const queryClient = useQueryClient();
    const user = useSelector((state) => state.auth.user);
    
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [showResetPopup, setShowResetPopup] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);
    const [dashboardStats, setDashboardStats] = useState({
        todayHours: '0h',
        thisMonth: '₹0',
        leaveBalance: '0 days',
        tasksCount: '0',
        leaveDaysRemaining: '0',
        birthdays: null
    });
    const [statsLoading, setStatsLoading] = useState(true);
    const [attentionLoading, setAttentionLoading] = useState(false);
    const [attentionMembers, setAttentionMembers] = useState([]);
    const [attendanceHealth, setAttendanceHealth] = useState({
        onTimeScore: 0,
        absenceRisk: 0,
        avgCheckInTime: '--:--'
    });
    const [meetingsLoading, setMeetingsLoading] = useState(false);
    const [meetings, setMeetings] = useState([]);
    const [meetingsError, setMeetingsError] = useState('');
    const attentionRequestRef = useRef(0);
    const teamAttendanceRef = useRef(0);
    const [rejectDraft, setRejectDraft] = useState({ id: null, reason: '' });
    
    // Use React Query hooks for parallel data fetching
    const {
      data: employeeData = { employees: [], total: 0 },
      isLoading: employeesLoading,
      error: employeesError
    } = useEmployees();
    const employees = employeeData?.employees ?? [];

    const { 
      data: projects = [], 
      isLoading: projectsLoading 
    } = useProjects();

    const { 
      data: tasks = [], 
      isLoading: tasksLoading 
    } = useTasks();

    const { 
      data: leaves = [], 
      isLoading: leavesLoading 
    } = useLeaves();

    const userId = user?._id || user?.id || '';
    const managerName = user?.name ? `${user.name} ${user.lastName || ''}`.trim() : '';
    const managerFirstName = user?.name || '';

    // Filter team members by manager field (employees linked to this manager)
    const teamMembers = useMemo(
        () => userId
            ? employees.filter(emp => {
                // Check managerId (ObjectId) first — most reliable
                if (emp.managerId && String(emp.managerId) === String(userId)) return true;
                // Fallback to manager string match
                if (!managerName) return false;
                const empManagerText = getManagerFieldText(emp.manager);
                const empManagerNormalized = empManagerText.toLowerCase();
                const managerNameNormalized = managerName.toLowerCase();
                const managerFirstNormalized = managerFirstName.toLowerCase();
                return empManagerText === managerName ||
                    empManagerText === managerFirstName ||
                    empManagerNormalized === managerNameNormalized ||
                    empManagerNormalized.startsWith(managerFirstNormalized);
            })
            : employees,
        [employees, userId, managerName, managerFirstName]
    );
    
    // Filter projects by manager or team members
    const teamMemberIds = useMemo(
        () => teamMembers
            .map(emp => (emp._id || emp.id || '').toString())
            .filter(Boolean),
        [teamMembers]
    );
    const teamMemberIdsKey = useMemo(() => teamMemberIds.join(','), [teamMemberIds]);
    const managerProjects = useMemo(
        () => userId
            ? projects.filter(proj =>
                String(proj.managerId || '') === String(userId) ||
                String(proj.manager?._id || '') === String(userId) ||
                (proj.projectLeader?._id && teamMemberIds.includes(proj.projectLeader._id.toString())) ||
                proj.projectMembers?.some(member =>
                    teamMemberIds.includes(member._id?.toString()) ||
                    teamMemberIds.includes(member.toString())
                )
            )
            : projects,
        [projects, teamMemberIds, userId]
    );
    
    // Filter tasks by team members (employees linked to manager)
    const teamTasks = useMemo(
        () => tasks.filter(task =>
            teamMemberIds.includes(task.employee?._id?.toString()) ||
            teamMemberIds.includes(task.employee?.toString()) ||
            teamMemberIds.includes(task.assignedTo?._id?.toString()) ||
            teamMemberIds.includes(task.assignedTo?.toString()) ||
            teamMemberIds.includes(task.employeeId?.toString())
        ),
        [tasks, teamMemberIds]
    );

    // Get attendance summary for team
    const { 
      data: attendanceData = {}, 
      isLoading: attendanceLoading 
    } = useAttendanceSummary({
      employeeIds: teamMemberIdsKey,
      startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    });

    const isLoading = employeesLoading || projectsLoading || tasksLoading || leavesLoading || attendanceLoading;

    // Calculate statistics
    const teamSize = teamMembers.length;
    const pendingTasks = teamTasks.filter(task =>
        task.status === 'Not Started' || task.status === 'In Progress' || task.status === 'pending'
    ).length;
    const teamAttendance = normalizeAttendancePercent(attendanceData?.attendanceRate);
    
    const teamLeaves = useMemo(
        () => leaves.filter((leave) => isTeamLeave(leave, teamMemberIds)),
        [leaves, teamMemberIds]
    );
    const teamPendingLeaves = useMemo(
        () => teamLeaves.filter(isLeavePendingStatus),
        [teamLeaves]
    );
    const pendingApprovals = teamPendingLeaves.length;

    const leaveUpdating = useSelector((state) => state.leave.loading);

    useEffect(() => {
        teamAttendanceRef.current = teamAttendance;
    }, [teamAttendance]);

    useEffect(() => {
        let stale = false;
        const fetchTeamAttentionMetrics = async () => {
            if (!teamMemberIds.length) {
                setAttentionMembers([]);
                setAttendanceHealth({
                    onTimeScore: 0,
                    absenceRisk: 0,
                    avgCheckInTime: '--:--'
                });
                setAttentionLoading(false);
                return;
            }

            const requestId = attentionRequestRef.current + 1;
            attentionRequestRef.current = requestId;
            setAttentionLoading(true);
            try {
                const startDate = format(new Date(new Date().setDate(new Date().getDate() - 30)), 'yyyy-MM-dd');
                const endDate = format(new Date(), 'yyyy-MM-dd');
                const responses = await Promise.allSettled(
                    teamMembers.map((member) =>
                        axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/employee/${member._id || member.id}/attendance`, {
                            params: { startDate, endDate },
                            withCredentials: true
                        })
                    )
                );

                let totalAttendancePct = 0;
                let totalCheckInMinutes = 0;
                let checkInCount = 0;
                let successfulMembersCount = 0;

                const memberScores = responses
                    .map((response, index) => {
                        if (response.status !== 'fulfilled') return null;
                        successfulMembersCount += 1;
                        const member = teamMembers[index];
                        const payload = response.value?.data || {};
                        const stats = payload.statistics || {};
                        const records = payload.recentRecords || [];
                        const period = payload.period || {};

                        const workingDays = Number(period.workingDays || 0);
                        const presentDays = Number(stats.presentDays || 0);
                        const absentDays = Number(stats.absentDays || 0);
                        const halfDays = Number(stats.halfDays || 0);
                        const lateCount = Number(stats.lateDays || stats.lateCount || 0);
                        const missedPunchCount = records.filter((record) => record?.clockIn && !record?.clockOut).length;

                        const attendancePct =
                            typeof stats.attendanceRate === 'number'
                                ? normalizeAttendancePercent(stats.attendanceRate)
                                : workingDays > 0
                                  ? Math.max(0, Math.min(100, Math.round(((presentDays + halfDays * 0.5) / workingDays) * 100)))
                                  : 0;

                        let dominantIssue = 'Low attendance trend';
                        if (missedPunchCount >= lateCount && missedPunchCount >= absentDays && missedPunchCount > 0) {
                            dominantIssue = 'Punch compliance issues';
                        } else if (lateCount >= absentDays && lateCount > 0) {
                            dominantIssue = 'Frequent late check-ins';
                        } else if (absentDays === 0 && lateCount === 0 && missedPunchCount === 0) {
                            dominantIssue = 'Healthy attendance pattern';
                        }

                        const riskPenalty = (lateCount * 3) + (missedPunchCount * 8) + (absentDays * 4);
                        const score = Math.max(0, Math.min(100, Math.round(attendancePct - riskPenalty)));

                        totalAttendancePct += attendancePct;
                        records.forEach((record) => {
                            if (!record?.clockIn) return;
                            const d = new Date(record.clockIn);
                            if (Number.isNaN(d.getTime())) return;
                            totalCheckInMinutes += d.getHours() * 60 + d.getMinutes();
                            checkInCount += 1;
                        });

                        return {
                            name: `${member?.name || member?.firstName || 'Team Member'} ${member?.lastName || ''}`.trim(),
                            issue: dominantIssue,
                            score
                        };
                    })
                    .filter(Boolean)
                    .sort((a, b) => a.score - b.score)
                    .slice(0, 5);

                const avgAttendancePct = successfulMembersCount ? Math.round(totalAttendancePct / successfulMembersCount) : 0;
                const avgMinutes = checkInCount ? Math.round(totalCheckInMinutes / checkInCount) : null;
                const avgCheckInTime = (() => {
                    if (avgMinutes == null) return '--:--';
                    const hour24 = Math.floor(avgMinutes / 60);
                    const minute = avgMinutes % 60;
                    const hour12 = ((hour24 + 11) % 12) + 1;
                    const suffix = hour24 >= 12 ? 'PM' : 'AM';
                    return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${suffix}`;
                })();

                if (!stale && requestId === attentionRequestRef.current) {
                    setAttentionMembers(memberScores);
                    setAttendanceHealth({
                        onTimeScore: avgAttendancePct,
                        absenceRisk: Math.max(0, 100 - avgAttendancePct),
                        avgCheckInTime
                    });
                }
            } catch (e) {
                if (!stale && requestId === attentionRequestRef.current) {
                    const fallback = teamAttendanceRef.current;
                    setAttentionMembers([]);
                    setAttendanceHealth({
                        onTimeScore: Math.max(0, Math.min(100, fallback)),
                        absenceRisk: Math.max(0, 100 - fallback),
                        avgCheckInTime: '--:--'
                    });
                }
            } finally {
                if (!stale && requestId === attentionRequestRef.current) {
                    setAttentionLoading(false);
                }
            }
        };

        fetchTeamAttentionMetrics();
        return () => {
            stale = true;
        };
    }, [teamMemberIdsKey]);

    // Fetch employee own info
    useEffect(() => {
        const fetchData = async () => {
            if (hasFetched) {
                return;
            }
            
            try {
                setLoading(true);
                setHasFetched(true);
                const result = await dispatch(fetchEmployeeOwnInfo());
                if (fetchEmployeeOwnInfo.rejected.match(result)) {
                    setError(result.payload || 'Failed to load employee information');
                }
            } catch (error) {
                const status = error?.response?.status;
                if (status === 401 || status === 403) {
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                } else {
                    setError('An unexpected error occurred');
                }
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [dispatch, hasFetched]);

    // Fetch dashboard statistics
    useEffect(() => {
        const fetchDashboardStats = async () => {
            try {
                setStatsLoading(true);
                const today = format(new Date(), 'yyyy-MM-dd');
                const currentMonth = new Date().getMonth() + 1;
                const currentYear = new Date().getFullYear();

                // Fetch today's attendance
                const todayLogs = await axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/get-logs`, {
                    params: { startDate: today, endDate: today },
                    withCredentials: true
                });

                // Fetch this month's attendance for hours calculation
                const firstDayOfMonth = format(new Date(currentYear, currentMonth - 1, 1), 'yyyy-MM-dd');
                const lastDayOfMonth = format(new Date(currentYear, currentMonth, 0), 'yyyy-MM-dd');
                
                const monthLogs = await axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/get-logs`, {
                    params: { startDate: firstDayOfMonth, endDate: lastDayOfMonth },
                    withCredentials: true
                });

                // Fetch leave balance from Leave data
                let leaveBalance = 0;
                try {
                    const leaveRes = await axios.get(`${EMPLOYEE_LEAVE_ENDPOINT}/get-my-leaves`, {
                        withCredentials: true
                    });
                    if (leaveRes.data?.statistics?.remainingLeaves !== undefined) {
                        leaveBalance = leaveRes.data.statistics.remainingLeaves;
                    }
                } catch (err) {
                    // Silently handle error
                }

                // Fetch tasks count
                let tasksCount = 0;
                try {
                    const tasksRes = await axios.get(`${BOTH_TASK_ENDPOINT}/all-tasks`, {
                        withCredentials: true
                    });
                    tasksCount = tasksRes.data?.tasks?.length || 0;
                } catch (err) {
                    // Silently handle error
                }

                // Fetch upcoming birthdays
                let birthdays = [];
                try {
                    const birthdaysRes = await axios.get('/v1/both/profile-details/upcoming-birthdays', {
                        withCredentials: true
                    });
                    if (birthdaysRes.data?.birthdays) {
                        birthdays = birthdaysRes.data.birthdays;
                    }
                } catch (err) {
                    // Silently handle error
                }

                // Calculate today's hours
                const todaySession = todayLogs.data?.sessions?.[0];
                let todayHours = '0h';
                if (todaySession && todaySession.clockOut) {
                    const hoursWorked = todaySession.effectiveHours || 0;
                    todayHours = `${hoursWorked.toFixed(1)}h`;
                } else if (todaySession && todaySession.clockIn && !todaySession.clockOut) {
                    todayHours = 'In Progress';
                } else {
                    todayHours = '0h';
                }

                // Calculate month's total hours
                const monthHours = monthLogs.data?.summary?.totalEffectiveHours || 0;

                // Update state
                setDashboardStats({
                    todayHours,
                    thisMonth: '₹0',
                    leaveBalance: `${leaveBalance} days`,
                    tasksCount: tasksCount.toString(),
                    leaveDaysRemaining: leaveBalance.toString(),
                    birthdays: birthdays
                });
            } catch (error) {
                // Keep default values
            } finally {
                setStatsLoading(false);
            }
        };

        fetchDashboardStats();
    }, []);

    useEffect(() => {
        if (user?.mustResetPassword) {
            setShowResetPopup(true);
        }
    }, [user]);

    useEffect(() => {
        let stale = false;
        const fetchMeetings = async () => {
            if (!user) return;
            try {
                setMeetingsLoading(true);
                setMeetingsError('');
                const response = await axios.get('/v1/both/one-on-one/one-on-ones', {
                    withCredentials: true
                });
                if (stale) return;
                const rows = response.data?.data;
                setMeetings(Array.isArray(rows) ? rows : []);
            } catch (err) {
                if (!stale) {
                    setMeetings([]);
                    setMeetingsError(err?.response?.data?.message || 'Failed to load meetings');
                    toast.error(err?.response?.data?.message || 'Unable to fetch upcoming meetings');
                }
            } finally {
                if (!stale) {
                    setMeetingsLoading(false);
                }
            }
        };

        fetchMeetings();
        return () => {
            stale = true;
        };
    }, [user?._id, user?.id]);

    // Handle errors
    React.useEffect(() => {
        if (employeesError) {
            handleApiError(employeesError, { 
                context: 'Manager Dashboard', 
                showToast: employeesError.response?.status !== 401 
            });
        }
    }, [employeesError]);

    const handleApproveLeave = async (leaveId) => {
        if (!leaveId) return;
        try {
            await dispatch(updateLeave({ id: leaveId, updatedData: { status: 'approved' } })).unwrap();
            toast.success('Leave approved successfully.');
            queryClient.invalidateQueries({ queryKey: ['leaves'] });
            setRejectDraft({ id: null, reason: '' });
        } catch (err) {
            const msg = typeof err === 'string' ? err : err?.message || err?.error || 'Failed to approve leave';
            toast.error(msg);
        }
    };

    const handleRejectLeaveConfirm = async (leaveId) => {
        const reason = rejectDraft.reason?.trim();
        if (!leaveId) return;
        if (!reason) {
            toast.warning('Please enter a rejection reason.');
            return;
        }
        try {
            await dispatch(
                updateLeave({
                    id: leaveId,
                    updatedData: { status: 'rejected', rejectionReason: reason },
                })
            ).unwrap();
            toast.success('Leave rejected.');
            queryClient.invalidateQueries({ queryKey: ['leaves'] });
            setRejectDraft({ id: null, reason: '' });
        } catch (err) {
            const msg = typeof err === 'string' ? err : err?.message || err?.error || 'Failed to reject leave';
            toast.error(msg);
        }
    };
    const upcomingMeetings = useMemo(() => {
        const now = new Date();
        return (meetings || [])
            .map((meeting) => {
                const scheduledAt = getMeetingScheduledAt(meeting);
                return !scheduledAt || Number.isNaN(scheduledAt.getTime()) ? null : { ...meeting, scheduledAt };
            })
            .filter(Boolean)
            .filter((meeting) => {
                const status = String(meeting.status || '').toLowerCase();
                return meeting.scheduledAt >= now && status !== 'cancelled' && status !== 'completed';
            })
            .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
            .slice(0, 2);
    }, [meetings]);
    
    if (user?.mustResetPassword) {
        return (
            <div className="min-h-screen bg-gray-50 p-3 sm:p-4 lg:p-5 transition-all duration-300">
                <PasswordResetPopup onClose={() => navigate('/login')} />
            </div>
        );
    }

    if (loading || isLoading) {
        return <LoadingSpinner message="Loading Manager Dashboard..." />;
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 p-3 sm:p-4 lg:p-5 transition-all duration-300 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600 font-medium mb-4">Error: {error}</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="bg-theme-secondary text-white px-6 py-2 rounded-lg hover:bg-theme-primary transition"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-gray-50 p-3 sm:p-4 lg:p-5 transition-all duration-300 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-600 font-medium mb-4">Please log in to access the dashboard</p>
                    <button 
                        onClick={() => navigate('/login')} 
                        className="bg-theme-secondary text-white px-6 py-2 rounded-lg hover:bg-theme-primary transition"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }
    
    const lateTasks = teamTasks.filter((task) => {
        if (!task?.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        return dueDate < new Date() && task.status !== 'Completed' && task.status !== 'completed';
    }).length;
    return (
        <div className="min-h-screen bg-[#f6f8fb] transition-all duration-300">
            {showResetPopup && <PasswordResetPopup onClose={() => setShowResetPopup(false)} />}

            <div className="page-shell !px-3 sm:!px-4 lg:!px-5">
            <div className="page-shell-inner w-full min-w-0">
            <div className="hrms-stack w-full min-w-0">
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm md:px-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold text-slate-900">
                                Good morning, {user?.name || user?.username || 'Manager'} 👋
                            </h1>
                            <p className="text-sm text-slate-500">{format(new Date(), 'dd MMM yyyy')}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="hidden min-w-[260px] items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 lg:flex">
                                <FaSearch className="text-slate-400" />
                                <input
                                    readOnly
                                    value=""
                                    placeholder="Search..."
                                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                                />
                            </div>
                            <button
                                className="relative rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"
                                onClick={() => navigate('/notifications')}
                            >
                                <FaBell />
                                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-orange-500"></span>
                            </button>
                            <button
                                className="h-10 w-10 rounded-full bg-slate-100 text-sm font-semibold text-slate-700"
                                onClick={() => navigate('/view-profile')}
                            >
                                {(user?.name || 'M').charAt(0).toUpperCase()}
                            </button>
                        </div>
                    </div>
                </div>

                <AnnouncementBanner />
                <AttendanceBox variant="dashboard" />

                <PersonalDashboardKpiRow />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Team Size</p>
                            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600"><FaUsers /></div>
                        </div>
                        <p className="text-4xl font-bold text-slate-900">{teamSize}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending Tasks</p>
                            <div className="rounded-lg bg-amber-50 p-2 text-amber-600"><FaTasks /></div>
                        </div>
                        <p className="text-4xl font-bold text-slate-900">{pendingTasks}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attendance</p>
                            <div className="rounded-lg bg-teal-50 p-2 text-teal-600"><FaCheckCircle /></div>
                        </div>
                        <p className="text-4xl font-bold text-slate-900">{teamAttendance}%</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending Leave</p>
                            <div className="rounded-lg bg-slate-100 p-2 text-slate-600"><FaCalendarAlt /></div>
                        </div>
                        <p className="text-4xl font-bold text-slate-900">{pendingApprovals}</p>
                    </div>
                </div>

                <div className="grid w-full min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
                    <div className="flex w-full min-w-0 flex-col gap-4">
                        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="mb-4 flex items-center justify-between">
                                <h3 className="text-2xl font-semibold text-slate-900">Attendance Health</h3>
                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-600"></span>Good</span>
                                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400"></span>Needs attention</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">On-time score</p>
                                    <p className="mt-2 text-3xl font-bold text-emerald-700">{attendanceHealth.onTimeScore}%</p>
                                    <div className="mt-3 h-2 rounded-full bg-slate-200">
                                        <div className="h-2 rounded-full bg-emerald-700" style={{ width: `${attendanceHealth.onTimeScore}%` }}></div>
                                    </div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Absence risk</p>
                                    <p className="mt-2 text-3xl font-bold text-orange-500">{attendanceHealth.absenceRisk}%</p>
                                    <div className="mt-3 h-2 rounded-full bg-slate-200">
                                        <div className="h-2 rounded-full bg-orange-400" style={{ width: `${attendanceHealth.absenceRisk}%` }}></div>
                                    </div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avg Check-In Time</p>
                                    <p className="mt-2 text-2xl font-bold text-slate-900">{attendanceHealth.avgCheckInTime}</p>
                                    <p className="text-xs text-slate-500">Estimated team median</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overdue Team Tasks</p>
                                    <p className="mt-2 text-2xl font-bold text-slate-900">{lateTasks}</p>
                                    <p className="text-xs text-slate-500">Attendance impact indicator</p>
                                </div>
                            </div>
                            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Attention Needed</h4>
                                <div className="space-y-2">
                                    {attentionLoading && attentionMembers.length === 0 ? (
                                        <div className="text-sm text-slate-500">Calculating real attendance scores...</div>
                                    ) : attentionMembers.length > 0 ? attentionMembers.map((member, index) => (
                                        <div key={`${member.name}-${index}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                                            <div>
                                                <p className="text-sm font-medium text-slate-900">{member.name}</p>
                                                <p className="text-xs text-slate-500">{member.issue}</p>
                                            </div>
                                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${member.score >= 75 ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                                                {member.score}%
                                            </span>
                                        </div>
                                    )) : (
                                        <div className="text-sm text-slate-500">No attention flags right now.</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Team Approvals</h3>
                            <div className="space-y-4">
                                {teamPendingLeaves.slice(0, 2).map((leave, index) => (
                                    <div key={leave?._id || index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="mb-2 flex items-center justify-between">
                                            <h4 className="font-semibold text-slate-900">{leave?.leaveType || 'Leave Request'}</h4>
                                            <span className="text-xs text-slate-500">{leave?.createdAt ? format(new Date(leave.createdAt), 'd MMM') : 'Now'}</span>
                                        </div>
                                        <p className="mb-3 text-sm text-slate-600">
                                            {(leave?.employee?.name || leave?.employeeId?.name || leave?.employeeName || 'Team Member')} requested approval
                                            ({getLeaveDurationDays(leave)} day{getLeaveDurationDays(leave) === 1 ? '' : 's'}).
                                        </p>
                                        {leave?.workflowSummary?.hrOverrideUsed ? (
                                            <div className="mb-3 flex flex-wrap gap-2">
                                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-200">
                                                    {formatLeaveApprovalStageDisplay(leave)}
                                                </span>
                                            </div>
                                        ) : null}
                                        {rejectDraft.id === leave._id && (
                                            <div className="mb-3">
                                                <textarea
                                                    value={rejectDraft.reason}
                                                    onChange={(e) => setRejectDraft((d) => ({ ...d, reason: e.target.value }))}
                                                    placeholder="Reason for rejection"
                                                    rows={2}
                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-emerald-500/30 focus:border-emerald-500 focus:ring-2"
                                                />
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                disabled={leaveUpdating || !leave?._id}
                                                onClick={() => handleApproveLeave(leave._id)}
                                                className="rounded-full bg-emerald-700 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Approve
                                            </button>
                                            {rejectDraft.id === leave._id ? (
                                                <button
                                                    type="button"
                                                    disabled={leaveUpdating || !leave?._id}
                                                    onClick={() => handleRejectLeaveConfirm(leave._id)}
                                                    className="rounded-full border border-red-300 bg-red-50 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    Confirm reject
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled={leaveUpdating}
                                                    onClick={() => setRejectDraft({ id: leave._id, reason: '' })}
                                                    className="rounded-full border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                                                >
                                                    Reject
                                                </button>
                                            )}
                                        </div>
                                        {rejectDraft.id === leave._id && (
                                            <button
                                                type="button"
                                                onClick={() => setRejectDraft({ id: null, reason: '' })}
                                                className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-700"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {teamPendingLeaves.length === 0 && (
                                    <div className="rounded-xl border border-dashed border-slate-300 px-4 py-4 text-center text-sm text-slate-500">
                                        No pending approvals right now.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex w-full min-w-0 flex-col gap-4">
                        <LeaveBalanceCard />

                        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Upcoming Meetings</h3>
                            <div className="space-y-3">
                                {meetingsLoading ? (
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                                        Loading upcoming meetings...
                                    </div>
                                ) : meetingsError ? (
                                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
                                        {meetingsError}
                                    </div>
                                ) : upcomingMeetings.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-slate-300 px-4 py-4 text-center text-sm text-slate-500">
                                        No upcoming meetings scheduled.
                                    </div>
                                ) : (
                                    upcomingMeetings.map((meeting) => {
                                        const employeeName = `${meeting?.employeeId?.name || ''} ${meeting?.employeeId?.lastName || ''}`.trim() || 'Team member';
                                        return (
                                            <div key={meeting._id} className="rounded-xl border border-slate-200 bg-white p-3">
                                                <p className="font-semibold text-slate-900">1:1 with {employeeName}</p>
                                                <p className="text-xs text-slate-600">
                                                    {format(meeting.scheduledAt, 'hh:mm a')} · {format(meeting.scheduledAt, 'dd MMM yyyy')}
                                                    {meeting.location ? ` · ${meeting.location}` : ''}
                                                </p>
                                                <div className="mt-2 flex gap-2">
                                                    {meeting.meetingLink ? (
                                                        <a
                                                            href={meeting.meetingLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                                                        >
                                                            <FaVideo className="text-[10px]" />
                                                            Join
                                                        </a>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate('/one-on-one')}
                                                            className="rounded-full bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                                                        >
                                                            Open
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate('/one-on-one')}
                                                        className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                    >
                                                        Details
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Active Projects</h3>
                            <div className="space-y-4">
                                {managerProjects.slice(0, 2).map((project, index) => {
                                    const progress = Number(project?.progress || project?.completion || 40 + index * 25);
                                    const clampedProgress = Math.max(10, Math.min(100, progress));
                                    return (
                                        <div key={project?._id || index} className="rounded-xl border border-slate-200 p-4">
                                            <div className="mb-2 flex items-center justify-between">
                                                <p className="font-semibold text-slate-900">{project?.name || 'Project'}</p>
                                                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700">
                                                    {clampedProgress >= 70 ? 'On Track' : 'At Risk'}
                                                </span>
                                            </div>
                                            <div className="h-2 rounded-full bg-slate-200">
                                                <div className="h-2 rounded-full bg-emerald-700" style={{ width: `${clampedProgress}%` }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {managerProjects.length === 0 && (
                                    <div className="rounded-xl border border-dashed border-slate-300 px-4 py-4 text-center text-sm text-slate-500">
                                        No active projects found.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            </div>
            </div>

            <button
                className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg hover:bg-emerald-600"
                onClick={() => navigate('/leave-management')}
            >
                <FaPlus />
            </button>
        </div>
    );
};

export default DashboardManager;
