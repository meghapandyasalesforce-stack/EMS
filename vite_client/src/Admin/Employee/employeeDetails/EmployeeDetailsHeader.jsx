import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  FiActivity,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiMail,
  FiMapPin,
  FiMoreVertical,
  FiPhone,
  FiTrash2,
  FiUserCheck,
  FiDollarSign,
} from 'react-icons/fi';
import ProfilePicture from '../../../Shared/ProfilePicture';
import {
  formatDate,
  formatSalary,
  getAttendanceRate,
  getFullName,
  getStatusLabel,
} from './utils';

const formatTenureShort = (joiningDate) => {
  if (!joiningDate) return null;
  const join = new Date(joiningDate);
  if (Number.isNaN(join.getTime())) return null;
  const now = new Date();
  let months =
    (now.getFullYear() - join.getFullYear()) * 12 + (now.getMonth() - join.getMonth());
  if (now.getDate() < join.getDate()) months -= 1;
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years > 0 && rem > 0) return `${years}y ${rem}m`;
  if (years > 0) return `${years}y`;
  return `${rem}m`;
};

const EmployeeDetailsHeader = ({
  employee,
  canManageEmployeeActions = false,
  hidePayrollFields = false,
  updatingStatus,
  terminatingEmployee,
  onStatusClick,
  onTerminateClick,
  onDeleteClick,
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onDoc = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moreOpen]);

  const status = getStatusLabel(employee);
  const isTerminated = employee.status === 'terminated';
  const isActive = Boolean(employee.active) && !isTerminated;
  const employmentType =
    employee.employmentType || employee.employeeType || employee.workType || null;
  const tenure = formatTenureShort(employee.joiningDate);
  const tenureYears = tenure ? Number(String(tenure).split('y')[0]) || 0 : 0;

  const reportsToLabel = employee.managerId
    ? employee.manager
    : employee.isOrgOwnerRoot ||
        !employee.manager ||
        ['Admin', 'CEO'].includes(String(employee.manager || '').trim())
      ? 'Organization root'
      : employee.manager || '';

  const phone = employee.phone1 || employee.phone || employee.mobile || null;
  const location = employee.workLocation || employee.location || employee.city || null;
  const attendance = getAttendanceRate(employee);
  const leaveAvailable =
    employee.leaveAvailable ??
    employee.leaveBalance?.totalAvailable ??
    employee.totalLeaveBalance ??
    null;

  const complianceLabel = useMemo(() => {
    const docs = employee.documents || employee.employeeDocuments || [];
    if (!Array.isArray(docs) || docs.length === 0) return null;
    const verified = docs.filter(
      (d) => d.verified === true || d.status === 'verified' || d.verificationStatus === 'verified'
    ).length;
    if (verified === docs.length) return '100% Verified';
    return `${verified}/${docs.length} Verified`;
  }, [employee]);

  const statusDotClass = isTerminated
    ? 'emp-dossier__status-dot emp-dossier__status-dot--term'
    : isActive
      ? 'emp-dossier__status-dot'
      : 'emp-dossier__status-dot emp-dossier__status-dot--off';

  const statusEmploymentChip = (
    <span
      className={
        isTerminated
          ? 'emp-dossier__chip emp-dossier__chip--term'
          : isActive
            ? 'emp-dossier__chip emp-dossier__chip--active'
            : 'emp-dossier__chip emp-dossier__chip--inactive'
      }
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isTerminated ? 'bg-red-600' : isActive ? 'bg-[#0e9370]' : 'bg-slate-400'
        }`}
      />
      {status}
      {employmentType ? ` · ${employmentType}` : ''}
    </span>
  );

  return (
    <header className="emp-dossier__hero">
      <div className="emp-dossier__hero-glow" aria-hidden="true" />

      <div className="emp-dossier__hero-main">
        <div className="emp-dossier__identity">
          <div className="emp-dossier__avatar-wrap">
            <ProfilePicture user={employee} size="xl" className="emp-dossier__avatar" />
            <span className={statusDotClass} title={status} />
          </div>

          <div className="emp-dossier__identity-text min-w-0 flex-1">
            <div className="emp-dossier__name-row emp-dossier__name-row--top">
              <h1 className="emp-dossier__name">{getFullName(employee)}</h1>
              {employee.employeeId ? (
                <span className="emp-dossier__chip emp-dossier__chip--id">{employee.employeeId}</span>
              ) : null}
              {statusEmploymentChip}
              {tenureYears >= 1 ? (
                <span className="emp-dossier__chip emp-dossier__chip--milestone">
                  <FiCheckCircle className="h-3 w-3" />
                  {tenureYears} Year{tenureYears === 1 ? '' : 's'} Milestone
                </span>
              ) : null}
            </div>

            <div className="emp-dossier__role-line">
              {(employee.jobTitle || employee.position) && (
                <span className="emp-dossier__role-item emp-dossier__role-item--strong">
                  <FiBriefcase className="emp-dossier__role-icon" />
                  {employee.jobTitle || employee.position}
                </span>
              )}
              {employee.department ? (
                <>
                  <span className="emp-dossier__meta-sep" aria-hidden="true">
                    ·
                  </span>
                  <span className="emp-dossier__role-item">
                    <FiUserCheck className="emp-dossier__role-icon emp-dossier__role-icon--muted" />
                    {employee.department}
                    {employee.position && employee.jobTitle ? ` (${employee.position})` : ''}
                  </span>
                </>
              ) : null}
              {location ? (
                <>
                  <span className="emp-dossier__meta-sep" aria-hidden="true">
                    ·
                  </span>
                  <span className="emp-dossier__role-item">
                    <FiMapPin className="emp-dossier__role-icon emp-dossier__role-icon--muted" />
                    {location}
                  </span>
                </>
              ) : null}
            </div>

            <div className="emp-dossier__contact-line">
              {employee.email ? (
                <span className="emp-dossier__contact-item">
                  <FiMail className="h-3.5 w-3.5 shrink-0" />
                  {employee.email}
                </span>
              ) : null}
              {phone ? (
                <span className="emp-dossier__contact-item">
                  <FiPhone className="h-3.5 w-3.5 shrink-0" />
                  {phone}
                </span>
              ) : null}
              {employee.joiningDate ? (
                <span className="emp-dossier__contact-item">
                  <FiCalendar className="h-3.5 w-3.5 shrink-0" />
                  Joined: {formatDate(employee.joiningDate)}
                  {tenure ? ` (${tenure})` : ''}
                </span>
              ) : null}
              {reportsToLabel ? (
                <span className="emp-dossier__contact-item">
                  <FiUserCheck className="h-3.5 w-3.5 shrink-0" />
                  Reports to: <strong>{reportsToLabel}</strong>
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {canManageEmployeeActions ? (
          <div className="emp-dossier__actions">
            <button
              type="button"
              onClick={onStatusClick}
              disabled={updatingStatus || isTerminated}
              className="emp-dossier__btn emp-dossier__btn--primary"
            >
              <FiActivity className="h-4 w-4 shrink-0" />
              {isTerminated ? 'Terminated' : employee.active ? 'Deactivate' : 'Activate'}
            </button>
            {!isTerminated && (
              <button
                type="button"
                onClick={onTerminateClick}
                disabled={terminatingEmployee}
                className="emp-dossier__btn emp-dossier__btn--soft"
              >
                <FiClock className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Terminate</span>
              </button>
            )}
            <div className="relative" ref={moreRef}>
              <button
                type="button"
                className="emp-dossier__btn emp-dossier__btn--icon"
                aria-label="More actions"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((v) => !v)}
              >
                <FiMoreVertical className="h-5 w-5" />
              </button>
              {moreOpen ? (
                <div className="emp-dossier__more-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="emp-dossier__more-item emp-dossier__more-item--danger"
                    onClick={() => {
                      setMoreOpen(false);
                      onDeleteClick?.();
                    }}
                  >
                    <FiTrash2 className="h-4 w-4" />
                    Delete Employee
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="emp-dossier__metrics" aria-label="Employee highlights">
        {!hidePayrollFields ? (
          <div className="emp-dossier__metric">
            <div className="emp-dossier__metric-icon emp-dossier__metric-icon--pay">
              <FiDollarSign className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="emp-dossier__metric-label">Annual CTC</p>
              <p className="emp-dossier__metric-value">{formatSalary(employee.salary)}</p>
            </div>
          </div>
        ) : null}

        <div className="emp-dossier__metric">
          <div className="emp-dossier__metric-icon emp-dossier__metric-icon--leave">
            <FiClock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="emp-dossier__metric-label">Leave Available</p>
            <p className="emp-dossier__metric-value">
              {leaveAvailable != null && leaveAvailable !== ''
                ? `${leaveAvailable} Days`
                : '—'}
            </p>
          </div>
        </div>

        <div className="emp-dossier__metric">
          <div className="emp-dossier__metric-icon emp-dossier__metric-icon--att">
            <FiCalendar className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="emp-dossier__metric-label">Avg Attendance</p>
            <p className="emp-dossier__metric-value">
              {typeof attendance === 'number' ? `${attendance}%` : attendance || '—'}
            </p>
          </div>
        </div>

        <div className="emp-dossier__metric">
          <div className="emp-dossier__metric-icon emp-dossier__metric-icon--comp">
            <FiCheckCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="emp-dossier__metric-label">Compliance</p>
            <p
              className={`emp-dossier__metric-value ${
                complianceLabel?.includes('100%') ? 'emp-dossier__metric-value--ok' : ''
              }`}
            >
              {complianceLabel || '—'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default EmployeeDetailsHeader;
