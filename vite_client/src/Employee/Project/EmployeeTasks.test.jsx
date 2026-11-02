import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import EmployeeTasks from "./EmployeeTasks";
import reducer from "../../context/employeeTaskSlice";
import axios from "../../utils/axios";
vi.mock("../../utils/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));
vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
const employee = { _id: "member", name: "New member" };
const project = {
  _id: "one",
  name: "HRMS",
  description: "Current project description",
  status: "in-progress",
  category: "Operations",
  priority: "high",
  startDate: "2026-10-01",
  endDate: "2026-12-01",
  progress: 35,
  projectLeader: { _id: "lead", name: "Megha" },
  projectMembers: [employee],
};
let logs;
function mount() {
  const store = configureStore({
    reducer: {
      employeeTask: reducer,
      employeeDetails: () => ({ employee }),
      auth: () => ({ user: employee }),
    },
  });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/employee/projects/one"]}>
        <Routes>
          <Route
            path="/employee/projects/:projectId"
            element={<EmployeeTasks />}
          />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}
const todayLog = () => ({
  _id: "log-one",
  employee,
  project: { _id: "one", name: "HRMS" },
  date: new Date().toISOString(),
  taskDescription: "Payroll testing",
  status: "In Progress",
  comments: "Review in progress",
});
beforeEach(() => {
  vi.clearAllMocks();
  logs = [];
  axios.get.mockImplementation(async (url) => ({
    data: url.includes("get-my-projects")
      ? { projects: [project] }
      : url.includes("work-items")
        ? { workItems: [], progress: { percent: 0 } }
        : { tasks: logs },
  }));
  axios.post.mockImplementation(async (_url, data) => {
    const task = { ...todayLog(), ...data };
    logs = [task];
    return { data: { success: true, task } };
  });
  axios.put.mockImplementation(async (_url, data) => {
    logs = [{ ...logs[0], ...data }];
    return { data: { success: true, task: logs[0] } };
  });
});
describe("assigned employee project workspace", () => {
  it("shows current details and lets a new member log work without work-plan assignments", async () => {
    mount();
    await screen.findByRole("heading", { name: "HRMS" });
    for (const text of [
      "Current project description",
      "Operations",
      "high",
      "New member",
    ])
      expect(screen.getByText(text)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add daily task" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save daily task" }),
      ).not.toBeDisabled(),
    );
    fireEvent.change(screen.getByLabelText(/Task description/), {
      target: { value: "Test new payroll workflow" },
    });
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "Completed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save daily task" }));
    await screen.findByRole("heading", { name: "Test new payroll workflow" });
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining("/create-task"),
      {
        projectId: "one",
        taskDescription: "Test new payroll workflow",
        status: "Completed",
        comments: "",
      },
      { withCredentials: true },
    );
    expect(
      screen.getByText(/appears in Team daily logs for HRMS/),
    ).toBeInTheDocument();
  });
  it("updates today’s existing entry instead of creating a duplicate", async () => {
    logs = [todayLog()];
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "Update daily task" }),
    );
    await screen.findByDisplayValue("Payroll testing");
    await waitFor(() =>
      expect(
        within(screen.getByRole("tabpanel")).getByRole("button", {
          name: "Update daily task",
        }),
      ).not.toBeDisabled(),
    );
    fireEvent.change(screen.getByLabelText(/Task description/), {
      target: { value: "Payroll tests complete" },
    });
    fireEvent.change(screen.getByLabelText(/Comments/), {
      target: { value: "" },
    });
    fireEvent.click(
      within(screen.getByRole("tabpanel")).getByRole("button", {
        name: "Update daily task",
      }),
    );
    await screen.findByRole("heading", { name: "Payroll tests complete" });
    expect(axios.put).toHaveBeenCalledWith(
      expect.stringContaining("/task-status/log-one"),
      expect.objectContaining({
        taskDescription: "Payroll tests complete",
        comments: "",
      }),
      { withCredentials: true },
    );
    expect(axios.post).not.toHaveBeenCalled();
  });
  it("validates empty tasks and preserves the draft on failure", async () => {
    axios.post.mockRejectedValue({
      response: { data: { message: "Please retry" } },
    });
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "Add daily task" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save daily task" }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save daily task" }));
    expect(
      screen.getByText("Describe what you worked on today."),
    ).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Task description/), {
      target: { value: "Keep my draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save daily task" }));
    await screen.findByText("Please retry");
    expect(screen.getByDisplayValue("Keep my draft")).toBeInTheDocument();
  });
  it("waits for existing daily logs before allowing a save", async () => {
    let finishLogs;
    const baseGet = axios.get.getMockImplementation();
    axios.get.mockImplementation((url) =>
      url.includes("/all-tasks")
        ? new Promise((resolve) => {
            finishLogs = resolve;
          })
        : baseGet(url),
    );
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "Add daily task" }),
    );
    expect(
      screen.getByRole("button", { name: "Save daily task" }),
    ).toBeDisabled();
    finishLogs({ data: { tasks: [todayLog()] } });
    await screen.findByDisplayValue("Payroll testing");
    await waitFor(() =>
      expect(
        within(screen.getByRole("tabpanel")).getByRole("button", {
          name: "Update daily task",
        }),
      ).not.toBeDisabled(),
    );
    expect(axios.post).not.toHaveBeenCalled();
  });
  it("keeps work plan available and historical logs read only", async () => {
    logs = [{ ...todayLog(), date: "2020-01-01" }];
    mount();
    await screen.findByRole("heading", { name: "HRMS" });
    fireEvent.click(screen.getByRole("tab", { name: "Work plan" }));
    expect(screen.getByRole("tab", { name: "Work plan" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.click(screen.getByRole("tab", { name: "My daily logs" }));
    await screen.findByText("Payroll testing");
    expect(
      screen.queryByRole("button", { name: "Edit today's entry" }),
    ).not.toBeInTheDocument();
  });
});
