import { describe, it, expect } from 'vitest';
import { buildSidebarNavTree, findActiveNavGroupId } from './navGrouping';

const item = (path, name = path) => ({ path, name, icon: null });

describe('buildSidebarNavTree', () => {
  it('keeps single-item groups as standalone links', () => {
    const tree = buildSidebarNavTree([
      item('/dashboard-hr', 'Dashboard'),
      item('/leave-management', 'Leave management'),
      item('/recruitment', 'Recruitment'),
    ]);

    expect(tree).toHaveLength(3);
    expect(tree.every((n) => n.type === 'link')).toBe(true);
  });

  it('groups leave & WFH separately from attendance & calendar', () => {
    const tree = buildSidebarNavTree([
      item('/dashboard-hr', 'Dashboard'),
      item('/leave-management', 'Leave management'),
      item('/attendance-regularization', 'Regularization/WFH'),
      item('/admin/pending-approvals', 'Pending approvals'),
      item('/all-attendance-history', 'Attendance'),
      item('/calendar-management', 'Calendar'),
      item('/recruitment', 'Recruitment'),
    ]);

    expect(tree[0]).toMatchObject({ type: 'link', item: { path: '/dashboard-hr' } });

    const leaveGroup = tree.find((n) => n.type === 'group' && n.id === 'leave-wfh');
    expect(leaveGroup).toBeTruthy();
    expect(leaveGroup.name).toBe('Leave & WFH');
    expect(leaveGroup.children.map((c) => c.path)).toEqual([
      '/leave-management',
      '/attendance-regularization',
      '/admin/pending-approvals',
    ]);

    const attendanceGroup = tree.find((n) => n.type === 'group' && n.id === 'attendance-calendar');
    expect(attendanceGroup).toBeTruthy();
    expect(attendanceGroup.name).toBe('Attendance & Calendar');
    expect(attendanceGroup.children.map((c) => c.path)).toEqual([
      '/all-attendance-history',
      '/calendar-management',
    ]);

    expect(tree.some((n) => n.type === 'link' && n.item.path === '/recruitment')).toBe(true);
  });

  it('groups payroll parent with admin + my payroll', () => {
    const tree = buildSidebarNavTree([
      item('/admin-payroll', 'Payroll'),
      item('/employee-payroll', 'My payroll'),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].type).toBe('group');
    expect(tree[0].id).toBe('payroll');
    expect(tree[0].children).toHaveLength(2);
  });

  it('groups benefits and learning like the employee hub', () => {
    const tree = buildSidebarNavTree([
      item('/benefits', 'Benefits'),
      item('/learning', 'Learning & development'),
      item('/employee/benefits-learning', 'My benefits & learning'),
      item('/workforce', 'Workforce planning'),
    ]);

    expect(tree[0].type).toBe('group');
    expect(tree[0].id).toBe('benefits-learning');
    expect(tree[0].name).toBe('Benefits & Learning');
    expect(tree[0].children.map((c) => c.path)).toEqual([
      '/benefits',
      '/learning',
      '/employee/benefits-learning',
    ]);
    expect(tree[1]).toMatchObject({ type: 'link', item: { path: '/workforce' } });
  });

  it('does not duplicate paths across groups', () => {
    const tree = buildSidebarNavTree([
      item('/employees', 'Employees'),
      item('/documents', 'Documents'),
      item('/id-card-generator', 'ID cards'),
      item('/admin/document-management', 'Document management'),
    ]);

    const paths = [];
    tree.forEach((node) => {
      if (node.type === 'link') paths.push(node.item.path);
      else node.children.forEach((c) => paths.push(c.path));
    });
    expect(paths).toHaveLength(new Set(paths).size);
    expect(paths.filter((p) => p === '/id-card-generator')).toHaveLength(1);
  });
});

describe('findActiveNavGroupId', () => {
  it('returns the leave & WFH group containing the active child', () => {
    const tree = buildSidebarNavTree([
      item('/leave-management', 'Leave management'),
      item('/attendance-regularization', 'Regularization/WFH'),
    ]);
    const id = findActiveNavGroupId(tree, (path) => path === '/attendance-regularization');
    expect(id).toBe('leave-wfh');
  });

  it('returns the attendance & calendar group for calendar routes', () => {
    const tree = buildSidebarNavTree([
      item('/all-attendance-history', 'Attendance'),
      item('/calendar-management', 'Calendar'),
    ]);
    const id = findActiveNavGroupId(tree, (path) => path === '/calendar-management');
    expect(id).toBe('attendance-calendar');
  });
});
