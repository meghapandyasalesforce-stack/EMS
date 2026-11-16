import { beforeEach, describe, expect, it, jest } from '@jest/globals';
const projectId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const employeeId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const organizationId = 'cccccccccccccccccccccccc';
const otherEmployeeId = 'dddddddddddddddddddddddd';
const project = { _id: projectId, organizationId, name: 'HRMS', projectMembers: [employeeId, otherEmployeeId] };
const query = value => {
  const q = { then: (resolve, reject) => Promise.resolve(value).then(resolve, reject), lean: async () => value };
  for (const name of ['populate', 'select', 'sort']) q[name] = jest.fn(() => q);
  return q;
};
let saved;
const matches = (task, filter) => Object.entries(filter).every(([key, value]) => key === 'date' ? task.date >= value.$gte && task.date < value.$lt : String(task[key]) === String(value));
class Task {
  constructor(data) { Object.assign(this, data, { _id: String(saved.length + 1), date: new Date() }); this.save = jest.fn(async () => { if (!saved.includes(this)) saved.push(this); }); }
  static findOne = jest.fn();
  static findById = jest.fn();
  static find = jest.fn();
}
const Project = { findOne: jest.fn(), findById: jest.fn() };
const Employee = { findById: jest.fn() };
const notify = jest.fn();
jest.unstable_mockModule('../../models/task.model.js', () => ({ default: Task }));
jest.unstable_mockModule('../../models/project.model.js', () => ({ default: Project }));
jest.unstable_mockModule('../../models/employee.model.js', () => ({ default: Employee }));
jest.unstable_mockModule('../../helpers/notificationManager.js', () => ({ notify }));
jest.unstable_mockModule('../../helpers/notificationEventRegistry.js', () => ({}));
const { createTodayTask, updateTask, getProjectTasks, getMyTasks } = await import('../../controllers/employee/employeeTaskController.js');
const req = (body = {}, id = employeeId) => ({ body, employee: { _id: id, organizationId }, params: { projectId }, query: {} });
const res = () => { const out = { status: jest.fn(), json: jest.fn() }; out.status.mockReturnValue(out); out.json.mockReturnValue(out); return out; };
beforeEach(() => {
  jest.clearAllMocks(); saved = [];
  Project.findOne.mockImplementation(filter => query(filter.organizationId === organizationId && (!filter.$or || project.projectMembers.includes(filter.$or[1].projectMembers)) ? project : null));
  Project.findById.mockImplementation(() => query(project));
  Employee.findById.mockResolvedValue({ _id: employeeId, organizationId });
  Task.findOne.mockImplementation(async filter => saved.find(task => matches(task, filter)) || null);
  Task.findById.mockImplementation(id => query(saved.find(task => task._id === id)));
  Task.find.mockImplementation(filter => query(saved.filter(task => matches(task, filter))));
  notify.mockResolvedValue(undefined);
});
describe('employee daily task -> team daily logs', () => {
  it('accepts logs from newly assigned members without work-plan tasks and returns all team entries for the project', async () => {
    for (const id of [employeeId, otherEmployeeId]) {
      const out = res();
      await createTodayTask(req({ projectId, taskDescription: `Work by ${id}`, status: 'Completed' }, id), out);
      expect(out.status).toHaveBeenCalledWith(201);
    }
    const out = res();
    await getProjectTasks(req(), out);
    expect(out.json.mock.calls[0][0].tasks).toHaveLength(2);
    expect(saved.every(task => task.project === projectId && task.organizationId === organizationId)).toBe(true);
    expect(Task.find).toHaveBeenLastCalledWith({ project: projectId, organizationId });
  });
  it('rejects nonmembers and projects outside the authenticated organization', async () => {
    const out = res();
    await createTodayTask(req({ projectId, taskDescription: 'Unassigned' }, 'eeeeeeeeeeeeeeeeeeeeeeee'), out);
    expect(out.status).toHaveBeenCalledWith(403);
    const input = req({ projectId, taskDescription: 'Other tenant' });
    input.employee.organizationId = 'ffffffffffffffffffffffff';
    await createTodayTask(input, res());
    expect(saved).toHaveLength(0);
  });
  it('updates today’s log and clears comments without creating another daily entry', async () => {
    await createTodayTask(req({ projectId, taskDescription: 'First', comments: 'Old note' }), res());
    const input = req({ taskDescription: 'Finished', status: 'Completed', comments: '' });
    input.params.taskId = saved[0]._id;
    const out = res(); await updateTask(input, out);
    expect(out.status).toHaveBeenCalledWith(200);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ taskDescription: 'Finished', status: 'Completed', comments: '' });
    const team = res(); await getProjectTasks(req(), team);
    expect(team.json.mock.calls[0][0].tasks[0].taskDescription).toBe('Finished');
  });
  it('does not let another employee or organization update an existing log', async () => {
    await createTodayTask(req({ projectId, taskDescription: 'Private work' }), res());
    const other = req({ taskDescription: 'Changed by someone else' }, otherEmployeeId);
    other.params.taskId = saved[0]._id;
    const forbidden = res(); await updateTask(other, forbidden);
    expect(forbidden.status).toHaveBeenCalledWith(404);
    const foreign = req({ taskDescription: 'Other tenant' });
    foreign.employee.organizationId = 'ffffffffffffffffffffffff';
    foreign.params.taskId = saved[0]._id;
    const missing = res(); await updateTask(foreign, missing);
    expect(missing.status).toHaveBeenCalledWith(404);
    expect(saved[0].taskDescription).toBe('Private work');
  });
  it('returns successful saves and updates even when notification delivery fails', async () => {
    notify.mockRejectedValue(new Error('Delivery unavailable'));
    const created = res(); await createTodayTask(req({ projectId, taskDescription: 'Saved' }), created);
    expect(created.status).toHaveBeenCalledWith(201);
    const input = req({ taskDescription: 'Updated' }); input.params.taskId = saved[0]._id;
    const updated = res(); await updateTask(input, updated);
    expect(updated.status).toHaveBeenCalledWith(200);
    expect(saved[0].taskDescription).toBe('Updated');
  });
  it('rejects blank descriptions and duplicate entries for the same employee/project/day', async () => {
    const blank = res(); await createTodayTask(req({ projectId, taskDescription: '  ' }), blank);
    expect(blank.status).toHaveBeenCalledWith(400);
    await createTodayTask(req({ projectId, taskDescription: 'First' }), res());
    const duplicate = res(); await createTodayTask(req({ projectId, taskDescription: 'Duplicate' }), duplicate);
    expect(duplicate.status).toHaveBeenCalledWith(400);
    expect(saved).toHaveLength(1);
  });
  it('limits the personal project log request to the signed-in employee', async () => {
    const input = req(); input.query = { projectId, scope: 'mine' };
    await getMyTasks(input, res());
    expect(Task.find).toHaveBeenLastCalledWith({ organizationId, employee: employeeId, project: projectId });
  });
});
