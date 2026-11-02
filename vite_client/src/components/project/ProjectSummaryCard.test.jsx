import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProjectSummaryCard, {
  projectStatus,
  projectIsOverdue,
} from "./ProjectSummaryCard";
const project = {
  _id: "one",
  name: "Customer portal",
  description: "A faster customer experience.",
  status: "in-progress",
  priority: "medium",
  progress: 65,
  totalTasks: 20,
  completedTasks: 13,
  projectLeader: { name: "Megha" },
  projectMembers: [
    { _id: "a", name: "Alex" },
    { _id: "b", name: "Sam" },
  ],
  budget: 455,
  currency: "INR",
  endDate: "2099-11-10",
};
describe("Shared project cards", () => {
  it("shows actual progress, tasks and project information and navigates", () => {
    const open = vi.fn();
    render(<ProjectSummaryCard project={project} onOpen={open} />);
    expect(screen.getByText("13 of 20 tasks done")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "65",
    );
    fireEvent.click(screen.getByRole("button", { name: "View project" }));
    expect(open).toHaveBeenCalledOnce();
  });
  it("keeps financial information hidden unless explicitly permitted", () => {
    const { rerender } = render(<ProjectSummaryCard project={project} />);
    expect(screen.queryByText(/455/)).not.toBeInTheDocument();
    rerender(<ProjectSummaryCard project={project} showFinancials />);
    expect(screen.getByText(/455 budget/)).toBeInTheDocument();
  });
  it("preserves project action handling without navigating", () => {
    const open = vi.fn(),
      actions = vi.fn();
    render(
      <ProjectSummaryCard
        project={project}
        onOpen={open}
        onActions={actions}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Actions for Customer portal" }),
    );
    expect(actions).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
  });
  it("shows zero progress and real work-plan task totals", () => {
    render(
      <ProjectSummaryCard
        project={{
          ...project,
          progress: 0,
          workPlanTotal: 5,
          workPlanCompleted: 0,
        }}
      />,
    );
    expect(screen.getByText("0 of 5 tasks done")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
  });
  it("labels pending and cancelled accurately and does not mark completed projects overdue", () => {
    expect(projectStatus("pending")).toBe("Pending");
    expect(projectStatus("cancelled")).toBe("Cancelled");
    expect(
      projectIsOverdue({
        ...project,
        endDate: "2020-01-01",
        status: "completed",
      }),
    ).toBe(false);
  });
});
