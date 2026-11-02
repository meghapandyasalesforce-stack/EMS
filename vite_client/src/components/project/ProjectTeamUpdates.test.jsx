import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import ProjectTeamUpdates from "./ProjectTeamUpdates";
import axios from "../../utils/axios";
vi.mock("../../utils/axios", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));
let updates;
const project = { _id: "one", name: "HRMS", status: "in-progress" };
beforeEach(() => {
  vi.clearAllMocks();
  updates = [];
  axios.get.mockImplementation(async (url) => ({
    data: url.endsWith("updates")
      ? { success: true, updates, pagination: { pages: 1 } }
      : {
          success: true,
          tasks: [
            {
              _id: "task",
              taskDescription: "Payroll work",
              employee: { name: "Alex" },
              status: "Completed",
              date: "2026-11-02",
            },
          ],
        },
  }));
  axios.post.mockImplementation(async (_url, data) => {
    updates = [
      {
        ...data,
        _id: "posted",
        postedBy: { name: "New team member" },
        createdAt: "2026-11-02T12:00:00Z",
      },
    ];
    return { data: { success: true } };
  });
});
it("lets an employee post a team update and reads updates and task entries for the whole project", async () => {
  render(<ProjectTeamUpdates project={project} />);
  await screen.findByText("Payroll work");
  expect(screen.getByText(/Alex/)).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Post Update", exact: true }),
  );
  fireEvent.change(screen.getByLabelText(/Update \*/), {
    target: { value: "New member finished payroll review" },
  });
  fireEvent.change(screen.getByLabelText("Blockers / Challenges"), {
    target: { value: "Waiting for approval" },
  });
  fireEvent.click(
    within(
      screen.getByRole("button", { name: "Cancel" }).closest("form"),
    ).getByRole("button", { name: "Post Update", exact: true }),
  );
  await screen.findByText("New member finished payroll review");
  expect(screen.getByText("New team member")).toBeInTheDocument();
  expect(axios.post).toHaveBeenCalledWith(
    expect.stringMatching(/projects\/one\/updates$/),
    expect.objectContaining({
      update: "New member finished payroll review",
      blockers: "Waiting for approval",
    }),
    { withCredentials: true },
  );
});
it("keeps the draft and shows a failed post without claiming success", async () => {
  axios.post.mockRejectedValue({
    response: { data: { error: "Access changed" } },
  });
  render(<ProjectTeamUpdates project={project} showComposer />);
  fireEvent.change(screen.getByLabelText(/Update \*/), {
    target: { value: "Keep my draft" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Cancel" }).closest("form"),
  );
  await screen.findByText("Access changed");
  expect(screen.getByDisplayValue("Keep my draft")).toBeInTheDocument();
  expect(
    screen.queryByText(/Your update has been posted/),
  ).not.toBeInTheDocument();
});
