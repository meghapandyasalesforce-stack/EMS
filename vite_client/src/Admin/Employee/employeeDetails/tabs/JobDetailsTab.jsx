import React, { useMemo } from 'react';
import { FiEdit, FiTrendingUp, FiUserCheck } from 'react-icons/fi';
import SectionCard from '../SectionCard';
import { JobReportingHierarchy } from '../widgets/ReportingHierarchyWidget';
import {
  buildCareerProgressionEvents,
  formatDate,
  formatDateTime,
  formatSalary,
  getFullName,
  getStatusLabel,
} from '../utils';

const display = (value) => {
  if (value === 0) return '0';
  if (value == null || value === '' || value === 'N/A' || value === '—') return null;
  return value;
};

const PlacementTile = ({ label, value, hint, accent = false }) => {
  const shown = display(value);
  return (
    <div className="ed-job__tile">
      <p className="ed-job__tile-label">{label}</p>
      {shown == null ? (
        <p className="ed-job__tile-empty">Not set</p>
      ) : (
        <p className={`ed-job__tile-value${accent ? ' ed-job__tile-value--accent' : ''}`}>{shown}</p>
      )}
      {hint ? <p className="ed-job__tile-hint">{hint}</p> : null}
    </div>
  );
};

const JobDetailsTab = ({
  employee,
  isManagerReadOnly,
  onEditWork,
  canPromoteToHr = false,
  onPromoteToHr,
  promotingToHr = false,
  isHrManagerProfile = false,
  hidePayrollFields = false,
  managerPreview = null,
}) => {
  const managerLabel = useMemo(() => {
    if (
      !employee.managerId &&
      (!employee.manager || ['Admin', 'CEO'].includes(String(employee.manager).trim()))
    ) {
      return 'Organization root (no manager)';
    }
    if (managerPreview) return getFullName(managerPreview);
    if (typeof employee.manager === 'string') return employee.manager;
    if (employee.manager?.name) return getFullName(employee.manager);
    return null;
  }, [employee, managerPreview]);

  const probationValue = useMemo(() => {
    const status = employee.probation?.status;
    if (!status || status === 'None') return null;
    if (status === 'Confirmed' && employee.probation.confirmedAt) {
      return `Cleared: ${formatDate(employee.probation.confirmedAt)}`;
    }
    if (employee.probation.endDate) {
      return `${status} · ends ${formatDate(employee.probation.endDate)}`;
    }
    return status;
  }, [employee.probation]);

  const probationHint = useMemo(() => {
    if (!employee.probation?.status || employee.probation.status === 'None') return null;
    if (employee.probation.status === 'Confirmed') return 'Probation completed successfully';
    if (employee.probation.startDate) {
      return `Started ${formatDate(employee.probation.startDate)}`;
    }
    return 'Employment probation status';
  }, [employee.probation]);

  const placementTiles = useMemo(() => {
    const role = employee.jobTitle || employee.position || null;
    const band =
      employee.roleLevel != null
        ? `Level ${employee.roleLevel}${role ? ` · ${role}` : ''}`
        : role;
    const department = employee.department || null;
    const shift = employee.shiftName || employee.shiftId || null;
    const joining = employee.joiningDate ? formatDate(employee.joiningDate) : null;
    const status = getStatusLabel(employee);
    const employmentType =
      employee.employmentType || employee.employeeType || employee.workType || null;

    return [
      {
        label: 'Level / Role',
        value: band,
        hint: employee.position && employee.position !== role ? employee.position : 'Current corporate role',
        accent: false,
      },
      {
        label: 'Department',
        value: department,
        hint: employmentType || 'Organizational division',
        accent: false,
      },
      {
        label: 'Probation Confirmation',
        value: probationValue,
        hint: probationHint,
        accent: Boolean(probationValue),
      },
      {
        label: 'Joining Date',
        value: joining,
        hint: status ? `Status: ${status}` : null,
        accent: false,
      },
      {
        label: 'Reporting Manager',
        value: managerLabel,
        hint: managerPreview?.jobTitle || null,
        accent: false,
      },
      {
        label: 'Shift',
        value: shift && shift !== 'No Shift' ? shift : null,
        hint: employee.employeeId ? `Employee ID ${employee.employeeId}` : null,
        accent: false,
      },
      ...(!hidePayrollFields
        ? [
            {
              label: 'Compensation',
              value: formatSalary(employee.salary),
              hint: 'Annual / contracted salary',
              accent: false,
            },
          ]
        : []),
      {
        label: 'Record Created',
        value: employee.createdAt ? formatDateTime(employee.createdAt) : null,
        hint: null,
        accent: false,
      },
    ].filter((tile) => display(tile.value) != null);
  }, [
    employee,
    hidePayrollFields,
    managerLabel,
    managerPreview,
    probationHint,
    probationValue,
  ]);

  const financialTiles = useMemo(() => {
    const fd = employee.financialDetails || {};
    return [
      { label: 'Bank Name', value: fd.bankName },
      { label: 'Account Name', value: fd.accountName },
      { label: 'Account Number', value: fd.accountNo },
      { label: 'IFSC Code', value: fd.ifsc },
      { label: 'PAN Number', value: fd.panNumber },
      { label: 'EPF UAN', value: fd.epfUan },
      { label: 'Tax Regime', value: fd.taxRegime || fd.taxId },
    ];
  }, [employee.financialDetails]);

  const careerEvents = useMemo(
    () => buildCareerProgressionEvents(employee, managerPreview),
    [employee, managerPreview]
  );

  return (
    <div className="ed-job ed-job--split">
      <div className="ed-job__board">
        <div className="ed-job__col ed-job__col--main">
          <SectionCard
            className="ed-job__placement"
            title="Organizational Placement"
            action={
              !isManagerReadOnly ? (
                <div className="ed-job__actions">
                  {canPromoteToHr && !isHrManagerProfile && onPromoteToHr ? (
                    <button
                      type="button"
                      onClick={onPromoteToHr}
                      disabled={promotingToHr}
                      className="ed-job__btn ed-job__btn--primary"
                    >
                      <FiUserCheck className="h-4 w-4 shrink-0" />
                      {promotingToHr ? 'Updating…' : 'Make HR Manager'}
                    </button>
                  ) : null}
                  <button type="button" onClick={onEditWork} className="ed-job__btn ed-job__btn--primary">
                    <FiEdit className="h-4 w-4 shrink-0" />
                    Change Role / Dept
                  </button>
                </div>
              ) : null
            }
          >
            <p className="ed-job__subtitle">Current corporate band, division, and probation metrics</p>
            {placementTiles.length > 0 ? (
              <div className="ed-job__grid">
                {placementTiles.map((tile) => (
                  <PlacementTile
                    key={tile.label}
                    label={tile.label}
                    value={tile.value}
                    hint={tile.hint}
                    accent={tile.accent}
                  />
                ))}
              </div>
            ) : (
              <p className="ed-job__empty">No placement details available.</p>
            )}
          </SectionCard>

          <SectionCard
            className="ed-job__timeline-card"
            title="Career Progression Timeline"
            icon={FiTrendingUp}
          >
            {careerEvents.length === 0 ? (
              <p className="ed-career-timeline__empty">No career milestones recorded yet.</p>
            ) : (
              <ol className="ed-career-timeline">
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
          </SectionCard>
        </div>

        <div className="ed-job__col ed-job__col--side">
          {!hidePayrollFields ? (
            <SectionCard className="ed-job__finance ed-job__finance--side" title="Financial Details (Payroll)">
              <div className="ed-job__grid ed-job__grid--side">
                {financialTiles.map((tile) => (
                  <PlacementTile key={tile.label} label={tile.label} value={tile.value} />
                ))}
              </div>
            </SectionCard>
          ) : null}
          <JobReportingHierarchy employee={employee} managerPreview={managerPreview} />
        </div>
      </div>
    </div>
  );
};

export default JobDetailsTab;
