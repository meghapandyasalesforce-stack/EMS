import { beforeEach, describe, expect, it, jest } from "@jest/globals";
const calendarFind = jest.fn();
const requestFind = jest.fn();
jest.unstable_mockModule("../../models/calendar.model.js", () => ({
  default: { find: calendarFind },
}));
jest.unstable_mockModule("../../models/wfhRequest.model.js", () => ({
  default: { find: requestFind },
}));
const {
  expandDateRange,
  parseLocalDate,
  toDateKey,
  validateEmployeeWfhEligibility,
  isEmployeeCoveredByWfhEntry,
  findWfhRequestConflicts,
  validateWfhScheduleConflicts,
} = await import("../../helpers/wfhCalendarHelper.js");
const chain = (rows) => ({ select: () => ({ lean: async () => rows }) });
const input = {
  organizationId: "org1",
  employeeId: "A",
  fromDate: "2026-11-10",
  toDate: "2026-11-12",
};
const entry = (date, ids = ["A"], employeeAccess = "only_these") => ({
  date: parseLocalDate(date),
  employeeAccess,
  excludedEmployeeIds: ids,
});
describe("WFH independent applications and HR coverage", () => {
  beforeEach(() => {
    calendarFind.mockReset().mockReturnValue(chain([]));
    requestFind.mockReset().mockReturnValue(chain([]));
  });
  it("parses civil dates and rejects impossible dates", () => {
    expect(toDateKey(parseLocalDate("2026-11-10"))).toBe("2026-11-10");
    for (const value of ["2026-02-30", "2026-13-01", "invalid", "", null])
      expect(parseLocalDate(value)).toBeNull();
    expect(expandDateRange("2026-11-12", "2026-11-10")).toEqual([]);
    expect(expandDateRange("1900-01-01", "9999-01-01")).toEqual([]);
  });
  it("allows employees to apply without an HR calendar", async () => {
    expect(await validateEmployeeWfhEligibility(input)).toEqual({ ok: true });
  });
  it.each([
    ["2026-11-08", "2026-11-09", []],
    ["2026-11-10", "2026-11-10", ["2026-11-10"]],
    ["2026-11-11", "2026-11-12", ["2026-11-11", "2026-11-12"]],
    ["2026-11-13", "2026-11-15", []],
    ["2026-11-08", "2026-11-15", ["2026-11-10", "2026-11-11", "2026-11-12"]],
    ["2026-11-12", "2026-11-14", ["2026-11-12"]],
  ])(
    "checks complete range %s through %s and returns every conflict",
    async (fromDate, toDate, dates) => {
      calendarFind.mockReturnValue(
        chain([
          {
            wfhDates: ["2026-11-10", "2026-11-11", "2026-11-12"].map((d) =>
              entry(d),
            ),
          },
        ]),
      );
      const result = await validateEmployeeWfhEligibility({
        ...input,
        fromDate,
        toDate,
      });
      expect(result.ok).toBe(!dates.length);
      if (dates.length) {
        expect(result.code).toBe("WFH_HR_SCHEDULE_CONFLICT");
        expect(result.details.dates).toEqual(dates);
      }
    },
  );
  it("restricts only covered employees and releases them when coverage changes or is removed", async () => {
    calendarFind.mockReturnValue(chain([{ wfhDates: [entry("2026-11-10")] }]));
    expect((await validateEmployeeWfhEligibility(input)).ok).toBe(false);
    expect(
      (await validateEmployeeWfhEligibility({ ...input, employeeId: "B" })).ok,
    ).toBe(true);
    calendarFind.mockReturnValue(
      chain([{ wfhDates: [entry("2026-11-10", ["B"])] }]),
    );
    expect((await validateEmployeeWfhEligibility(input)).ok).toBe(true);
    calendarFind.mockReturnValue(chain([]));
    expect((await validateEmployeeWfhEligibility(input)).ok).toBe(true);
  });
  it("supports selected department roster IDs and everyone except exclusions", () => {
    expect(
      isEmployeeCoveredByWfhEntry(entry("2026-11-10", ["A", "B"]), "B"),
    ).toBe(true);
    expect(
      isEmployeeCoveredByWfhEntry(entry("2026-11-10", ["A", "B"]), "C"),
    ).toBe(false);
    expect(
      isEmployeeCoveredByWfhEntry(entry("2026-11-10", [], "all_except"), "C"),
    ).toBe(true);
    expect(
      isEmployeeCoveredByWfhEntry(
        entry("2026-11-10", ["A"], "all_except"),
        "A",
      ),
    ).toBe(false);
  });
  it("loads every calendar year for a cross-year application", async () => {
    await validateEmployeeWfhEligibility({
      ...input,
      fromDate: "2026-12-31",
      toDate: "2028-01-01",
    });
    expect(calendarFind.mock.calls[0][0]).toEqual({
      organizationId: "org1",
      year: { $in: [2026, 2027, 2028] },
    });
  });
  it("finds duplicate requests and preserves active-status, tenant and employee scope", async () => {
    requestFind.mockReturnValue(
      chain([
        {
          _id: "r1",
          employeeId: "A",
          status: "pending",
          wfhDate: parseLocalDate("2026-11-09"),
          wfhDateTo: parseLocalDate("2026-11-11"),
        },
      ]),
    );
    const conflicts = await findWfhRequestConflicts(input);
    expect(conflicts[0].dates).toEqual(["2026-11-10", "2026-11-11"]);
    expect(requestFind.mock.calls[0][0]).toMatchObject({
      organizationId: "org1",
      employeeId: "A",
      status: { $in: ["pending", "submitted", "approved"] },
    });
  });
  it.each(["pending", "approved"])(
    "detects %s request conflicts only for covered employees when HR schedules",
    async (status) => {
      requestFind.mockReturnValue(
        chain([
          {
            _id: "r1",
            employeeId: "A",
            status,
            wfhDate: parseLocalDate("2026-11-10"),
          },
        ]),
      );
      const days = expandDateRange(input.fromDate, input.toDate);
      expect(
        await validateWfhScheduleConflicts({
          organizationId: "org1",
          days,
          entry: entry("2026-11-10", ["B"]),
        }),
      ).toEqual([]);
      expect(
        (
          await validateWfhScheduleConflicts({
            organizationId: "org1",
            days,
            entry: entry("2026-11-10"),
          })
        )[0].dates,
      ).toEqual(["2026-11-10"]);
      expect(
        await validateWfhScheduleConflicts({
          organizationId: "org1",
          days: expandDateRange("2026-11-11", "2026-11-11"),
          entry: entry("2026-11-11"),
        }),
      ).toEqual([]);
    },
  );
});
