import React, { useMemo } from 'react';
import { FiClock } from 'react-icons/fi';
import SectionCard from '../SectionCard';
import SimpleDataTable from '../SimpleDataTable';
import { formatDate } from '../utils';

const TimelineTab = ({ employee }) => {
  const milestones = useMemo(() => {
    const items = [];
    if (employee?.joiningDate) {
      items.push({
        id: 'join',
        event: 'Joined organization',
        date: formatDate(employee.joiningDate),
        detail: `${employee.jobTitle || 'Role'} · ${employee.department || ''}`,
      });
    }
    if (employee?.status === 'terminated') {
      items.push({
        id: 'term',
        event: 'Terminated',
        date: formatDate(employee.terminationDate || employee.updatedAt),
        detail: employee.terminationReason || 'Employment ended',
      });
    }
    return items;
  }, [employee]);

  return (
    <div className="space-y-6">
      {milestones.length > 0 && (
        <SectionCard title="Milestones" icon={FiClock}>
          <ul className="space-y-4">
            {milestones.map((m) => (
              <li key={m.id} className="flex gap-4 border-l-2 border-[#0E9370] pl-4">
                <div>
                  <p className="font-medium text-slate-900">{m.event}</p>
                  <p className="text-xs text-slate-500">{m.date}</p>
                  <p className="mt-1 text-sm text-slate-600">{m.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard title={`Work history (${employee.workHistory?.length || 0})`} icon={FiClock}>
        <SimpleDataTable
          columns={[
            { key: 'company', label: 'Company' },
            { key: 'position', label: 'Position' },
            {
              key: 'startDate',
              label: 'Start',
              render: (r) => formatDate(r.startDate),
            },
            {
              key: 'endDate',
              label: 'End',
              render: (r) => (r.endDate ? formatDate(r.endDate) : 'Current'),
            },
            { key: 'description', label: 'Description' },
          ]}
          rows={employee.workHistory || []}
          emptyMessage="No prior work history recorded."
        />
      </SectionCard>
    </div>
  );
};

export default TimelineTab;
