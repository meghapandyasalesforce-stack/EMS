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
import ProjectDetailPage from "./ProjectDetailPage";
import projectReducer from "../../context/projectSlice";
import axios from "../../utils/axios";
import { toast } from "react-toastify";
const hook = vi.hoisted(() => ({ loading: false, error: null }));
vi.mock("../../Hooks/useGetAllProjects", () => ({ default: () => hook }));
vi.mock("../../context/employeeSlice", () => ({
  fetchEmployees: () => ({ type: "test/roster" }),
}));
vi.mock("../../utils/axios", () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
const person = { _id: "lead", name: "Megha", status: "active", role: "admin" };
const fixture = {
  _id: "one",
  name: "HRMS",
  status: "in-progress",
  projectLeader: person,
  projectMembers: [person],
  startDate: "2026-10-01",
  createdAt: "2026-09-01",
  currency: "INR",
  budget: 455,
};
let items, updates, logs;
const item = () => ({
  _id: "task-one",
  title: "Architecture task",
  status: "todo",
  priority: "medium",
  assignees: [],
  dueDate: "2026-11-10",
  dueDateHistory: [],
  comments: [],
  subtasks: [],
});
function mount({ project = fixture, flags = {}, user = person } = {}) {
  const store = configureStore({
    reducer: {
      project: projectReducer,
      auth: () => ({ user, permissionFlags: flags }),
      employeeDetails: () => ({ employee: user }),
      employees: () => ({ employees: [person], status: "succeeded" }),
    },
    preloadedState: {
      project: {
        allProjects: project ? [project] : [],
        projectTasks: [],
        status: "idle",
        error: null,
      },
    },
  });
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/projects/one"]}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
  return store;
}
const tab = async (name) => {
  fireEvent.click(screen.getByRole("tab", { name, exact: true }));
  await waitFor(() =>
    expect(screen.getByRole("tab", { name, exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    ),
  );
};
describe("Four project detail tabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hook.loading = false;
    hook.error = null;
    items = [item()];
    updates = [
      {
        _id: "update-one",
        postedBy: person,
        update: "Integration completed",
        updateDate: "2026-11-02",
        createdAt: "2026-11-02T10:00:00Z",
        status: "in-progress",
        progress: 80,
        blockers: "Review pending",
        nextSteps: "Run the final checks",
      },
    ];
    logs = [
      {
        _id: "log-one",
        taskDescription: "Implemented payroll tests",
        employee: { name: "Alex" },
        date: "2026-11-02",
        status: "Completed",
        comments: "Reviewed by lead",
      },
    ];
    axios.get.mockImplementation(async (url) => ({
      data: url.includes("/work-items")
        ? { success: true, workItems: items }
        : url.includes("/updates")
          ? { success: true, updates, pagination: { pages: 1 } }
          : { success: true, tasks: logs },
    }));
    axios.post.mockImplementation(async (url, data) => {
      if (url.endsWith("/work-items")) {
        const row = { ...item(), _id: "new-task", title: data.items[0].title };
        if (data.items[0].parentTask) items[0].subtasks.push(row);
        else items.push(row);
      }
      if (url.endsWith("/updates"))
        updates = [{ ...updates[0], ...data, _id: "posted" }, ...updates];
      return { data: { success: true } };
    });
    axios.put.mockResolvedValue({ data: { success: true } });
    axios.delete.mockImplementation(async () => {
      items = [];
      return { data: { success: true } };
    });
  });
  it("shows the configured start date rather than the creation date", async () => {
    mount();
    expect(screen.getByRole("heading", { name: "HRMS" })).toBeInTheDocument();
    const label = screen.getByText("Start Date");
    expect(label.parentElement).toHaveTextContent(
      new Date(fixture.startDate).toLocaleDateString(),
    );
    expect(label.parentElement).not.toHaveTextContent(
      new Date(fixture.createdAt).toLocaleDateString(),
    );
    await waitFor(() => expect(axios.get).toHaveBeenCalled());
  });
  it("shows loading instead of a false not-found result on a deep link", () => {
    hook.loading = true;
    mount({ project: null });
    expect(screen.getByLabelText("Loading project")).toBeInTheDocument();
    expect(screen.queryByText("Project not found")).not.toBeInTheDocument();
  });
  it("reports project load failures", () => {
    hook.error = "Unable to load projects";
    mount({ project: null });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to load projects",
    );
  });
  it("prevents saving an empty project name", async () => {
    mount();
    fireEvent.click(
      screen.getByRole("button", { name: "Edit Project", exact: true }),
    );
    fireEvent.change(screen.getByLabelText(/Project Name/), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save", exact: true }));
    expect(toast.error).toHaveBeenCalledWith(
      "Project name and project leader are required",
    );
    expect(axios.put).not.toHaveBeenCalled();
    await waitFor(() => expect(axios.get).toHaveBeenCalled());
  });
  it("loads the work plan and adds a task, then refreshes it", async () => {
    mount();
    await tab("Work plan");
    await screen.findByText("Architecture task");
    fireEvent.change(screen.getByLabelText("New task title"), {
      target: { value: "Integration task" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Add task", exact: true }),
    );
    await screen.findByText("Integration task");
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringMatching(/\/one\/work-items$/),
      { items: [{ title: "Integration task" }] },
      expect.anything(),
    );
  });
  it("adds a subtask under the chosen parent", async () => {
    mount();
    await tab("Work plan");
    await screen.findByText("Architecture task");
    fireEvent.click(
      screen.getByRole("button", { name: "Add subtask", exact: true }),
    );
    fireEvent.change(screen.getByLabelText("Subtask title"), {
      target: { value: "Child task" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save subtask", exact: true }),
    );
    await screen.findByText("Child task");
    expect(axios.post).toHaveBeenCalledWith(
      expect.any(String),
      { items: [{ title: "Child task", parentTask: "task-one" }] },
      expect.anything(),
    );
  });
  it("requires a due-date change reason and submits it with the edit", async () => {
    mount();
    await tab("Work plan");
    await screen.findByText("Architecture task");
    fireEvent.click(screen.getByRole("button", { name: "Edit", exact: true }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Due date"), {
      target: { value: "2026-11-12" },
    });
    expect(
      within(dialog).getByRole("button", { name: "Save", exact: true }),
    ).toBeDisabled();
    fireEvent.change(
      within(dialog).getByLabelText(/Reason for due date change/),
      { target: { value: "Review was moved" } },
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save", exact: true }),
    );
    await waitFor(() =>
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringMatching(/work-items\/task-one$/),
        expect.objectContaining({
          dueDate: "2026-11-12",
          dueDateChangeReason: "Review was moved",
        }),
        expect.anything(),
      ),
    );
  });
  it("posts comments for authorized project members", async () => {
    mount();
    await tab("Work plan");
    await screen.findByText("Architecture task");
    fireEvent.change(
      screen.getByPlaceholderText("Write a comment for the project team..."),
      { target: { value: "Reviewed this task" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }));
    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringMatching(/task-one\/comments$/),
        { text: "Reviewed this task" },
        expect.anything(),
      ),
    );
  });
  it("allows HR managers to comment consistently with the API", async () => {
    mount({
      user: { _id: "hr", name: "HR", role: "hr" },
      flags: { isHrManager: true },
    });
    await tab("Work plan");
    await screen.findByText("Architecture task");
    expect(
      screen.getByPlaceholderText("Write a comment for the project team..."),
    ).toBeInTheDocument();
  });
  it("deletes a task after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mount();
    await tab("Work plan");
    await screen.findByText("Architecture task");
    fireEvent.click(
      screen.getByRole("button", { name: "Delete", exact: true }),
    );
    await waitFor(() =>
      expect(axios.delete).toHaveBeenCalledWith(
        expect.stringMatching(/work-items\/task-one$/),
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByText("Architecture task")).not.toBeInTheDocument(),
    );
    vi.restoreAllMocks();
  });
  it("reports work-plan errors instead of an empty result", async () => {
    axios.get.mockImplementation(async (url) => {
      if (url.includes("/work-items"))
        throw { response: { data: { error: "Work plan unavailable" } } };
      return { data: { success: true, updates: [], tasks: [] } };
    });
    mount();
    await tab("Work plan");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Work plan unavailable",
    );
  });
  it("loads team daily logs with employee, date, status and comments", async () => {
    mount();
    await tab("Team daily logs");
    await screen.findByText("Implemented payroll tests");
    expect(screen.getByText(/Alex/)).toBeInTheDocument();
    expect(screen.getByText("Reviewed by lead")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/admin\/projects\/one\/tasks\?/),
    );
  });
  it("shows team log failures", async () => {
    axios.get.mockImplementation(async (url) => {
      if (url.includes("/tasks?"))
        throw { response: { data: { error: "Logs unavailable" } } };
      return { data: { success: true, workItems: [], updates: [] } };
    });
    mount();
    await tab("Team daily logs");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Logs unavailable",
    );
  });
  it("loads every page of daily updates with progress, blockers and next steps", async () => {
    const defaultGet = axios.get.getMockImplementation();
    axios.get.mockImplementation(async (url, config) => {
      if (!url.endsWith("/updates")) return defaultGet(url, config);
      return {
        data: {
          success: true,
          updates:
            config.params.page === 1
              ? updates
              : [
                  {
                    ...updates[0],
                    _id: "older",
                    update: "Older update on the second page",
                  },
                ],
          pagination: { pages: 2 },
        },
      };
    });
    mount();
    await tab("Daily Updates");
    await screen.findByText("Older update on the second page");
    expect(screen.getAllByText("Review pending").length).toBeGreaterThan(0);
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/updates$/),
      expect.objectContaining({ params: { page: 2, limit: 100 } }),
    );
  });
  it("posts a daily update and refreshes the feed", async () => {
    mount();
    await tab("Daily Updates");
    await screen.findByText("Integration completed");
    fireEvent.click(
      screen.getByRole("button", { name: "Post Update", exact: true }),
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Update \*/), {
      target: { value: "New daily report" },
    });
    fireEvent.change(within(dialog).getByLabelText("Blockers / Challenges"), {
      target: { value: "No blockers" },
    });
    fireEvent.change(within(dialog).getByLabelText("Next Steps"), {
      target: { value: "Deploy the changes" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Post Update", exact: true }),
    );
    await screen.findByText("New daily report");
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringMatching(/\/updates$/),
      expect.objectContaining({
        update: "New daily report",
        blockers: "No blockers",
        nextSteps: "Deploy the changes",
      }),
      expect.anything(),
    );
  });
  it("shows daily update fetch failures without claiming the feed is empty", async () => {
    axios.get.mockImplementation(async (url) => {
      if (url.endsWith("/updates"))
        throw { response: { data: { error: "Daily updates unavailable" } } };
      return { data: { success: true, workItems: [], tasks: [] } };
    });
    mount();
    await tab("Daily Updates");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Daily updates unavailable",
    );
    expect(
      screen.queryByText("No daily updates posted yet."),
    ).not.toBeInTheDocument();
  });
  it("opens the actual project edit form from any tab", async () => {
    mount();
    await tab("Daily Updates");
    await screen.findByText("Integration completed");
    fireEvent.click(
      screen.getByRole("button", { name: "Edit Project", exact: true }),
    );
    expect(
      screen.getByRole("tab", { name: "Project Details", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText(/Project Name/)).toHaveValue("HRMS");
  });
  it("selects project status through a labelled dropdown and reports API rejections", async () => {
    axios.put.mockResolvedValue({
      data: { success: false, error: "Status update rejected" },
    });
    mount();
    fireEvent.click(
      screen.getByRole("button", { name: "Update Status", exact: true }),
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.mouseDown(
      within(dialog).getByRole("combobox", { name: "New Status" }),
    );
    fireEvent.click(
      await screen.findByRole("option", { name: "Completed", exact: true }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Update", exact: true }),
    );
    await waitFor(() =>
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringMatching(/one\/update-status$/),
        { status: "completed" },
        expect.anything(),
      ),
    );
    expect(toast.error).toHaveBeenCalledWith("Status update rejected");
  });
  it("keeps Add task available and explains an empty title without sending a request", async () => {
    mount();
    await tab("Work plan");
    await screen.findByText("Architecture task");
    const button = screen.getByRole("button", {
      name: "Add task",
      exact: true,
    });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a task title to continue.",
    );
    expect(screen.getByLabelText("New task title")).toHaveFocus();
    expect(axios.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("New task title"), {
      target: { value: "Review scope" },
    });
    expect(
      screen.queryByText("Enter a task title to continue."),
    ).not.toBeInTheDocument();
  });
  it("prevents duplicate task creation while saving and restores the composer afterwards", async () => {
    let finish;
    axios.post.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    mount();
    await tab("Work plan");
    await screen.findByText("Architecture task");
    const input = screen.getByLabelText("New task title");
    fireEvent.change(input, { target: { value: "One task" } });
    fireEvent.submit(input.closest("form"));
    expect(screen.getByRole("button", { name: "Adding…" })).toBeDisabled();
    fireEvent.submit(input.closest("form"));
    expect(axios.post).toHaveBeenCalledTimes(1);
    finish({ data: { success: true } });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Add task", exact: true }),
      ).toBeEnabled(),
    );
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });
  it("keeps the title and allows a retry when creating a task fails", async () => {
    axios.post.mockRejectedValueOnce({
      response: { data: { error: "Task could not be saved" } },
    });
    mount();
    await tab("Work plan");
    await screen.findByText("Architecture task");
    const input = screen.getByLabelText("New task title");
    fireEvent.change(input, { target: { value: "Retry this task" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Add task", exact: true }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Task could not be saved",
    );
    expect(input).toHaveValue("Retry this task");
    expect(
      screen.getByRole("button", { name: "Add task", exact: true }),
    ).toBeEnabled();
  });
});
