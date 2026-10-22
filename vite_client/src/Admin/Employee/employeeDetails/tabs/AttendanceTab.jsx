import React, { useEffect, useMemo, useState } from 'react';
import axios from '../../../../utils/axios';
import { BOTH_ATTENDANCE_ENDPOINT } from '../../../../utils/constant';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Stitch May 2025 — shown as-is when live attendance is unavailable. */
const STITCH_DEMO = {
  year: 2025,
  month: 5,
  metrics: {
    totalWorkingDays: 22,
    officePresent: 19,
    wfhDays: 2,
    leavesTaken: 1,
    avgDailyHours: 8.9,
  },
  days: {
    1: { kind: 'holiday', label: 'Holiday' },
    2: { kind: 'present', hours: 9.5 },
    5: { kind: 'present', hours: 9.3 },
    6: { kind: 'present', hours: 9.7 },
    7: { kind: 'wfh', hours: 9 },
    8: { kind: 'present', hours: 9.4 },
    9: { kind: 'present', hours: 9.4 },
    12: { kind: 'present', hours: 9.2 },
    13: { kind: 'leave', label: 'Leave' },
    14: { kind: 'present', hours: 9.6 },
    15: { kind: 'present', hours: 9.2 },
    16: { kind: 'wfh', hours: 9 },
    19: { kind: 'present', hours: 9.1 },
    20: { kind: 'present', hours: 9.4 },
    21: { kind: 'present', hours: 9.3 },
    22: { kind: 'present', hours: 9.5 },
    23: { kind: 'present', hours: 9.2 },
    26: { kind: 'present', hours: 9.0 },
    27: { kind: 'present', hours: 9.6 },
    28: { kind: 'present', hours: 9.1 },
    29: { kind: 'present', hours: 9.3 },
    30: { kind: 'present', hours: 8.8 },
  },
};

const pad2 = (n) => String(n).padStart(2, '0');
const toDateKey = (year, month, day) => `${year}-${pad2(month)}-${pad2(day)}`;

const formatHours = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${Math.round(n * 10) / 10}h`;
};

const formatPunchTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

const isWeekendDate = (year, month, day) => {
  const dow = new Date(year, month - 1, day).getDay();
  return dow === 0 || dow === 6;
};

const mondayOffset = (year, month) => {
  const dow = new Date(year, month - 1, 1).getDay();
  return dow === 0 ? 6 : dow - 1;
};

const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

const classifyRecord = (record) => {
  if (!record) return null;
  const status = String(record.status || '').toLowerCase();
  const location = String(record.workLocation || '').toLowerCase();
  const hours = Number(record.effectiveHours || record.averageWorkHours || 0);

  if (status === 'absent') return { kind: 'leave', label: 'Leave', record };
  if (location === 'work_from_home' || location === 'wfh' || location.includes('remote')) {
    return { kind: 'wfh', hours, record };
  }
  if (['present', 'loggedout', 'logged_out', 'onbreak', 'half-day', 'halfday'].includes(status)) {
    return { kind: 'present', hours, record };
  }
  if (hours > 0) return { kind: 'present', hours, record };
  return null;
};

const buildTiles = (year, month, dayMap) => {
  const totalDays = daysInMonth(year, month);
  const offset = mondayOffset(year, month);
  const tiles = [];

  for (let i = 0; i < offset; i += 1) {
    tiles.push({ key: `pad-${i}`, type: 'pad' });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const weekend = isWeekendDate(year, month, day);
    const entry = dayMap[day] || null;
    if (entry) {
      tiles.push({ key: `d-${day}`, type: 'day', day, weekend, ...entry });
    } else if (weekend) {
      const label = new Date(year, month - 1, day).getDay() === 6 ? 'Sat' : 'Sun';
      tiles.push({ key: `d-${day}`, type: 'day', day, weekend: true, kind: 'off', label });
    } else {
      tiles.push({ key: `d-${day}`, type: 'day', day, weekend: false, kind: 'empty' });
    }
  }

  return tiles;
};

const metricsFromMap = (map, workingDays, avgDailyHours) => {
  let officePresent = 0;
  let wfhDays = 0;
  let leavesTaken = 0;
  let hoursSum = 0;
  let hoursDays = 0;

  Object.values(map).forEach((entry) => {
    if (entry.kind === 'present') {
      officePresent += 1;
      if (entry.hours > 0) {
        hoursSum += entry.hours;
        hoursDays += 1;
      }
    } else if (entry.kind === 'wfh') {
      wfhDays += 1;
      if (entry.hours > 0) {
        hoursSum += entry.hours;
        hoursDays += 1;
      }
    } else if (entry.kind === 'leave') {
      leavesTaken += 1;
    }
  });

  const avg =
    Number.isFinite(Number(avgDailyHours)) && Number(avgDailyHours) > 0
      ? Number(avgDailyHours)
      : hoursDays > 0
        ? Math.round((hoursSum / hoursDays) * 10) / 10
        : 0;

  return {
    totalWorkingDays: Number(workingDays) || officePresent + wfhDays + leavesTaken,
    officePresent,
    wfhDays,
    leavesTaken,
    avgDailyHours: avg,
  };
};

const AttendanceTab = ({ employeeId }) => {
  const [year] = useState(STITCH_DEMO.year);
  const [month] = useState(STITCH_DEMO.month);
  const [loading, setLoading] = useState(Boolean(employeeId));
  const [usingDemo, setUsingDemo] = useState(true);
  const [metrics, setMetrics] = useState(STITCH_DEMO.metrics);
  const [dayMap, setDayMap] = useState(STITCH_DEMO.days);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const applyDemo = () => {
      setMetrics(STITCH_DEMO.metrics);
      setDayMap(STITCH_DEMO.days);
      setUsingDemo(true);
      setLoading(false);
    };

    if (!employeeId) {
      applyDemo();
      return undefined;
    }

    const load = async () => {
      setLoading(true);
      const startDate = toDateKey(year, month, 1);
      const endDate = toDateKey(year, month, daysInMonth(year, month));

      try {
        const res = await axios.get(
          `${BOTH_ATTENDANCE_ENDPOINT}/employee/${employeeId}/attendance`,
          { params: { startDate, endDate, full: true } }
        );
        if (cancelled) return;

        const payload = res.data || {};
        const records = Array.isArray(payload.recentRecords) ? payload.recentRecords : [];
        const map = {};

        records.forEach((record) => {
          const key =
            record.attendanceDateKey ||
            record.dateKey ||
            (record.date ? String(record.date).slice(0, 10) : null);
          if (!key || !key.startsWith(`${year}-${pad2(month)}`)) return;
          const day = Number(key.slice(8, 10));
          if (!day) return;
          const classified = classifyRecord(record);
          if (classified) map[day] = classified;
        });

        if (Object.keys(map).length === 0) {
          applyDemo();
          return;
        }

        setDayMap(map);
        setMetrics(
          metricsFromMap(map, payload.period?.workingDays, payload.statistics?.avgDailyHours)
        );
        setUsingDemo(false);
        setLoading(false);
      } catch {
        if (!cancelled) applyDemo();
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [employeeId, year, month]);

  const tiles = useMemo(() => buildTiles(year, month, dayMap), [year, month, dayMap]);
  const monthTitle = `Monthly Attendance Heatmap (${MONTH_NAMES[month - 1]} ${year})`;

  const openDay = (tile) => {
    if (!tile || tile.type !== 'day') return;
    if (tile.kind === 'empty' || tile.kind === 'off') return;
    setSelectedDay(tile);
  };

  const dayDetail = useMemo(() => {
    if (!selectedDay) return null;
    const record = selectedDay.record;
    if (!record) {
      return {
        title:
          selectedDay.kind === 'holiday'
            ? 'Holiday'
            : selectedDay.kind === 'leave'
              ? 'Leave'
              : selectedDay.kind === 'wfh'
                ? 'WFH (Remote)'
                : 'Present',
        clockIn: '—',
        clockOut: '—',
        hours: formatHours(selectedDay.hours) || (selectedDay.kind === 'leave' ? '0h' : '—'),
        note: usingDemo ? 'Design preview sample day' : 'No punch detail available',
      };
    }
    return {
      title:
        selectedDay.kind === 'wfh'
          ? 'WFH (Remote)'
          : selectedDay.kind === 'leave'
            ? 'Leave'
            : 'Present',
      clockIn: formatPunchTime(record.clockIn || record.checkIn),
      clockOut: formatPunchTime(record.clockOut || record.checkOut),
      hours: formatHours(record.effectiveHours) || '0h',
      note: record.workLocation === 'work_from_home' ? 'Work from home' : 'Office',
    };
  }, [selectedDay, usingDemo]);

  return (
    <div className="att-tab">
      <div className="att-tab__metrics">
        <div className="att-tab__metric">
          <p className="att-tab__metric-label">Total Working Days</p>
          <p className="att-tab__metric-value">{metrics.totalWorkingDays}</p>
        </div>
        <div className="att-tab__metric">
          <p className="att-tab__metric-label">Office Present</p>
          <p className="att-tab__metric-value att-tab__metric-value--primary">
            {metrics.officePresent} Days
          </p>
        </div>
        <div className="att-tab__metric">
          <p className="att-tab__metric-label">WFH (Remote)</p>
          <p className="att-tab__metric-value att-tab__metric-value--secondary">
            {metrics.wfhDays} Days
          </p>
        </div>
        <div className="att-tab__metric">
          <p className="att-tab__metric-label">Leaves Taken</p>
          <p className="att-tab__metric-value att-tab__metric-value--leave">
            {metrics.leavesTaken} Day{metrics.leavesTaken === 1 ? '' : 's'}
          </p>
        </div>
        <div className="att-tab__metric">
          <p className="att-tab__metric-label">Avg Daily Hours</p>
          <p className="att-tab__metric-value">{metrics.avgDailyHours} hrs</p>
        </div>
      </div>

      <div className="att-tab__heatmap">
        <div className="att-tab__heatmap-head">
          <div>
            <h2 className="att-tab__heatmap-title">{monthTitle}</h2>
            <p className="att-tab__heatmap-sub">
              Click any day tile to inspect turnstile punch records
            </p>
          </div>
          <div className="att-tab__legend">
            <span>
              <i className="att-tab__swatch att-tab__swatch--present" /> Present
            </span>
            <span>
              <i className="att-tab__swatch att-tab__swatch--wfh" /> WFH
            </span>
            <span>
              <i className="att-tab__swatch att-tab__swatch--leave" /> Leave
            </span>
            <span>
              <i className="att-tab__swatch att-tab__swatch--off" /> Off / Weekend
            </span>
          </div>
        </div>

        {loading ? (
          <div className="att-tab__loading">Loading attendance…</div>
        ) : (
          <div className="att-tab__grid" role="grid" aria-label={monthTitle}>
            {WEEKDAYS.map((label) => (
              <div
                key={label}
                className={`att-tab__dow${label === 'Sat' || label === 'Sun' ? ' is-weekend' : ''}`}
              >
                {label}
              </div>
            ))}
            {tiles.map((tile) => {
              if (tile.type === 'pad') {
                return <div key={tile.key} className="att-tab__pad" aria-hidden="true" />;
              }

              const interactive =
                tile.kind === 'present' ||
                tile.kind === 'wfh' ||
                tile.kind === 'leave' ||
                tile.kind === 'holiday';

              const className = [
                'att-tab__day',
                tile.kind === 'present' ? 'is-present' : '',
                tile.kind === 'wfh' ? 'is-wfh' : '',
                tile.kind === 'leave' ? 'is-leave' : '',
                tile.kind === 'holiday' || tile.kind === 'off' ? 'is-off' : '',
                tile.kind === 'empty' ? 'is-empty' : '',
                interactive ? 'is-interactive' : '',
              ]
                .filter(Boolean)
                .join(' ');

              let caption = tile.label || '';
              if (tile.kind === 'present') caption = formatHours(tile.hours) || '';
              if (tile.kind === 'wfh') {
                caption = `WFH ${formatHours(tile.hours) || ''}`.trim();
              }
              if (tile.kind === 'leave') caption = 'Leave';
              if (tile.kind === 'holiday') caption = 'Holiday';

              const Tag = interactive ? 'button' : 'div';

              return (
                <Tag
                  key={tile.key}
                  type={interactive ? 'button' : undefined}
                  className={className}
                  onClick={interactive ? () => openDay(tile) : undefined}
                >
                  <span className="att-tab__day-num">{tile.day}</span>
                  {caption ? <span className="att-tab__day-cap">{caption}</span> : null}
                </Tag>
              );
            })}
          </div>
        )}
      </div>

      {selectedDay && dayDetail ? (
        <div
          className="att-tab__modal-backdrop"
          role="presentation"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="att-tab__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="att-day-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="att-tab__modal-head">
              <h3 id="att-day-title">
                {MONTH_NAMES[month - 1]} {selectedDay.day}, {year}
              </h3>
              <button
                type="button"
                className="att-tab__modal-close"
                onClick={() => setSelectedDay(null)}
              >
                Close
              </button>
            </div>
            <p className="att-tab__modal-status">{dayDetail.title}</p>
            <dl className="att-tab__modal-grid">
              <div>
                <dt>Clock in</dt>
                <dd>{dayDetail.clockIn}</dd>
              </div>
              <div>
                <dt>Clock out</dt>
                <dd>{dayDetail.clockOut}</dd>
              </div>
              <div>
                <dt>Hours</dt>
                <dd>{dayDetail.hours}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{dayDetail.note}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AttendanceTab;
