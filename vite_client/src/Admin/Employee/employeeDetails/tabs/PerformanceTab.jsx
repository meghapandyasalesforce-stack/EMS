import React, { useMemo } from 'react';
import { FiBriefcase, FiClock, FiEdit, FiTrendingUp } from 'react-icons/fi';
import {
  buildCareerProgressionEvents,
  formatDate,
} from '../utils';

const display = (value) => {
  if (value === undefined || value === null || value === '') return '—';
  return value;
};

const PerformanceTab = ({
  employee,
  managerPreview = null,
  isManagerReadOnly,
  onEditPerformance,
  yearsExperience,
  attendanceRate,
}) => {
  const careerEvents = useMemo(
    () => buildCareerProgressionEvents(employee, managerPreview),
    [employee, managerPreview]
  );

  const workHistory = Array.isArray(employee?.workHistory) ? employee.workHistory : [];

  const stats = [
    {
      key: 'score',
      label: 'Performance Score',
      value: employee?.performanceScore ?? 'N/A',
      hint: 'Set by admin / manager',
      tone: 'primary',
    },
    {
      key: 'attendance',
      label: 'Attendance Rate',
      value: typeof attendanceRate === 'number' ? `${attendanceRate}%` : attendanceRate,
      hint: 'Auto-calculated',
      tone: 'mint',
    },
    {
      key: 'projects',
      label: 'Projects Completed',
      value: employee?.projectsCompleted ?? '0',
      hint: 'Auto-calculated',
      tone: 'secondary',
    },
    {
      key: 'experience',
      label: 'Years Experience',
      value: yearsExperience,
      hint: 'From joining date',
      tone: 'navy',
    },
  ];

  return (
    <div className="perf-tab">
      <section className="perf-panel">
        <div className="perf-panel__head">
          <div className="perf-panel__title-row">
            <FiTrendingUp className="perf-panel__icon" aria-hidden="true" />
            <h2 className="perf-panel__title">Performance Snapshot</h2>
            {!isManagerReadOnly && onEditPerformance ? (
              <button type="button" onClick={onEditPerformance} className="perf-panel__edit">
                <FiEdit className="h-3.5 w-3.5" aria-hidden="true" />
                Edit score
              </button>
            ) : null}
          </div>
          <p className="perf-panel__sub">Score, attendance, delivery, and tenure at a glance</p>
        </div>

        <div className="perf-tab__stats">
          {stats.map((stat) => (
            <div key={stat.key} className={`perf-tab__stat perf-tab__stat--${stat.tone}`}>
              <p className="perf-tab__stat-value">{display(stat.value)}</p>
              <p className="perf-tab__stat-label">{stat.label}</p>
              <p className="perf-tab__stat-hint">{stat.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="perf-tab__split">
        <section className="perf-panel">
          <div className="perf-panel__head">
            <div className="perf-panel__title-row">
              <FiClock className="perf-panel__icon" aria-hidden="true" />
              <h2 className="perf-panel__title">Career Timeline</h2>
            </div>
            <p className="perf-panel__sub">Milestones from joining through current role</p>
          </div>

          {careerEvents.length === 0 ? (
            <p className="perf-tab__empty">No career milestones recorded yet.</p>
          ) : (
            <ol className="ed-career-timeline perf-tab__timeline">
              {careerEvents.map((event) => (
                <li
                  key={event.id}
                  className={`ed-career-timeline__item${event.active ? ' is-active' : ''}`}
                >
                  <span className="ed-career-timeline__node" aria-hidden="true" />
                  <div className="ed-career-timeline__card">
                    <div className="ed-career-timeline__row">
                      <span className="ed-career-timeline__title">{event.title}</span>
                      <span className="ed-career-timeline__date">{event.dateLabel}</span>
                    </div>
                    {event.description ? (
                      <p className="ed-career-timeline__desc">{event.description}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="perf-panel">
          <div className="perf-panel__head">
            <div className="perf-panel__title-row">
              <FiBriefcase className="perf-panel__icon" aria-hidden="true" />
              <h2 className="perf-panel__title">Work History</h2>
              <span className="perf-panel__count">{workHistory.length}</span>
            </div>
            <p className="perf-panel__sub">Prior roles captured on the employee record</p>
          </div>

          {workHistory.length === 0 ? (
            <p className="perf-tab__empty">No prior work history recorded.</p>
          ) : (
            <ul className="perf-tab__history">
              {workHistory.map((row, index) => (
                <li key={`${row.company || 'role'}-${index}`} className="perf-tab__history-item">
                  <div className="perf-tab__history-top">
                    <p className="perf-tab__history-role">{display(row.position || row.jobTitle)}</p>
                    <span className="perf-tab__history-dates">
                      {formatDate(row.startDate)}
                      {' — '}
                      {row.endDate ? formatDate(row.endDate) : 'Current'}
                    </span>
                  </div>
                  <p className="perf-tab__history-company">{display(row.company)}</p>
                  {row.description ? (
                    <p className="perf-tab__history-desc">{row.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default PerformanceTab;
