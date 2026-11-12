import { describe, expect, it, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import reducer, { fetchMyTasks } from "./employeeTaskSlice";
import axios from "../utils/axios";
vi.mock("../utils/axios", () => ({ default: { get: vi.fn() } }));
vi.mock("react-toastify", () => ({ toast: { error: vi.fn() } }));
it("does not replace a refreshed employee daily log with an older empty response", async () => {
  let finishOlder;
  axios.get.mockReturnValueOnce(
    new Promise((resolve) => {
      finishOlder = resolve;
    }),
  );
  axios.get.mockResolvedValueOnce({ data: { tasks: [{ _id: "saved-log" }] } });
  const store = configureStore({ reducer: { employeeTask: reducer } });
  const older = store.dispatch(
    fetchMyTasks({ projectId: "one", scope: "mine" }),
  );
  await store.dispatch(fetchMyTasks({ projectId: "one", scope: "mine" }));
  finishOlder({ data: { tasks: [] } });
  await older;
  expect(store.getState().employeeTask.myTasks).toEqual([{ _id: "saved-log" }]);
});
