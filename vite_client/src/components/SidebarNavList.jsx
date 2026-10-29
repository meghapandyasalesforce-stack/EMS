import React, { useEffect, useMemo, useState } from 'react';
import { FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { buildSidebarNavTree, findActiveNavGroupId } from '../utils/navGrouping';

/**
 * VS Code Explorer–style collapsible sidebar nav.
 * Accordion: only one group expanded at a time.
 */
const SidebarNavList = ({
  items = [],
  isActive,
  onNavigate,
  lightTheme = false,
  flat = false,
}) => {
  const tree = useMemo(
    () => flat ? items.map((item) => ({ type: 'link', item })) : buildSidebarNavTree(items),
    [items, flat]
  );

  const routeActiveGroupId = useMemo(
    () => findActiveNavGroupId(tree, isActive),
    [tree, isActive]
  );

  const [expandedGroupId, setExpandedGroupId] = useState(routeActiveGroupId);

  useEffect(() => {
    if (routeActiveGroupId) {
      setExpandedGroupId(routeActiveGroupId);
    }
  }, [routeActiveGroupId]);

  const toggleGroup = (groupId) => {
    setExpandedGroupId((prev) => (prev === groupId ? null : groupId));
  };

  const linkBase = lightTheme
    ? 'text-gray-600 hover:bg-gray-100/90 hover:text-gray-900'
    : 'text-gray-300 hover:bg-gray-700/50 hover:text-white';

  const parentBase = lightTheme
    ? 'text-gray-700 hover:bg-gray-100/90'
    : 'text-gray-200 hover:bg-gray-700/50';

  const childIdle = lightTheme
    ? 'text-gray-600 hover:bg-gray-100/90 hover:text-gray-900'
    : 'text-gray-400 hover:bg-gray-700/40 hover:text-white';

  return (
    <ul className="hrms-sidebar-nav list-none m-0 p-0">
      {tree.map((node) => {
        if (node.type === 'link') {
          const { item } = node;
          const active = isActive(item.path);
          return (
            <li key={item.path} className="hrms-sidebar-nav__item">
              <button
                type="button"
                title={item.name}
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate(item.path)}
                className={`hrms-sidebar-nav__link ${active ? 'is-active' : linkBase}`}
                style={
                  active
                    ? {
                        backgroundColor: 'var(--color-primary)',
                        color: '#fff',
                        boxShadow: '0 8px 14px -4px rgba(0,0,0,0.18)',
                      }
                    : undefined
                }
              >
                <span className="hrms-sidebar-nav__icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="hrms-sidebar-nav__label">{item.name}</span>
              </button>
            </li>
          );
        }

        const expanded = expandedGroupId === node.id;
        const Icon = node.Icon;

        return (
          <li key={node.id} className="hrms-sidebar-nav__item">
            <button
              type="button"
              title={node.name}
              aria-expanded={expanded}
              onClick={() => toggleGroup(node.id)}
              className={`hrms-sidebar-nav__parent ${parentBase}`}
            >
              <span className="hrms-sidebar-nav__chevron" aria-hidden="true">
                {expanded ? <FiChevronDown /> : <FiChevronRight />}
              </span>
              <span className="hrms-sidebar-nav__icon" aria-hidden="true">
                {Icon ? <Icon /> : null}
              </span>
              <span className="hrms-sidebar-nav__label">{node.name}</span>
            </button>

            <div
              className={`hrms-sidebar-nav__children${expanded ? ' is-open' : ''}`}
              role="group"
              aria-label={node.name}
            >
              <ul className="list-none m-0 p-0">
                {node.children.map((child) => {
                  const childActive = isActive(child.path);
                  return (
                    <li key={child.path}>
                      <button
                        type="button"
                        title={child.name}
                        onClick={() => onNavigate(child.path)}
                        className={`hrms-sidebar-nav__child ${
                          childActive ? 'is-active' : childIdle
                        }`}
                        style={
                          childActive
                            ? {
                                color: lightTheme ? '#07523e' : '#ffffff',
                                backgroundColor: lightTheme
                                  ? 'rgba(14, 147, 112, 0.12)'
                                  : 'rgba(14, 147, 112, 0.28)',
                              }
                            : undefined
                        }
                      >
                        <span className="hrms-sidebar-nav__icon" aria-hidden="true">
                          {child.icon}
                        </span>
                        <span className="hrms-sidebar-nav__label">{child.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default SidebarNavList;
