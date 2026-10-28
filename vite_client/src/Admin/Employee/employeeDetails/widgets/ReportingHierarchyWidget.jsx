import React, { useEffect, useMemo, useState } from 'react';
import { FiGitBranch } from 'react-icons/fi';
import ProfilePicture from '../../../../Shared/ProfilePicture';
import SectionCard from '../SectionCard';
import { getFullName } from '../utils';
import axiosInstance from '../../../../utils/axios';
import { BOTH_PROFILE_ENDPOINT } from '../../../../utils/constant';

const levelBadge = (person) => {
  if (person?.roleLevel == null) return null;
  return `L${person.roleLevel}`;
};

const initialsOf = (person) => {
  const name = typeof person === 'string' ? person : getFullName(person);
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || '?'
  );
};

const subtitleOf = (person, fallback = '') => {
  const role = person?.jobTitle || person?.position || fallback;
  const dept = person?.department;
  if (role && dept && role !== dept) return `${role} · ${dept}`;
  return role || dept || fallback || null;
};

/** Compact rail variant (other tabs). */
const RailHierarchy = ({ employee, managerPreview }) => {
  const managerName = managerPreview?.name
    ? getFullName(managerPreview)
    : typeof employee?.manager === 'string'
      ? employee.manager
      : null;

  return (
    <div className="ed-rail-card rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="ed-rail-card__label text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        Reporting hierarchy
      </p>
      <div className="mt-4 space-y-2">
        {managerName ? (
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
            <ProfilePicture user={managerPreview || { name: managerName }} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{managerName}</p>
              <p className="truncate text-xs text-slate-500">
                {managerPreview?.jobTitle || 'Manager'}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No manager assigned</p>
        )}
        <div className="flex justify-center py-1">
          <span className="h-4 w-px bg-slate-200" />
        </div>
        <div className="ed-rail-node--self flex items-center gap-3 rounded-xl border border-[#0E9370]/30 bg-[#0E9370]/10 px-3 py-2">
          <ProfilePicture user={employee} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{getFullName(employee)}</p>
            <p className="truncate text-xs text-slate-500">
              {employee?.jobTitle || employee?.position}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const HierarchyNodeCard = ({
  person,
  name,
  subtitle,
  badge,
  tone = 'default',
  ribbon = null,
}) => (
  <div
    className={`ed-hierarchy__node ed-hierarchy__node--${tone}${ribbon ? ' ed-hierarchy__node--ribbon' : ''}`}
  >
    {ribbon ? <span className="ed-hierarchy__ribbon">{ribbon}</span> : null}
    <div className="ed-hierarchy__node-inner">
      <ProfilePicture user={person || { name }} size="md" />
      <div className="ed-hierarchy__text">
        <p className="ed-hierarchy__name">{name}</p>
        {subtitle ? <p className="ed-hierarchy__sub">{subtitle}</p> : null}
      </div>
      {badge ? <span className="ed-hierarchy__badge">{badge}</span> : null}
    </div>
  </div>
);

const Connector = () => <div className="ed-hierarchy__connector" aria-hidden="true" />;

/** Stitch dossier variant for Job Details side column. */
const DossierHierarchy = ({
  employee,
  managerPreview,
  skipManagerPreview = null,
  reports = [],
}) => {
  const selfName = `${getFullName(employee)} (Self)`;
  const selfSub = [
    employee?.jobTitle || employee?.position,
    employee?.employeeId || employee?.empId,
  ]
    .filter(Boolean)
    .join(' · ');

  const managerName = managerPreview
    ? getFullName(managerPreview)
    : typeof employee?.manager === 'string' &&
        !['Admin', 'CEO'].includes(String(employee.manager).trim())
      ? employee.manager
      : null;

  const skipName = skipManagerPreview ? getFullName(skipManagerPreview) : null;
  const reportPreview = reports.slice(0, 4);
  const reportCount = reports.length;

  return (
    <SectionCard
      className="ed-hierarchy ed-hierarchy--dossier"
      title="Reporting Hierarchy"
      icon={FiGitBranch}
    >
      <div className="ed-hierarchy__stack">
        {skipName ? (
          <>
            <HierarchyNodeCard
              person={skipManagerPreview}
              name={skipName}
              subtitle={subtitleOf(skipManagerPreview, 'Leadership')}
              badge={levelBadge(skipManagerPreview)}
              tone="default"
            />
            <Connector />
          </>
        ) : null}

        {managerName ? (
          <>
            <HierarchyNodeCard
              person={managerPreview || { name: managerName }}
              name={managerName}
              subtitle={subtitleOf(managerPreview, 'Manager')}
              badge={levelBadge(managerPreview)}
              tone="manager"
              ribbon="Direct Manager"
            />
            <Connector />
          </>
        ) : null}

        <HierarchyNodeCard
          person={employee}
          name={selfName}
          subtitle={selfSub}
          badge={levelBadge(employee)}
          tone="self"
        />

        {reportCount > 0 ? (
          <>
            <Connector />
            <div className="ed-hierarchy__pod">
              <p className="ed-hierarchy__pod-label">Direct reports ({reportCount})</p>
              <div className="ed-hierarchy__pod-row">
                {reportPreview.map((r) => (
                  <span
                    key={r._id || r.id || getFullName(r)}
                    className="ed-hierarchy__pod-chip"
                    title={getFullName(r)}
                  >
                    {initialsOf(r)}
                  </span>
                ))}
                <span className="ed-hierarchy__pod-count">
                  + {reportCount} {reportCount === 1 ? 'report' : 'reports'}
                </span>
              </div>
            </div>
          </>
        ) : null}

        {!managerName && !skipName ? (
          <p className="ed-hierarchy__empty-note">No manager assigned above this role.</p>
        ) : null}
      </div>
    </SectionCard>
  );
};

const ReportingHierarchyWidget = ({
  employee,
  managerPreview,
  variant = 'rail',
  skipManagerPreview = null,
  reports = [],
}) => {
  if (variant === 'dossier') {
    return (
      <DossierHierarchy
        employee={employee}
        managerPreview={managerPreview}
        skipManagerPreview={skipManagerPreview}
        reports={reports}
      />
    );
  }
  return <RailHierarchy employee={employee} managerPreview={managerPreview} />;
};

/**
 * Job Details hierarchy: loads skip-level manager when available.
 * Direct reports come from employee.directReports / teamMembers if present.
 */
export const JobReportingHierarchy = ({ employee, managerPreview }) => {
  const [skipManager, setSkipManager] = useState(null);

  const managerId = useMemo(() => {
    if (!managerPreview) return null;
    const raw =
      managerPreview.managerId?._id ||
      managerPreview.managerId?.id ||
      managerPreview.managerId ||
      null;
    if (!raw || raw === employee?._id || raw === employee?.id) return null;
    return raw;
  }, [managerPreview, employee?._id, employee?.id]);

  const reports = useMemo(() => {
    const list =
      employee?.directReports ||
      employee?.teamMembers ||
      employee?.reportees ||
      employee?.mentees ||
      [];
    return Array.isArray(list) ? list : [];
  }, [employee]);

  useEffect(() => {
    if (!managerId) {
      setSkipManager(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosInstance.get(
          `${BOTH_PROFILE_ENDPOINT}/admin/get-info/${managerId}`,
          { withCredentials: true }
        );
        if (!cancelled) setSkipManager(res.data?.employee || null);
      } catch {
        if (!cancelled) setSkipManager(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [managerId]);

  return (
    <ReportingHierarchyWidget
      employee={employee}
      managerPreview={managerPreview}
      skipManagerPreview={skipManager}
      reports={reports}
      variant="dossier"
    />
  );
};

export default ReportingHierarchyWidget;
