import React, { memo } from 'react';
import { FiChevronDown, FiChevronUp, FiPlus, FiUsers } from 'react-icons/fi';
import EmployeeMemberAvatar from '../../Employee/EmployeeMemberAvatar';
import { getFullName } from './chartUtils';

function DesktopEmployeeNode({ employee, position, selected, expanded, childCount, hiddenCount, canShowMore, departmentCount, onSelect, onToggle, onMore }) {
  const id = String(employee.id);
  const tone = [...String(employee.department || '')].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3;
  const departmentColor = ['var(--color-primary)', 'var(--color-secondary)', 'var(--color-accent)'][tone];
  const flagged = employee.managerState !== 'linked' && employee.managerState !== 'top_level';
  return (
    <article data-employee-id={id} className={`employee-node desktop-employee-node${selected ? ' selected' : ''}${flagged ? ' flagged' : ''}`} style={{ left: position.x, top: position.y, '--org-department-color': departmentColor }}>
      <button type="button" className="node-main" onClick={() => onSelect(id)} aria-pressed={selected}>
        <span className="node-person">
          <EmployeeMemberAvatar user={employee} sizeClassName="h-10 w-10" />
          <span className="min-w-0"><span className="node-name" title={getFullName(employee)}>{getFullName(employee)}</span><span className="node-role" title={employee.jobTitle}>{employee.jobTitle}</span></span>
        </span>
        <span className="node-tags"><span className="level-pill">{employee.position}</span><span className="department-label" title={employee.department}>{employee.department}{departmentCount ? ` · ${departmentCount}` : ''}</span></span>
      </button>
      {childCount ? (
        <div className="desktop-node-footer">
          <button type="button" className="node-footer" aria-label={`${expanded ? 'Collapse' : 'Expand'} reports of ${getFullName(employee)}`} aria-expanded={expanded} onClick={() => onToggle(id)}>
            <span><FiUsers aria-hidden="true" /> {childCount} reports{hiddenCount ? ` · ${hiddenCount} hidden` : ''}</span>{expanded ? <FiChevronUp /> : <FiChevronDown />}
          </button>
          {expanded && canShowMore ? <button type="button" className="node-show-more" onClick={() => onMore(id)} title="Show the next direct reports" aria-label={`Show more reports of ${getFullName(employee)}`}><FiPlus /></button> : null}
        </div>
      ) : <div className="node-footer leaf-footer"><span>No direct reports</span><span>{employee.employeeId}</span></div>}
    </article>
  );
}
export default memo(DesktopEmployeeNode);
