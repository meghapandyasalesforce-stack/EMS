import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import CalendarManagement from "./CalendarManagement";
import axios from "../../utils/axios";
import { toast } from "react-toastify";
vi.mock("../../utils/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  ToastContainer: () => null,
}));
const person = { _id: "A", name: "Employee A", department: "Engineering" };
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
let wfhDates = [];
const open = async () => {
  fireEvent.click(
    await screen.findByRole("button", { name: "WFH", exact: true }),
  );
  return screen.getByRole("dialog");
};
describe("HR WFH calendar coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wfhDates = [];
    axios.get.mockImplementation(async (url) => ({
      data: url.includes("/organization/profile")
        ? { organization: { orgDepartments: ["Engineering"] } }
        : url.endsWith("/employee")
          ? { data: [person], pagination: { totalPages: 1 } }
          : {
              year: new Date().getFullYear(),
              holidays: [],
              wfhDates,
              workingDays: {
                monday: true,
                tuesday: true,
                wednesday: true,
                thursday: true,
                friday: true,
              },
            },
    }));
    axios.post.mockResolvedValue({ data: { wfhDates: [] } });
    axios.delete.mockResolvedValue({ data: { wfhDates: [] } });
  });
  it("creates an everyone-wide HR schedule with the existing calendar endpoint", async () => {
    render(<CalendarManagement />);
    const dialog = await open();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Schedule WFH", exact: true }),
    );
    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringMatching(/\/calendar\/\d+\/wfh$/),
        expect.objectContaining({
          employeeAccess: "all_except",
          excludedEmployeeIds: [],
          dateFrom: today(),
          dateTo: today(),
        }),
      ),
    );
  });
  it("requires employee selection for targeted schedules", async () => {
    render(<CalendarManagement />);
    const dialog = await open();
    fireEvent.change(
      within(dialog).getByRole("combobox", { name: "WFH employee coverage" }),
      { target: { value: "only_these" } },
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Schedule WFH", exact: true }),
    );
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Select at least one"),
    );
    expect(axios.post).not.toHaveBeenCalled();
  });
  it("uses the existing department roster picker for targeted assignments", async () => {
    render(<CalendarManagement />);
    const dialog = await open();
    fireEvent.change(
      within(dialog).getByRole("combobox", { name: "WFH employee coverage" }),
      { target: { value: "only_these" } },
    );
    const department = (
      await within(dialog).findByRole("option", { name: "Engineering" })
    ).parentElement;
    fireEvent.change(department, { target: { value: "Engineering" } });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Add department" }),
    );
    await within(dialog).findByText("Employee A");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Schedule WFH", exact: true }),
    );
    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          employeeAccess: "only_these",
          excludedEmployeeIds: ["A"],
        }),
      ),
    );
  });
  it("preserves targeted coverage and explicitly identifies the schedule being edited", async () => {
    wfhDates = [
      {
        date: today(),
        employeeAccess: "only_these",
        excludedEmployeeIds: [person],
      },
    ];
    render(<CalendarManagement />);
    const dialog = await open();
    expect(
      within(dialog).getByRole("combobox", { name: "WFH employee coverage" }),
    ).toHaveValue("only_these");
    expect(within(dialog).getByText("Employee A")).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes", exact: true }),
    );
    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          employeeAccess: "only_these",
          excludedEmployeeIds: ["A"],
          replaceDates: [today()],
          updateExisting: true,
        }),
      ),
    );
  });
  it("keeps the original dates when moving a schedule", async () => {
    wfhDates = [
      {
        date: today(),
        employeeAccess: "only_these",
        excludedEmployeeIds: [person],
      },
    ];
    render(<CalendarManagement />);
    const dialog = await open();
    const next = new Date();
    next.setDate(next.getDate() + 1);
    const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
    fireEvent.change(dialog.querySelector('input[type="date"]'), {
      target: { value: nextKey },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes", exact: true }),
    );
    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          dateFrom: nextKey,
          dateTo: nextKey,
          replaceDates: [today()],
          updateExisting: true,
        }),
      ),
    );
  });
  it("removes the selected HR schedule through the existing delete API", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    wfhDates = [
      {
        date: today(),
        employeeAccess: "only_these",
        excludedEmployeeIds: [person],
      },
    ];
    render(<CalendarManagement />);
    const dialog = await open();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Disable WFH", exact: true }),
    );
    await waitFor(() =>
      expect(axios.delete).toHaveBeenCalledWith(
        expect.stringMatching(/\/calendar\/\d+\/wfh$/),
        { data: { dates: [today()] } },
      ),
    );
    vi.restoreAllMocks();
  });
});
