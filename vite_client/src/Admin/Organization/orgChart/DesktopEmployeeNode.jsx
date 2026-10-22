import React, { memo } from 'react';
import { FiChevronDown, FiChevronUp, FiUsers } from 'react-icons/fi';
import EmployeeMemberAvatar from '../../Employee/EmployeeMemberAvatar';
import { getFullName } from './chartUtils';

function DesktopEmployeeNode({
  employee,
  position,
  selected,
  expanded,
  childCount,
  hiddenCount,
  moreCount = 0,
  compact = false,
  departmentCount,
  onSelect,
  onToggle,
  onMore,
  onFitBranch,
}) {
  const id = String(employee.id);
  const tone = [...String(employee.department || '')].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3;
  const departmentColor = ['var(--color-primary)', 'var(--color-secondary)', 'var(--color-accent)'][tone];
  const flagged = employee.managerState !== 'linked' && employee.managerState !== 'top_level';
  const showCollapseChip = !compact && !expanded && childCount > 0;
  const showMoreChip = !compact && expanded && moreCount > 0;

  return (
    <div
      className={`desktop-node-wrap${compact ? ' is-compact' : ''}`}
      style={{ left: position.x, top: position.y, width: position.width || undefined }}
      data-employee-id={id}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onFitBranch?.(id);
      }}
    >
      <article
        className={`employee-node desktop-employee-node${selected ? ' selected' : ''}${flagged ? ' flagged' : ''}${compact ? ' is-compact' : ''}`}
        style={{ '--org-department-color': departmentColor }}
      >
        <button type="button" className="node-main" onClick={() => onSelect(id)} aria-pressed={selected}>
          <span className="node-person">
            {!compact ? <EmployeeMemberAvatar user={employee} sizeClassName="h-10 w-10" /> : null}
            <span className="min-w-0">
              <span className="node-name" title={getFullName(employee)}>{getFullName(employee)}</span>
              <span className="node-role" title={employee.jobTitle}>{employee.jobTitle}</span>
            </span>
          </span>
          {!compact ? (
            <span className="node-tags">
              <span className="level-pill">{employee.position}</span>
              <span className="department-label" title={employee.department}>
                {employee.department}{departmentCount ? ` · ${departmentCount}` : ''}
              </span>
            </span>
          ) : null}
        </button>
        {childCount ? (
          <div className="desktop-node-footer">
            <button
              type="button"
              className="node-footer"
              aria-label={`${expanded ? 'Collapse' : 'Expand'} reports of ${getFullName(employee)}`}
              aria-expanded={expanded}
              onClick={() => onToggle(id)}
            >
              <span>
                <FiUsers aria-hidden="true" /> {compact ? childCount : `${childCount} reports`}
                {!compact && hiddenCount ? ` · ${hiddenCount} hidden` : ''}
              </span>
              {expanded ? <FiChevronUp /> : <FiChevronDown />}
            </button>
          </div>
        ) : (
          <div className="node-footer leaf-footer">
            <span>{compact ? 'IC' : 'No direct reports'}</span>
            {!compact ? <span>{employee.employeeId}</span> : null}
          </div>
        )}
      </article>

      {showCollapseChip ? (
        <button
          type="button"
          className="org-collapse-chip"
          onClick={() => onToggle(id)}
          aria-label={`Expand ${childCount} reports of ${getFullName(employee)}`}
        >
          +{childCount} reports
        </button>
      ) : null}

      {showMoreChip ? (
        <button
          type="button"
          className="org-collapse-chip org-collapse-chip-more"
          onClick={() => onMore(id)}
          title="Show the next direct reports"
          aria-label={`Show ${moreCount} more reports of ${getFullName(employee)}`}
        >
          +{moreCount} more
        </button>
      ) : null}
    </div>
  );
}

export default memo(DesktopEmployeeNode);
