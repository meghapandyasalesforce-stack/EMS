import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import WfhRequestPanel from "./WfhRequestPanel";
import axios from "../../utils/axios";
import { toast } from "react-toastify";
vi.mock("../../utils/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));
vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
let requests = [],
  schedules = [];
const fill = () => {
  fireEvent.change(screen.getByLabelText(/From date/), {
    target: { value: "2026-11-10" },
  });
  fireEvent.change(screen.getByLabelText(/To date/), {
    target: { value: "2026-11-12" },
  });
  fireEvent.change(screen.getByLabelText(/^Reason/), {
    target: { value: "Working remotely" },
  });
};
const ready = () =>
  waitFor(() =>
    expect(screen.queryByText("Loading requests…")).not.toBeInTheDocument(),
  );
const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Submit WFH request" }));
describe("Independent WFH applications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requests = [];
    schedules = [];
    axios.get.mockImplementation(async (url) => ({
      data: url.endsWith("/my") ? { requests } : { wfhDates: schedules },
    }));
    axios.post.mockResolvedValue({ data: { success: true } });
    axios.put.mockResolvedValue({ data: { success: true } });
  });
  it("submits a range without HR-enabled dates", async () => {
    render(<WfhRequestPanel />);
    fill();
    await ready();
    submit();
    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        "/v1/both/wfh-requests",
        expect.objectContaining({
          wfhDateFrom: "2026-11-10",
          wfhDateTo: "2026-11-12",
        }),
        expect.anything(),
      ),
    );
  });
  it("blocks the entire range and displays HR-conflicting dates", async () => {
    schedules = [{ date: "2026-11-11", scheduled: true }];
    render(<WfhRequestPanel />);
    fill();
    await ready();
    submit();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("2026-11-11"),
      ),
    );
    expect(axios.post).not.toHaveBeenCalled();
  });
  it("allows employees excluded from HR coverage to apply", async () => {
    schedules = [{ date: "2026-11-11", scheduled: false, excluded: true }];
    render(<WfhRequestPanel />);
    fill();
    await ready();
    submit();
    await waitFor(() => expect(axios.post).toHaveBeenCalled());
  });
  it.each(["pending", "approved"])(
    "blocks duplicate %s dates",
    async (status) => {
      requests = [{ _id: "r1", wfhDate: "2026-11-11", status }];
      render(<WfhRequestPanel />);
      fill();
      await ready();
      submit();
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("2026-11-11"),
        ),
      );
      expect(axios.post).not.toHaveBeenCalled();
    },
  );
  it.each(["rejected", "cancelled"])(
    "allows reapplication after %s",
    async (status) => {
      requests = [{ _id: "r1", wfhDate: "2026-11-11", status }];
      render(<WfhRequestPanel />);
      fill();
      await ready();
      submit();
      await waitFor(() => expect(axios.post).toHaveBeenCalled());
    },
  );
  it("cancels an approved request from the list", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    requests = [{ _id: "r1", wfhDate: "2026-11-11", status: "approved" }];
    render(<WfhRequestPanel />);
    await ready();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Cancel request" })[0],
    );
    await waitFor(() =>
      expect(axios.put).toHaveBeenCalledWith(
        "/v1/both/wfh-requests/r1/cancel",
        {},
        expect.anything(),
      ),
    );
    vi.restoreAllMocks();
  });
});
