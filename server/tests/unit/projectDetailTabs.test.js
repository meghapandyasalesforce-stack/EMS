import { beforeEach, describe, expect, it, jest } from "@jest/globals";
const query = (value) => {
  const q = {
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
    lean: async () => value,
  };
  for (const method of ["select", "populate", "sort", "skip", "limit"])
    q[method] = jest.fn(() => q);
  return q;
};
const Project = {
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findOneAndDelete: jest.fn(),
};
const Employee = { exists: jest.fn(), find: jest.fn() };
let savedUpdates = [],
  savedItems = [],
  nextId = 10;
class Update {
  constructor(data) {
    Object.assign(this, { _id: String(++nextId).padStart(24, "0") }, data);
    this.save = jest.fn(async () => {
      savedUpdates.push(this);
    });
  }
  static find = jest.fn();
  static findById = jest.fn();
  static countDocuments = jest.fn();
}
class Item {
  constructor(data) {
    Object.assign(
      this,
      { _id: String(++nextId).padStart(24, "0"), comments: [] },
      data,
    );
    this.save = jest.fn(async () => {
      savedItems.push(this);
    });
  }
  static find = jest.fn();
  static findOne = jest.fn();
  static findById = jest.fn();
  static deleteOne = jest.fn();
  static deleteMany = jest.fn();
}
const Task = { find: jest.fn() };
jest.unstable_mockModule("../../models/project.model.js", () => ({
  default: Project,
}));
jest.unstable_mockModule("../../models/employee.model.js", () => ({
  default: Employee,
}));
jest.unstable_mockModule("../../models/projectUpdate.model.js", () => ({
  default: Update,
}));
jest.unstable_mockModule("../../models/projectWorkItem.model.js", () => ({
  default: Item,
}));
jest.unstable_mockModule("../../models/task.model.js", () => ({
  default: Task,
}));
jest.unstable_mockModule("../../helpers/workItemAssignmentHelper.js", () => ({
  handleWorkItemAssigneeChange: jest.fn(async () => ({
    notified: true,
    memberAdded: true,
  })),
}));
jest.unstable_mockModule("../../helpers/notificationManager.js", () => ({
  notify: jest.fn(),
}));
jest.unstable_mockModule(
  "../../helpers/notificationEventRegistry.js",
  () => ({}),
);
const controller = await import("../../controllers/admin/projectController.js");
const work = await import(
  "../../controllers/admin/projectWorkItemController.js"
);
const { getProjectTasks } = await import(
  "../../controllers/employee/employeeTaskController.js"
);
const { addWorkItemComment } = await import(
  "../../controllers/both/workItemCommentController.js"
);
const id = "aaaaaaaaaaaaaaaaaaaaaaaa",
  employeeId = "bbbbbbbbbbbbbbbbbbbbbbbb",
  organizationId = "cccccccccccccccccccccccc",
  itemId = "dddddddddddddddddddddddd";
const req = (body = {}) => ({
  body,
  params: { id, projectId: id, workItemId: itemId },
  query: {},
  organizationId,
  employee: { _id: employeeId, organizationId, role: "employee" },
  authContext: {},
});
const res = () => ({
  code: 200,
  status(code) {
    this.code = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});
let project;
describe("Project detail tabs: actual controller decisions with mocked persistence", () => {
  beforeEach(() => {
    savedItems = [];
    savedUpdates = [];
    for (const model of [Project, Employee, Update, Item, Task])
      for (const key of Object.keys(model))
        if (jest.isMockFunction(model[key])) model[key].mockReset();
    project = {
      _id: id,
      name: "HRMS",
      organizationId,
      projectLeader: employeeId,
      projectMembers: [employeeId],
      status: "in-progress",
      save: jest.fn(async () => {}),
      toObject() {
        return { ...this };
      },
    };
    Project.findOne.mockImplementation(() => query(project));
    Project.findOneAndUpdate.mockImplementation((filter, data) =>
      query({ ...project, ...data }),
    );
    Project.findOneAndDelete.mockImplementation(() => query(project));
    Employee.exists.mockResolvedValue(true);
    Employee.find.mockImplementation(() => query([]));
    Update.find.mockImplementation(() => query(savedUpdates));
    Update.findById.mockImplementation(() => query(savedUpdates.at(-1)));
    Update.countDocuments.mockResolvedValue(0);
    Item.find.mockImplementation(() => query(savedItems));
    Item.findById.mockImplementation(() => query(savedItems.at(-1)));
    Item.deleteOne.mockResolvedValue({ deletedCount: 1 });
    Item.deleteMany.mockResolvedValue({ deletedCount: 0 });
    Task.find.mockImplementation(() => query([]));
  });
  it("reads project details within its organization", async () => {
    const out = res();
    await controller.getProjectById(req(), out);
    expect(out.code).toBe(200);
    expect(out.body.project.name).toBe("HRMS");
    expect(Project.findOne).toHaveBeenCalledWith({ _id: id, organizationId });
  });
  it("saves project changes without rejecting unchanged inactive members", async () => {
    const out = res();
    await controller.updateProject(
      req({
        name: "Updated project",
        projectLeader: employeeId,
        projectMembers: [employeeId],
        status: "on-hold",
      }),
      out,
    );
    expect(out.code).toBe(200);
    expect(out.body.project.status).toBe("on-hold");
    expect(Employee.find.mock.calls[0][0]._id.$in).toEqual([]);
    expect(Project.findOneAndUpdate.mock.calls[0][0]).toEqual({
      _id: id,
      organizationId,
    });
  });
  it("rejects a new inactive or cross-organization project member", async () => {
    const out = res();
    await controller.updateProject(
      req({
        name: "Updated project",
        projectMembers: ["eeeeeeeeeeeeeeeeeeeeeeee"],
      }),
      out,
    );
    expect(out.code).toBe(400);
    expect(Project.findOneAndUpdate).not.toHaveBeenCalled();
    expect(Employee.find.mock.calls[0][0].organizationId).toBe(organizationId);
  });
  it("updates project status for the project lead", async () => {
    const out = res();
    await controller.updateProjectStatus(req({ status: "completed" }), out);
    expect(out.code).toBe(200);
    expect(project.save).toHaveBeenCalled();
    expect(project.status).toBe("completed");
  });
  it("prevents a nonmember from posting status or daily updates", async () => {
    project.projectLeader = "eeeeeeeeeeeeeeeeeeeeeeee";
    project.projectMembers = [];
    for (const fn of [
      controller.updateProjectStatus,
      controller.createProjectUpdate,
    ]) {
      const out = res();
      await fn(req({ status: "completed", update: "Progress report" }), out);
      expect(out.code).toBe(403);
    }
    expect(savedUpdates).toHaveLength(0);
  });
  it("allows an assigned member to post updates without granting project status changes", async () => {
    project.projectLeader = "eeeeeeeeeeeeeeeeeeeeeeee";
    const out = res();
    await controller.createProjectUpdate(req({ update: "Team member progress", status: "in-progress" }), out);
    expect(out.code).toBe(201);
    expect(savedUpdates[0].postedBy).toBe(employeeId);
    const status = res();
    await controller.updateProjectStatus(req({ status: "completed" }), status);
    expect(status.code).toBe(403);
    expect(project.save).not.toHaveBeenCalled();
  });
  it("posts all daily update fields and populates the author", async () => {
    const input = {
      update: "Daily progress",
      updateDate: "2026-11-02",
      status: "in-progress",
      progress: 75,
      blockers: "Waiting on review",
      nextSteps: "Finish review",
    };
    const out = res();
    await controller.createProjectUpdate(req(input), out);
    expect(out.code).toBe(201);
    expect(savedUpdates[0]).toMatchObject({
      ...input,
      updateDate: new Date("2026-11-02"),
      projectId: id,
      organizationId,
      postedBy: employeeId,
    });
    expect(Update.findById).toHaveBeenCalled();
  });
  it.each([
    { update: "" },
    { update: 12 },
    { update: "x", progress: NaN },
    { update: "x", progress: "50" },
    { update: "x", progress: 101 },
    { update: "x", updateDate: "bad-date" },
    { update: "x", updateDate: "2026-02-30" },
    { update: "x", updateDate: " 2026-02-30 " },
    { update: "x", updateDate: 12 },
    { update: "x", blockers: "x".repeat(1001) },
    { update: "x", status: "unknown" },
  ])("rejects invalid daily update input: %j", async (input) => {
    const out = res();
    await controller.createProjectUpdate(req(input), out);
    expect(out.code).toBe(400);
    expect(savedUpdates).toHaveLength(0);
  });
  it("bounds daily update pagination and scopes every query", async () => {
    Update.countDocuments.mockResolvedValue(250);
    const input = req();
    input.query = { page: "2", limit: "1000" };
    const out = res();
    await controller.getProjectUpdates(input, out);
    expect(out.code).toBe(200);
    expect(out.body.pagination).toMatchObject({
      page: 2,
      limit: 100,
      hasNext: true,
    });
    expect(Update.find).toHaveBeenCalledWith({ projectId: id, organizationId });
    expect(Update.countDocuments).toHaveBeenCalledWith({
      projectId: id,
      organizationId,
    });
  });
  it.each([
    "getProjectById",
    "updateProject",
    "updateProjectStatus",
    "createProjectUpdate",
    "getProjectUpdates",
    "deleteProject",
  ])("does not access another tenant’s project in %s", async (name) => {
    Project.findOne.mockImplementation(() => query(null));
    Project.findOneAndDelete.mockImplementation(() => query(null));
    const out = res();
    await controller[name](req({ status: "completed", update: "Report" }), out);
    expect(out.code).toBe(404);
    expect(savedUpdates).toHaveLength(0);
  });
  it("loads team daily logs for this organization and project", async () => {
    Task.find.mockImplementation(() =>
      query([
        {
          _id: "log",
          taskDescription: "Today’s work",
          employee: { name: "Alex" },
          status: "Completed",
        },
      ]),
    );
    const out = res();
    await getProjectTasks(req(), out);
    expect(out.code).toBe(200);
    expect(out.body.tasks[0].taskDescription).toBe("Today’s work");
    expect(Task.find).toHaveBeenCalledWith({ project: id, organizationId });
  });
  it("rejects log fetches for missing/other-tenant projects and invalid dates", async () => {
    Project.findOne.mockImplementation(() => query(null));
    let out = res();
    await getProjectTasks(req(), out);
    expect(out.code).toBe(404);
    expect(Task.find).not.toHaveBeenCalled();
    Project.findOne.mockImplementation(() => query(project));
    const input = req();
    input.query = { date: "invalid" };
    out = res();
    await getProjectTasks(input, out);
    expect(out.code).toBe(400);
  });
  it("loads the work-plan tree with its subtasks through the read endpoint", async () => {
    const parent = new Item({ projectId: id, title: "Parent task" }),
      child = new Item({
        projectId: id,
        title: "Child task",
        parentTask: parent._id,
      });
    savedItems = [parent, child];
    const out = res();
    await work.getProjectWorkItems(req(), out);
    expect(out.code).toBe(200);
    expect(out.body.workItems[0].subtasks[0].title).toBe("Child task");
    expect(Item.find).toHaveBeenCalledWith({ projectId: id, organizationId });
  });
  it("rejects invalid project status without persisting it", async () => {
    const out = res();
    await controller.updateProjectStatus(req({ status: "invalid" }), out);
    expect(out.code).toBe(400);
    expect(project.save).not.toHaveBeenCalled();
  });
  it("creates work-plan tasks and subtasks using the existing API", async () => {
    const out = res();
    await work.postProjectWorkItems(
      req({
        items: [{ title: "Parent task", subtasks: [{ title: "Child task" }] }],
      }),
      out,
    );
    expect(out.code).toBe(201);
    expect(savedItems).toHaveLength(2);
    expect(savedItems[1].parentTask).toBe(savedItems[0]._id);
    expect(out.body.workItems[0].subtasks[0].title).toBe("Child task");
  });
  it("adds a subtask to an existing parent only within the same project", async () => {
    Item.findOne.mockImplementation(() => query({ _id: itemId }));
    const out = res();
    await work.postProjectWorkItems(
      req({ items: [{ title: "New child", parentTask: itemId }] }),
      out,
    );
    expect(out.code).toBe(201);
    expect(savedItems[0].parentTask).toBe(itemId);
    expect(Item.findOne).toHaveBeenCalledWith({
      _id: itemId,
      projectId: id,
      organizationId,
    });
  });
  it("requires and stores a reason when changing a task due date", async () => {
    const item = new Item({
      projectId: id,
      title: "Task",
      dueDate: new Date("2026-11-10"),
      dueDateHistory: [],
    });
    Item.findOne.mockImplementation(() => query(item));
    let out = res();
    await work.updateProjectWorkItem(req({ dueDate: "2026-11-12" }), out);
    expect(out.code).toBe(400);
    expect(item.save).not.toHaveBeenCalled();
    out = res();
    await work.updateProjectWorkItem(
      req({ dueDate: "2026-11-12", dueDateChangeReason: "Review moved" }),
      out,
    );
    expect(out.code).toBe(200);
    expect(item.dueDateHistory[0]).toMatchObject({
      reason: "Review moved",
      changedBy: employeeId,
    });
  });
  it("updates status and assignments and returns notification metadata", async () => {
    const item = new Item({ projectId: id, title: "Task", assignees: [] });
    Item.findOne.mockImplementation(() => query(item));
    Employee.find.mockImplementation(() => query([{ _id: employeeId }]));
    const out = res();
    await work.updateProjectWorkItem(
      req({ status: "completed", assignees: [employeeId] }),
      out,
    );
    expect(out.code).toBe(200);
    expect(item.status).toBe("completed");
    expect(out.body.assignment.notified).toBe(true);
  });
  it("deletes a work item and its child tree", async () => {
    const item = new Item({ projectId: id, title: "Task" });
    Item.findOne.mockImplementation(() => query(item));
    const child = "eeeeeeeeeeeeeeeeeeeeeeee",
      grandchild = "ffffffffffffffffffffffff";
    Item.find.mockImplementation((filter) =>
      query(
        filter.parentTask === item._id
          ? [{ _id: child }]
          : filter.parentTask === child
            ? [{ _id: grandchild }]
            : [],
      ),
    );
    const out = res();
    await work.deleteProjectWorkItem(req(), out);
    expect(out.code).toBe(200);
    expect(Item.deleteOne).toHaveBeenCalledTimes(3);
    for (const _id of [item._id, child, grandchild])
      expect(Item.deleteOne).toHaveBeenCalledWith({
        _id,
        projectId: id,
        organizationId,
      });
  });
  it("preserves comments and author attribution for project members", async () => {
    const item = new Item({ projectId: id, title: "Task" });
    Item.findOne.mockImplementation(() => query(item));
    Item.findById.mockImplementation(() => query(item));
    const out = res();
    await addWorkItemComment(req({ text: "Reviewed the task" }), out);
    expect(out.code).toBe(201);
    expect(item.comments).toContainEqual({
      author: employeeId,
      text: "Reviewed the task",
    });
  });
  it.each([
    { items: [{ title: " " }] },
    { items: "invalid" },
    { items: [{ title: "Task", dueDate: "2026-02-30" }] },
    { items: [{ title: "Task", dueDate: " 2026-02-30 " }] },
    { items: [{ title: "Task", status: "unknown" }] },
    { items: [{ title: "Task", priority: "unknown" }] },
  ])(
    "rejects invalid work items without saving partial results: %j",
    async (input) => {
      const out = res();
      await work.postProjectWorkItems(req(input), out);
      expect(out.code).toBe(400);
      expect(savedItems).toHaveLength(0);
    },
  );
  it.each([
    { status: "unknown" },
    { priority: "unknown" },
    { dueDate: "2026-02-30", dueDateChangeReason: "Move" },
  ])("rejects invalid work-item changes: %j", async (input) => {
    const item = new Item({ projectId: id, title: "Task" });
    Item.findOne.mockImplementation(() => query(item));
    const out = res();
    await work.updateProjectWorkItem(req(input), out);
    expect(out.code).toBe(400);
    expect(item.save).not.toHaveBeenCalled();
  });
});
