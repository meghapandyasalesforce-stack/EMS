import React, { useMemo } from 'react';
import {
  FiAward,
  FiCopy,
  FiEdit,
  FiFileText,
  FiMapPin,
  FiPhone,
  FiUser,
  FiAlertCircle,
  FiBriefcase,
  FiMonitor,
  FiHome,
  FiKey,
} from 'react-icons/fi';
import SectionCard from '../SectionCard';
import SimpleDataTable from '../SimpleDataTable';
import {
  getFullName,
  formatDate,
  calculateYearsOfExperience,
  getStatusLabel,
  buildExecutiveSummaryModel,
  formatAboutFieldValue,
} from '../utils';

const display = (value) => {
  if (value === 0) return '0';
  if (value == null || value === '') return null;
  return value;
};

const ContactRow = ({ label, value, onCopy }) => {
  const shown = display(value);
  return (
    <div className="ed-overview__contact-row">
      <dt className="ed-overview__contact-label">{label}</dt>
      <dd className="ed-overview__contact-value">
        {shown == null ? (
          <span className="ed-overview__empty">Not set</span>
        ) : (
          <span>{shown}</span>
        )}
        {onCopy && shown ? (
          <button
            type="button"
            className="ed-overview__copy"
            onClick={onCopy}
            title="Copy"
            aria-label={`Copy ${label}`}
          >
            <FiCopy className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </dd>
    </div>
  );
};

const EmptyBlock = ({ children }) => (
  <p className="ed-overview__empty-inline">{children}</p>
);

const DetailCell = ({ label, value, danger = false, mint = false }) => {
  const shown = display(value);
  return (
    <div className="ed-overview__detail">
      <p className="ed-overview__contact-label">{label}</p>
      {shown == null ? (
        <span className="ed-overview__empty">Not set</span>
      ) : mint ? (
        <span className="ed-overview__tag ed-overview__tag--mint ed-overview__detail-pill">{shown}</span>
      ) : (
        <span className={`ed-overview__meta-value ${danger ? 'ed-overview__meta-value--danger' : ''}`}>
          {shown}
        </span>
      )}
    </div>
  );
};

const PersonalTab = ({ employee, managerPreview = null, canEditName = false, onEditName }) => {
  const fullName = getFullName(employee);
  const tenureYears = calculateYearsOfExperience(employee.joiningDate);
  const maritalStatus =
    employee.maritalStatus ||
    employee.contactDetails?.maritalStatus ||
    employee.personalDetails?.maritalStatus ||
    null;
  const bloodGroup =
    employee.bloodGroup ||
    employee.personalDetails?.bloodGroup ||
    employee.contactDetails?.bloodGroup ||
    null;
  const employmentType =
    employee.employmentType || employee.employeeType || employee.workType || null;
  const statusLabel = getStatusLabel(employee);

  const primaryEmergency =
    employee.emergencyContacts?.find((c) => c.priority === 'Primary') ||
    employee.emergencyContacts?.[0] ||
    (employee.nextOfKins?.[0]
      ? {
          name: employee.nextOfKins[0].name,
          relationship: employee.nextOfKins[0].relationship,
          phone: employee.nextOfKins[0].phone,
          address: employee.nextOfKins[0].address,
        }
      : null);

  const skillChips = useMemo(() => {
    const fromQuals = (employee.professionalQualifications || [])
      .map((q) => q.title || q.organization)
      .filter(Boolean);
    const fromSkills = Array.isArray(employee.skills)
      ? employee.skills.map((s) => (typeof s === 'string' ? s : s?.name)).filter(Boolean)
      : [];
    return [...new Set([...fromSkills, ...fromQuals])];
  }, [employee.professionalQualifications, employee.skills]);

  const projectRows = useMemo(() => {
    const fromQuals = (employee.professionalQualifications || [])
      .filter((q) => q.title || q.description || q.organization)
      .map((q, idx) => ({
        key: `qual-${idx}`,
        title: q.title || q.organization || 'Qualification',
        badge: q.duration || null,
        body: [q.organization && q.title ? q.organization : null, q.description]
          .filter(Boolean)
          .join(' — '),
        tone: 'primary',
      }));

    const fromAcademic = (employee.academicRecords || [])
      .filter((r) => r.institution || r.degree || r.certificate)
      .map((r, idx) => {
        const degree = r.degree || r.certificate || r.details || 'Academic record';
        const period =
          r.startDate || r.endDate
            ? [r.startDate ? formatDate(r.startDate) : '', r.endDate ? formatDate(r.endDate) : '']
                .filter(Boolean)
                .join(' → ')
            : r.year
              ? String(r.year)
              : null;
        return {
          key: `edu-${idx}`,
          title: degree,
          badge: period,
          body: [r.institution, r.fieldOfStudy].filter(Boolean).join(' · '),
          tone: 'secondary',
        };
      });

    return [...fromQuals, ...fromAcademic];
  }, [employee.professionalQualifications, employee.academicRecords]);

  const assetRows = useMemo(() => {
    const rows = [];
    const rawAssets = employee.assets || employee.assignedAssets || employee.equipment || [];
    if (Array.isArray(rawAssets)) {
      rawAssets.forEach((item, idx) => {
        if (!item) return;
        if (typeof item === 'string') {
          rows.push({ key: `raw-${idx}`, name: item, code: null, icon: 'device' });
          return;
        }
        rows.push({
          key: item._id || item.id || `raw-${idx}`,
          name: item.name || item.title || item.assetName || item.type || 'Asset',
          code: item.code || item.assetTag || item.serialNumber || item.id || null,
          icon: item.icon || 'device',
        });
      });
    }

    const workspace = employee.workLocation || employee.location || employee.city;
    if (workspace) {
      rows.push({
        key: 'workspace',
        name: workspace,
        code: 'Primary workspace',
        icon: 'home',
      });
    }

    if (employee.shiftName || employee.shift?.name || employee.shift) {
      const shiftLabel =
        employee.shiftName ||
        employee.shift?.name ||
        (typeof employee.shift === 'string' ? employee.shift : null);
      if (shiftLabel) {
        rows.push({
          key: 'shift',
          name: shiftLabel,
          code: 'Work shift',
          icon: 'key',
        });
      }
    }

    return rows;
  }, [employee]);

  const summaryModel = useMemo(() => {
    const manual = employee.bio || employee.about || employee.summary;
    if (manual && String(manual).trim()) {
      const auto = buildExecutiveSummaryModel(employee, managerPreview);
      return { paragraph: String(manual).trim(), chips: auto.facts };
    }
    const auto = buildExecutiveSummaryModel(employee, managerPreview);
    return { paragraph: auto.paragraph, chips: auto.facts };
  }, [employee, managerPreview]);

  /* Dynamic About boxes — only filled fields; sentence-case display for all employees */
  const aboutDetails = useMemo(() => {
    const rows = [
      { label: 'Full Name', value: formatAboutFieldValue('Full Name', fullName) },
      { label: 'Job Title', value: formatAboutFieldValue('Job Title', employee.jobTitle || null) },
      { label: 'Department', value: formatAboutFieldValue('Department', employee.department || null) },
      { label: 'Position', value: formatAboutFieldValue('Position', employee.position || null) },
      { label: 'Employment Type', value: formatAboutFieldValue('Employment Type', employmentType) },
      {
        label: 'Status',
        value:
          statusLabel && statusLabel !== 'N/A' && statusLabel !== '—'
            ? formatAboutFieldValue('Status', statusLabel)
            : null,
        mint: String(statusLabel || '').toLowerCase() === 'active',
      },
    ];
    return rows.filter((row) => row.value != null && String(row.value).trim() !== '');
  }, [employee.jobTitle, employee.department, employee.position, fullName, employmentType, statusLabel]);

  const aboutChips = useMemo(() => {
    const chips = [];
    if (employee.employeeId || employee.empId) {
      chips.push({ label: String(employee.employeeId || employee.empId), tone: 'neutral' });
    }
    if (employmentType) {
      chips.push({
        label: formatAboutFieldValue('Employment Type', employmentType),
        tone: 'soft',
      });
    }
    if (statusLabel && statusLabel !== 'N/A' && statusLabel !== '—') {
      chips.push({ label: formatAboutFieldValue('Status', statusLabel), tone: 'mint' });
    }
    if (employee.joiningDate) {
      chips.push({
        label: `Joined ${formatDate(employee.joiningDate)}${tenureYears !== '0' ? ` · ${tenureYears}y` : ''}`,
        tone: 'mint',
      });
    }
    return chips;
  }, [employee, employmentType, statusLabel, tenureYears]);

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(String(text));
    } catch {
      /* ignore */
    }
  };

  const editAction =
    canEditName && onEditName ? (
      <button
        type="button"
        onClick={onEditName}
        className="ed-overview__icon-btn"
        title="Edit name"
        aria-label="Edit name"
      >
        <FiEdit className="h-4 w-4" />
      </button>
    ) : null;

  const assetIcon = (kind) => {
    if (kind === 'home') return FiHome;
    if (kind === 'key') return FiKey;
    return FiMonitor;
  };

  return (
    <div className="ed-overview">
      <div className="ed-overview__board">
        <div className="ed-overview__col ed-overview__col--main">
          <SectionCard
            className="ed-overview__card ed-overview__about-card"
            title="About & Executive Summary"
            icon={FiFileText}
            action={editAction}
          >
            {summaryModel.paragraph ? (
              <p className="ed-overview__about">{summaryModel.paragraph}</p>
            ) : (
              <EmptyBlock>No profile summary available yet.</EmptyBlock>
            )}

            {aboutDetails.length > 0 ? (
              <div className="ed-overview__meta-grid ed-overview__meta-grid--about">
                {aboutDetails.map((row) => (
                  <DetailCell
                    key={row.label}
                    label={row.label}
                    value={row.value}
                    mint={Boolean(row.mint)}
                  />
                ))}
              </div>
            ) : null}

            {aboutChips.length > 0 && (
              <div className="ed-overview__tags">
                {aboutChips.map((tag) => (
                  <span
                    key={tag.label}
                    className={`ed-overview__tag ${
                      tag.tone === 'mint'
                        ? 'ed-overview__tag--mint'
                        : tag.tone === 'soft'
                          ? 'ed-overview__tag--soft'
                          : ''
                    }`}
                  >
                    {tag.label}
                  </span>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard className="ed-overview__card" title="Skills & Competencies" icon={FiAward}>
            {skillChips.length > 0 ? (
              <div className="ed-overview__skills">
                {skillChips.map((skill) => (
                  <span key={skill} className="ed-overview__skill">
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <EmptyBlock>No skills on file yet.</EmptyBlock>
            )}
          </SectionCard>

          <SectionCard
            className="ed-overview__card"
            title="Key Projects & Accomplishments"
            icon={FiBriefcase}
          >
            {projectRows.length > 0 ? (
              <div className="ed-overview__projects">
                {projectRows.map((row) => (
                  <div key={row.key} className="ed-overview__project">
                    <div
                      className={`ed-overview__project-icon ${
                        row.tone === 'secondary' ? 'ed-overview__project-icon--secondary' : ''
                      }`}
                    >
                      <FiAward className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="ed-overview__project-title">{row.title}</h4>
                        {row.badge ? (
                          <span className="ed-overview__project-badge">{row.badge}</span>
                        ) : null}
                      </div>
                      {row.body ? <p className="ed-overview__project-body">{row.body}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyBlock>No projects or qualifications on file yet.</EmptyBlock>
            )}
          </SectionCard>
        </div>

        <div className="ed-overview__col ed-overview__col--side">
          <SectionCard className="ed-overview__card" title="Contact Information" icon={FiUser}>
            <dl className="ed-overview__contact-list">
              <ContactRow
                label="Official Email"
                value={employee.email}
                onCopy={() => copyText(employee.email)}
              />
              <ContactRow label="Personal Email" value={employee.personalEmail} />
              <ContactRow label="Mobile Phone" value={employee.phone1} />
              {employee.phone2 ? (
                <ContactRow label="Secondary Phone" value={employee.phone2} />
              ) : null}
              <ContactRow
                label="Permanent Residential Address"
                value={[employee.address, employee.city].filter(Boolean).join(', ') || null}
              />
              <div className="ed-overview__contact-split">
                <DetailCell label="Blood Group" value={bloodGroup} danger />
                <DetailCell label="Marital Status" value={maritalStatus} />
              </div>
            </dl>
          </SectionCard>

          <SectionCard
            title="Emergency Contact"
            icon={FiAlertCircle}
            iconClassName="text-[#ba1a1a]"
            className="ed-overview__card ed-overview__emergency-card"
          >
            {primaryEmergency ? (
              <div className="ed-overview__emergency">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="ed-overview__emergency-name">
                    {primaryEmergency.name || 'N/A'}
                  </span>
                  {primaryEmergency.relationship ? (
                    <span className="ed-overview__emergency-rel">{primaryEmergency.relationship}</span>
                  ) : null}
                </div>
                <div className="ed-overview__emergency-meta">
                  {primaryEmergency.phone ? (
                    <p className="flex items-center gap-1.5">
                      <FiPhone className="h-4 w-4 shrink-0 text-[#476175]" />
                      {primaryEmergency.phone}
                    </p>
                  ) : null}
                  {(primaryEmergency.address || employee.address || employee.city) && (
                    <p className="flex items-start gap-1.5">
                      <FiMapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#476175]" />
                      <span>
                        {primaryEmergency.address ||
                          [employee.address, employee.city].filter(Boolean).join(', ')}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <EmptyBlock>No emergency contact on file.</EmptyBlock>
            )}
          </SectionCard>

          <SectionCard
            className="ed-overview__card"
            title="Assigned Workstation & Assets"
            icon={FiMonitor}
          >
            {assetRows.length > 0 ? (
              <div className="ed-overview__assets">
                {assetRows.map((asset) => {
                  const Icon = assetIcon(asset.icon);
                  return (
                    <div key={asset.key} className="ed-overview__asset">
                      <span className="ed-overview__asset-name">
                        <Icon className="h-4 w-4 shrink-0 text-[#476175]" />
                        {asset.name}
                      </span>
                      {asset.code ? (
                        <span className="ed-overview__asset-code">{asset.code}</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyBlock>No workstation or IT assets assigned yet.</EmptyBlock>
            )}
          </SectionCard>
        </div>
      </div>

      {employee.familyDetails?.length > 0 && (
        <SectionCard title={`Family Details (${employee.familyDetails.length})`} icon={FiUser}>
          <SimpleDataTable
            columns={[
              { key: 'fullName', label: 'Name' },
              { key: 'relationship', label: 'Relationship' },
              { key: 'phoneNo', label: 'Phone' },
              { key: 'occupation', label: 'Occupation' },
              { key: 'address', label: 'Address' },
            ]}
            rows={employee.familyDetails}
          />
        </SectionCard>
      )}

      {employee.nextOfKins?.length > 0 && (
        <SectionCard title={`Next of Kin (${employee.nextOfKins.length})`}>
          <SimpleDataTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'relationship', label: 'Relationship' },
              { key: 'phone', label: 'Phone' },
              { key: 'occupation', label: 'Occupation' },
              { key: 'address', label: 'Address' },
            ]}
            rows={employee.nextOfKins}
          />
        </SectionCard>
      )}

      {employee.guarantors?.length > 0 && (
        <SectionCard title={`Guarantors (${employee.guarantors.length})`}>
          <SimpleDataTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'relationship', label: 'Relationship' },
              { key: 'phone', label: 'Phone' },
              { key: 'occupation', label: 'Occupation' },
            ]}
            rows={employee.guarantors}
          />
        </SectionCard>
      )}

      {employee.emergencyContacts?.length > 1 && (
        <SectionCard title={`All Emergency Contacts (${employee.emergencyContacts.length})`}>
          <SimpleDataTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'relationship', label: 'Relationship' },
              { key: 'phone', label: 'Phone' },
              { key: 'email', label: 'Email' },
              { key: 'priority', label: 'Priority' },
            ]}
            rows={employee.emergencyContacts}
          />
        </SectionCard>
      )}
    </div>
  );
};

export default PersonalTab;
