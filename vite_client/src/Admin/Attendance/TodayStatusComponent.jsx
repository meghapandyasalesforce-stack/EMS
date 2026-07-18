import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  FiSmartphone,
  FiMonitor,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiUsers,
  FiBarChart2,
} from 'react-icons/fi';
import { fetchTodayStatus } from '../../context/attendanceSlice';
import { getUploadUrl } from '../../utils/axios';

const TEAL = '#0a8f6c';
const ORANGE = '#ea580c';
const RED = '#dc2626';
const AMBER = '#ca8a04';

function initials(emp) {
  const bits = [emp?.name, emp?.lastName].filter(Boolean).join(' ').trim();
  return (
    bits
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  );
}

function profileSrc(emp) {
  const photoRef = emp?.profilePhoto?.url || emp?.profilePhoto;
  if (!photoRef) return null;
  if (typeof photoRef === 'string') {
    return getUploadUrl(photoRef.startsWith('/') ? photoRef : `/uploads/${photoRef}`);
  }
  return getUploadUrl(photoRef.url || photoRef);
}

function RowAvatar({ employee, sizeClass = 'h-10 w-10' }) {
  const [broken, setBroken] = useState(false);
  const url = profileSrc(employee);
  const letter = initials(employee);

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white ${sizeClass}`}
      style={{
        background: `linear-gradient(135deg, ${TEAL} 0%, #14b887 100%)`,
      }}
    >
      {url && !broken ? (
        <img src={url} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <span className="text-xs">{letter}</span>
      )}
    </div>
  );
}

const TodayStatusComponent = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { todayStatus, loading, error } = useSelector((state) => state.attendance);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    dispatch(fetchTodayStatus({ forceAdmin: true }));
  }, [dispatch]);

  const formatTime = (timeString) => {
    if (!timeString) return '—';
    return new Date(timeString).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getDeviceIcon = (deviceType) => {
    switch (deviceType) {
      case 'mobile':
        return <FiSmartphone className="w-4 h-4" style={{ color: TEAL }} />;
      case 'tablet':
        return <FiSmartphone className="w-4 h-4 text-violet-600" />;
      case 'desktop':
        return <FiMonitor className="w-4 h-4" style={{ color: TEAL }} />;
      default:
        return <FiMonitor className="w-4 h-4 text-slate-400" />;
    }
  };

  const statusData = todayStatus?.data || [];

  const presentEmployees = statusData.filter((emp) => emp.status === 'present' && !emp.isOnBreak);
  const onBreakEmployees = statusData.filter((emp) => emp.isOnBreak);
  const absentEmployees = statusData.filter((emp) => emp.status === 'absent');
  const lateToday = presentEmployees.filter((e) => e.isLateArrival).length;

  const headerDate = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    []
  );

  if (loading && !statusData.length)
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-slate-500 bg-[#f4f7f6]">
        Loading today's roster…
      </div>
    );
  if (error)
    return (
      <div className="text-red-600 text-center py-8 sm:py-10 bg-[#f4f7f6]">
        {error.message || 'Something went wrong'}
      </div>
    );

  return (
    <div className="page-shell min-h-screen bg-[#f4f7f6]">
      <div className="page-shell-inner hrms-stack">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-1 text-sm font-medium text-slate-500">{headerDate}</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">Today's live roster</h1>
            <p className="mt-1 text-sm text-slate-600">Who's in, on break, or absent right now</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/all-attendance-history')}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
              style={{ background: TEAL }}
            >
              <FiBarChart2 className="h-4 w-4" />
              Attendance history
            </button>
            <button
              type="button"
              onClick={() => navigate('/attendance-regularization')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 bg-white px-5 py-2.5 text-sm font-semibold hover:bg-slate-50"
              style={{ borderColor: TEAL, color: TEAL }}
            >
              <FiClock className="h-4 w-4" />
              Regularization
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: 'Present now',
              value: String(presentEmployees.length),
              sub: 'Checked in, not on break',
              accent: TEAL,
            },
            {
              title: 'Late arrivals',
              value: String(lateToday).padStart(2, '0'),
              sub: 'Among present today',
              accent: ORANGE,
            },
            {
              title: 'Absent',
              value: String(absentEmployees.length).padStart(2, '0'),
              sub: 'No check-in yet',
              accent: RED,
            },
            {
              title: 'On break',
              value: String(onBreakEmployees.length),
              sub: 'Currently on break',
              accent: AMBER,
            },
          ].map((card) => (
            <div
              key={card.title}
              className="relative overflow-hidden rounded-2xl bg-white border border-slate-100 p-5 shadow-sm"
            >
              <div
                className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full opacity-10 pointer-events-none"
                style={{ background: card.accent }}
              />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{card.title}</p>
                  <p className="text-3xl font-bold text-slate-900">{card.value}</p>
                  <p className="text-sm text-slate-500 mt-1">{card.sub}</p>
                </div>
                <FiUsers className="h-8 w-8 text-slate-200 shrink-0" />
              </div>
            </div>
          ))}
        </div>

        <section className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/80">
            <h2 className="text-lg font-semibold text-slate-900">Present ({presentEmployees.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="px-6 py-3">Team member</th>
                  {!isMobile && <th className="px-4 py-3">Department</th>}
                  <th className="px-4 py-3">Clock in</th>
                  <th className="px-4 py-3">Device</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-6 py-3 pr-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {presentEmployees.map((emp) => {
                  const deviceType = emp.clockInNetwork?.deviceType || 'unknown';
                  const locationMatch =
                    emp.clockInLocation?.locationMatch !== undefined
                      ? emp.clockInLocation.locationMatch
                      : !!(emp.clockInLocation?.latitude && emp.clockInLocation?.longitude);
                  const locationAddress = emp.clockInLocation?.address || 'Not provided';
                  const locationDistance = emp.clockInLocation?.locationDistance;
                  const e = emp.employee;
                  const name = [e?.name, e?.lastName].filter(Boolean).join(' ').trim();

                  return (
                    <tr key={e?._id || name} className="hover:bg-[#fafcfc]">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <RowAvatar employee={e} />
                          <div>
                            <p className="font-semibold text-slate-900">{name || e?.name}</p>
                            <p className="text-xs text-slate-500">{e?.position || '—'}</p>
                          </div>
                        </div>
                      </td>
                      {!isMobile && (
                        <td className="px-4 py-4 text-slate-600">{e?.department || '—'}</td>
                      )}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={emp.isLateArrival ? 'font-semibold' : 'text-slate-800'} style={emp.isLateArrival ? { color: ORANGE } : undefined}>
                          {formatTime(emp.clockIn)}
                        </span>
                        {emp.isLateArrival && (
                          <span
                            className="ml-2 text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                            style={{ background: `${ORANGE}18`, color: ORANGE }}
                          >
                            Late
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-600 capitalize">
                          {getDeviceIcon(deviceType)}
                          {deviceType}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {locationMatch ? (
                          <span className="inline-flex items-center gap-1" style={{ color: TEAL }}>
                            <FiCheckCircle className="w-4 h-4 shrink-0" />
                            Verified
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-amber-600"
                            title={locationDistance ? `${locationAddress} (${Math.round(locationDistance)}m)` : locationAddress}
                          >
                            <FiAlertCircle className="w-4 h-4 shrink-0" />
                            Not verified
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 pr-6">
                        <span
                          className="text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full"
                          style={{ background: `${TEAL}18`, color: TEAL }}
                        >
                          Present
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {presentEmployees.length === 0 ? (
            <p className="py-8 sm:py-10 text-center text-slate-500 text-sm">No employees are checked in yet.</p>
          ) : null}
        </section>

        {onBreakEmployees.length > 0 ? (
          <section className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-slate-100 bg-amber-50/50">
              <h2 className="text-lg font-semibold text-slate-900">On break ({onBreakEmployees.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[640px] w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    <th className="px-6 py-3">Team member</th>
                    {!isMobile && <th className="px-4 py-3">Department</th>}
                    <th className="px-4 py-3">Clock in</th>
                    <th className="px-6 py-3 pr-6">Break</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {onBreakEmployees.map((emp) => {
                    const e = emp.employee;
                    const name = [e?.name, e?.lastName].filter(Boolean).join(' ').trim();
                    return (
                      <tr key={`b-${e?._id}`} className="hover:bg-[#fafcfc]">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <RowAvatar employee={e} />
                            <div>
                              <p className="font-semibold text-slate-900">{name || e?.name}</p>
                              <p className="text-xs text-slate-500">{e?.position}</p>
                            </div>
                          </div>
                        </td>
                        {!isMobile && (
                          <td className="px-4 py-4 text-slate-600">{e?.department}</td>
                        )}
                        <td className="px-4 py-4">{formatTime(emp.clockIn)}</td>
                        <td className="px-6 py-4 pr-6">
                          <span
                            className="text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full"
                            style={{ background: `${AMBER}22`, color: AMBER }}
                          >
                            {emp.currentBreakDuration ?? 0} min on break
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/80">
            <h2 className="text-lg font-semibold text-slate-900">Absent ({absentEmployees.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="px-6 py-3">Team member</th>
                  {!isMobile && <th className="px-4 py-3">Department</th>}
                  <th className="px-6 py-3 pr-6">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {absentEmployees.map((emp) => {
                  const e = emp.employee;
                  const name = [e?.name, e?.lastName].filter(Boolean).join(' ').trim();
                  return (
                    <tr key={`a-${e?._id}`} className="hover:bg-[#fafcfc]">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <RowAvatar employee={e} />
                          <div>
                            <p className="font-semibold text-slate-900">{name || e?.name}</p>
                            <p className="text-xs text-slate-500">{e?.position}</p>
                          </div>
                        </div>
                      </td>
                      {!isMobile && (
                        <td className="px-4 py-4 text-slate-600">{e?.department}</td>
                      )}
                      <td className="px-6 py-4 pr-6 text-slate-600">{e?.email || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {absentEmployees.length === 0 ? (
            <p className="py-8 sm:py-10 text-center text-slate-500 text-sm">Everyone checked in.</p>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default TodayStatusComponent;
