import { beforeEach, describe, expect, it, jest } from "@jest/globals";
jest.unstable_mockModule("../../helpers/wfhWriteLock.js", () => ({
  withWfhWriteLock: (handler) => handler,
}));
const R = {
  find: jest.fn(),
  create: jest.fn(),
  findOne: jest.fn(),
  updateOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
};
const C = { find: jest.fn(), findOne: jest.fn() };
const E = { findById: jest.fn(), countDocuments: jest.fn() };
jest.unstable_mockModule("../../models/wfhRequest.model.js", () => ({
  default: R,
}));
jest.unstable_mockModule("../../models/calendar.model.js", () => ({
  default: C,
}));
jest.unstable_mockModule("../../models/employee.model.js", () => ({
  default: E,
}));
jest.unstable_mockModule("../../helpers/backgroundTasks.js", () => ({
  runInBackground: jest.fn(),
}));
jest.unstable_mockModule("../../helpers/emailSender.js", () => ({
  sendWfhApprovalEmail: jest.fn(),
  sendWfhRejectionEmail: jest.fn(),
  sendWfhRequestEmail: jest.fn(),
}));
jest.unstable_mockModule("../../helpers/leaveEmailHelper.js", () => ({
  getLeaveNotificationEmails: jest.fn(),
}));
jest.unstable_mockModule("../../helpers/permissionService.js", () => ({
  shouldScopeDataToManagedTeam: () => false,
}));
jest.unstable_mockModule("../../helpers/managerHelper.js", () => ({
  getManagerEmployeeIds: jest.fn(),
}));
jest.unstable_mockModule(
  "../../helpers/emailThreadPersistenceHelper.js",
  () => ({
    persistThreadRootMessageId: jest.fn(),
    resolveStoredThreadRootMessageId: jest.fn(),
    THREAD_ROOT_REPLY_LOOKUP: {},
  }),
);
const { createWfhRequest, reviewWfhRequest, cancelWfhRequest } = await import(
  "../../controllers/wfh/wfhRequestController.js"
);
const {
  enableWfhDates,
  disableWfhDates,
  updateWfhExclusions,
  convertHolidayToWorkingDay,
} = await import("../../controllers/admin/calendarController.js");
const { loadAttendanceDayPlan, isWfhOnlyPunchPeriod, classifyWfhForDate } =
  await import("../../helpers/attendanceDayContextHelper.js");
const Leave = (await import("../../models/leave.model.js")).default;
const rows = (data) => ({ select: () => ({ lean: async () => data }) });
const date = (d) => new Date(d + "T00:00:00");
const req = (body = {}) => ({
  employee: { _id: "A", name: "Employee", organizationId: "org" },
  organizationId: "org",
  body,
  params: { year: "2026", id: "r1", holidayId: "h1" },
});
const res = () => ({
  statusCode: 200,
  status(n) {
    this.statusCode = n;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});
const row = (status = "pending") => ({
  _id: "r1",
  employeeId: "A",
  status,
  wfhDate: date("2026-11-10"),
  wfhDateTo: date("2026-11-12"),
});
const calendar = () => ({
  wfhDates: [],
  holidays: [],
  workingDays: {
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
  },
  save: jest.fn(async () => {}),
  populate: jest.fn(async () => {}),
  markModified: jest.fn(),
  set(k, v) {
    this[k] = v;
  },
});
const application = {
  wfhDateFrom: "2026-11-10",
  wfhDateTo: "2026-11-12",
  reason: "Working remotely",
};
const schedule = {
  dateFrom: "2026-11-10",
  dateTo: "2026-11-12",
  employeeAccess: "only_these",
  excludedEmployeeIds: ["A"],
};
describe("WFH API and attendance workflows", () => {
  beforeEach(() => {
    Object.values(R).forEach((fn) => fn.mockReset());
    Object.values(C).forEach((fn) => fn.mockReset());
    E.countDocuments.mockReset().mockResolvedValue(1);
    R.find.mockReturnValue(rows([]));
    C.find.mockReturnValue(rows([]));
    C.findOne.mockResolvedValue(calendar());
    R.create.mockImplementation(async (data) => ({ _id: "new", ...data }));
    R.updateOne.mockResolvedValue({ modifiedCount: 1 });
  });
  it("creates independent multi-date requests without an HR calendar", async () => {
    const out = res();
    await createWfhRequest(req(application), out);
    expect(out.statusCode).toBe(201);
    expect(R.create).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: "A",
        organizationId: "org",
        wfhDate: date("2026-11-10"),
        wfhDateTo: date("2026-11-12"),
      }),
    );
  });
  it.each(["pending", "submitted", "approved"])(
    "blocks duplicate %s requests via API",
    async (status) => {
      R.find.mockReturnValue(rows([row(status)]));
      const out = res();
      await createWfhRequest(req(application), out);
      expect(out.statusCode).toBe(409);
      expect(out.body.details.dates).toHaveLength(3);
      expect(R.create).not.toHaveBeenCalled();
    },
  );
  it("rejects the whole range when one HR-assigned date overlaps", async () => {
    C.find.mockReturnValue(
      rows([
        {
          wfhDates: [
            {
              date: date("2026-11-11"),
              employeeAccess: "only_these",
              excludedEmployeeIds: ["A"],
            },
          ],
        },
      ]),
    );
    const out = res();
    await createWfhRequest(req(application), out);
    expect(out.body.code).toBe("WFH_HR_SCHEDULE_CONFLICT");
    expect(out.body.details.dates).toEqual(["2026-11-11"]);
    expect(R.create).not.toHaveBeenCalled();
  });
  it.each([
    { ...application, wfhDateTo: "2026-11-09" },
    { ...application, wfhDateFrom: "2026-02-30" },
    { ...application, wfhType: "half_day", halfDayType: "first_half" },
    { ...application, wfhType: "invalid" },
  ])("rejects invalid API dates/types", async (body) => {
    const out = res();
    await createWfhRequest(req(body), out);
    expect(out.statusCode).toBe(400);
    expect(R.create).not.toHaveBeenCalled();
  });
  it.each(["approve", "reject"])(
    "keeps the existing %s workflow",
    async (action) => {
      R.findOne.mockResolvedValue(row());
      const out = res();
      await reviewWfhRequest(req({ action, note: "Reviewed" }), out);
      expect(out.statusCode).toBe(200);
      expect(R.updateOne.mock.lastCall[1].$set.status).toBe(
        action === "approve" ? "approved" : "rejected",
      );
    },
  );
  it("rechecks calendar conflicts at approval", async () => {
    R.findOne.mockResolvedValue(row());
    C.find.mockReturnValue(
      rows([
        {
          wfhDates: [
            {
              date: date("2026-11-10"),
              employeeAccess: "all_except",
              excludedEmployeeIds: [],
            },
          ],
        },
      ]),
    );
    const out = res();
    await reviewWfhRequest(req({ action: "approve" }), out);
    expect(out.statusCode).toBe(409);
    expect(R.updateOne).not.toHaveBeenCalled();
  });
  it("does not review cancelled requests or overwrite a concurrent cancellation", async () => {
    R.findOne.mockResolvedValue(row("cancelled"));
    let out = res();
    await reviewWfhRequest(req({ action: "approve" }), out);
    expect(out.statusCode).toBe(409);
    R.findOne.mockResolvedValue(row());
    R.updateOne.mockResolvedValue({ modifiedCount: 0 });
    out = res();
    await reviewWfhRequest(req({ action: "approve" }), out);
    expect(out.statusCode).toBe(409);
  });
  it("cancels only the owner’s active request in their tenant", async () => {
    R.findOneAndUpdate.mockResolvedValue({ ...row(), status: "cancelled" });
    const out = res();
    await cancelWfhRequest(req(), out);
    expect(out.statusCode).toBe(200);
    expect(R.findOneAndUpdate.mock.calls[0][0]).toEqual({
      _id: "r1",
      organizationId: "org",
      employeeId: "A",
      status: { $in: ["pending", "submitted", "approved"] },
    });
  });
  it.each(["pending", "approved"])(
    "blocks HR assigning %s request dates",
    async (status) => {
      R.find.mockReturnValue(rows([row(status)]));
      const cal = calendar();
      C.findOne.mockResolvedValue(cal);
      const out = res();
      await enableWfhDates(req(schedule), out);
      expect(out.statusCode).toBe(409);
      expect(out.body.details.dates).toHaveLength(3);
      expect(cal.save).not.toHaveBeenCalled();
    },
  );
  it("allows HR to assign another employee on those dates", async () => {
    R.find.mockReturnValue(rows([row()]));
    const cal = calendar();
    C.findOne.mockResolvedValue(cal);
    const out = res();
    await enableWfhDates(req({ ...schedule, excludedEmployeeIds: ["B"] }), out);
    expect(out.statusCode).toBe(200);
    expect(cal.wfhDates).toHaveLength(3);
  });
  it("supports everyone coverage", async () => {
    E.countDocuments.mockResolvedValue(0);
    const cal = calendar();
    C.findOne.mockResolvedValue(cal);
    const out = res();
    await enableWfhDates(
      req({
        ...schedule,
        employeeAccess: "all_except",
        excludedEmployeeIds: [],
      }),
      out,
    );
    expect(out.statusCode).toBe(200);
    expect(cal.wfhDates[0].employeeAccess).toBe("all_except");
  });
  it("requires explicit schedule edits and removes former dates when moved", async () => {
    const cal = calendar();
    cal.wfhDates = [
      {
        date: date("2026-11-10"),
        employeeAccess: "only_these",
        excludedEmployeeIds: ["A"],
      },
    ];
    C.findOne.mockResolvedValue(cal);
    let out = res();
    await enableWfhDates(req({ ...schedule, dateTo: "2026-11-10" }), out);
    expect(out.statusCode).toBe(409);
    out = res();
    await enableWfhDates(
      req({
        ...schedule,
        dateFrom: "2026-11-11",
        dateTo: "2026-11-11",
        updateExisting: true,
        replaceDates: ["2026-11-10"],
      }),
      out,
    );
    expect(out.statusCode).toBe(200);
    expect(cal.wfhDates.map((e) => e.date.getDate())).toEqual([11]);
  });
  it("rechecks conflicts when employee coverage is changed", async () => {
    const cal = calendar();
    cal.wfhDates = [
      {
        date: date("2026-11-10"),
        employeeAccess: "only_these",
        excludedEmployeeIds: ["B"],
      },
    ];
    C.findOne.mockResolvedValue(cal);
    R.find.mockReturnValue(rows([row()]));
    const out = res();
    await updateWfhExclusions(
      req({ date: "2026-11-10", excludedEmployeeIds: ["A"] }),
      out,
    );
    expect(out.statusCode).toBe(409);
    expect(cal.save).not.toHaveBeenCalled();
  });
  it("removes schedules with the existing delete API", async () => {
    const cal = calendar();
    cal.wfhDates = [{ date: date("2026-11-10") }];
    C.findOne.mockResolvedValue(cal);
    const out = res();
    await disableWfhDates(req({ date: "2026-11-10" }), out);
    expect(out.statusCode).toBe(200);
    expect(cal.wfhDates).toEqual([]);
  });
  it("prevents holiday conversion from bypassing conflicts", async () => {
    const cal = calendar();
    cal.holidays = { id: () => ({ date: date("2026-11-10"), isActive: true }) };
    C.findOne.mockResolvedValue(cal);
    R.find.mockReturnValue(rows([row()]));
    const out = res();
    await convertHolidayToWorkingDay(req({ workMode: "home" }), out);
    expect(out.statusCode).toBe(409);
    expect(cal.save).not.toHaveBeenCalled();
  });
  it("authorizes HR schedules only for covered employees in the authoritative punch plan", async () => {
    const spy = jest.spyOn(Leave, "find").mockReturnValue(rows([]));
    C.find.mockReturnValue(
      rows([
        {
          wfhDates: [
            {
              date: date("2026-11-10"),
              employeeAccess: "only_these",
              excludedEmployeeIds: ["A"],
            },
          ],
        },
      ]),
    );
    const input = {
      organizationId: "org",
      employeeId: "A",
      attendanceDateKey: "2026-11-10",
      timezone: "Asia/Kolkata",
      rule: { officeHours: { startTime: "09:00", endTime: "17:00" } },
      now: new Date("2026-11-10T05:00:00Z"),
    };
    expect(isWfhOnlyPunchPeriod(await loadAttendanceDayPlan(input))).toBe(true);
    expect(
      isWfhOnlyPunchPeriod(
        await loadAttendanceDayPlan({ ...input, employeeId: "B" }),
      ),
    ).toBe(false);
    spy.mockRestore();
  });
  it.each(["approved", "pending", "rejected", "cancelled"])(
    "uses %s employee requests in the live punch plan without an HR schedule",
    async (status) => {
      const spy = jest.spyOn(Leave, "find").mockReturnValue(rows([]));
      R.find.mockReturnValue(rows([row(status)]));
      const input = {
        organizationId: "org",
        employeeId: "A",
        attendanceDateKey: "2026-11-10",
        timezone: "UTC",
        rule: { officeHours: { startTime: "09:00", endTime: "17:00" } },
        now: new Date("2026-11-10T10:00:00Z"),
      };
      expect(isWfhOnlyPunchPeriod(await loadAttendanceDayPlan(input))).toBe(
        status === "approved",
      );
      expect(
        isWfhOnlyPunchPeriod(
          await loadAttendanceDayPlan({
            ...input,
            attendanceDateKey: "2026-11-13",
          }),
        ),
      ).toBe(false);
      spy.mockRestore();
    },
  );
  it("persists department roster coverage using existing employee IDs", async () => {
    E.countDocuments.mockResolvedValue(2);
    const cal = calendar();
    C.findOne.mockResolvedValue(cal);
    const out = res();
    await enableWfhDates(
      req({ ...schedule, excludedEmployeeIds: ["A", "B"] }),
      out,
    );
    expect(out.statusCode).toBe(200);
    expect(cal.wfhDates[0].excludedEmployeeIds).toEqual(["A", "B"]);
  });
  it.each(["pending", "submitted", "rejected", "cancelled"])(
    "%s never grants WFH punch permission",
    (status) => {
      expect(classifyWfhForDate([row(status)], "2026-11-10", "UTC")).toBe(
        "none",
      );
    },
  );
});
