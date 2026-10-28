/**
 * Groups flat sidebar nav items into VS Code-style expandable sections.
 * Only groups when 2+ matching items exist in the filtered list.
 * Does not invent routes — only reuses items already present.
 */

import {
  FaBell,
  FaBuilding,
  FaCalendarAlt,
  FaChartBar,
  FaClock,
  FaFolderOpen,
  FaGift,
  FaMoneyBill,
  FaUsers,
} from 'react-icons/fa';

/** Path sets for expandable parents (order of children follows this list). */
export const NAV_GROUP_DEFS = [
  {
    id: 'employees',
    name: 'Employees',
    icon: FaUsers,
    childPaths: ['/employees', '/id-card-generator'],
  },
  {
    id: 'organization',
    name: 'Organization',
    icon: FaBuilding,
    childPaths: [
      '/organization/chart',
      '/organization/subscription',
      '/role-hierarchy',
      '/admin/platform-roles',
      '/admin/approval-workflows',
      '/admin-settings',
    ],
  },
  {
    id: 'engagement',
    name: 'Engagement',
    icon: FaBell,
    childPaths: ['/engagement', '/employee/engagement'],
  },
  {
    id: 'documents',
    name: 'Documents',
    icon: FaFolderOpen,
    childPaths: [
      '/documents',
      '/admin/document-management',
      '/employee/documents-id',
      '/employee/document-requests',
      '/id-card-generator',
    ],
  },
  {
    id: 'benefits-learning',
    name: 'Benefits & Learning',
    icon: FaGift,
    childPaths: [
      '/benefits',
      '/learning',
      '/employee/benefits-learning',
      '/team-learning',
    ],
  },
  {
    id: 'workforce-benefits',
    name: 'Workforce planning',
    icon: FaChartBar,
    childPaths: ['/workforce'],
  },
  {
    id: 'leave-wfh',
    name: 'Leave & WFH',
    icon: FaClock,
    childPaths: [
      '/leave-management',
      '/employee/leave-attendance',
      '/my-leave',
      '/attendance-regularization',
      '/manager/attendance-regularization',
      '/my-attendance-regularization',
      '/admin/pending-approvals',
    ],
  },
  {
    id: 'attendance-calendar',
    name: 'Attendance & Calendar',
    icon: FaCalendarAlt,
    childPaths: [
      '/all-attendance-history',
      '/calendar-management',
      '/employee/calendar',
    ],
  },
  {
    id: 'payroll',
    name: 'Payroll',
    icon: FaMoneyBill,
    childPaths: ['/admin-payroll', '/employee-payroll', '/salary-structure'],
  },
];

/**
 * @param {Array<{ path: string, name: string, icon?: unknown }>} items
 * @returns {Array<
 *   | { type: 'link', item: object }
 *   | { type: 'group', id: string, name: string, Icon: Function, children: object[] }
 * >}
 */
export const buildSidebarNavTree = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) return [];

  const byPath = new Map(items.map((item) => [item.path, item]));

  let activeGroups = NAV_GROUP_DEFS.map((def) => {
    const children = def.childPaths.map((p) => byPath.get(p)).filter(Boolean);
    return { ...def, children };
  }).filter((g) => g.children.length >= 2);

  // Prefer Documents over Employees for shared /id-card-generator
  const documentsActive = activeGroups.some((g) => g.id === 'documents');
  activeGroups = activeGroups
    .map((g) => {
      if (g.id === 'employees' && documentsActive) {
        return {
          ...g,
          children: g.children.filter((c) => c.path !== '/id-card-generator'),
        };
      }
      return g;
    })
    .filter((g) => g.children.length >= 2);

  const groupedPaths = new Set(
    activeGroups.flatMap((g) => g.children.map((c) => c.path))
  );

  const emittedGroups = new Set();
  const tree = [];

  for (const item of items) {
    if (!groupedPaths.has(item.path)) {
      tree.push({ type: 'link', item });
      continue;
    }

    const group = activeGroups.find((g) =>
      g.children.some((c) => c.path === item.path)
    );
    if (!group || emittedGroups.has(group.id)) continue;

    emittedGroups.add(group.id);
    tree.push({
      type: 'group',
      id: group.id,
      name: group.name,
      Icon: group.icon,
      children: group.children,
    });
  }

  return tree;
};

export const findActiveNavGroupId = (tree, isPathActive) => {
  if (!Array.isArray(tree)) return null;
  for (const node of tree) {
    if (node.type !== 'group') continue;
    if (node.children.some((child) => isPathActive(child.path))) {
      return node.id;
    }
  }
  return null;
};
