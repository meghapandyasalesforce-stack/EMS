import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import mongoose from "mongoose";
import { withWfhWriteLock } from "../../helpers/wfhWriteLock.js";
let stored;
let collection;
const response = () => ({
  headersSent: false,
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
const req = (org) => ({ organizationId: org });
describe("WFH distributed write coordination", () => {
  beforeEach(() => {
    stored = new Map();
    collection = {
      deleteOne: jest.fn(async (q) => {
        const lock = stored.get(q._id);
        if (
          lock &&
          (!q.owner || q.owner === lock.owner) &&
          (!q.expiresAt || lock.expiresAt <= q.expiresAt.$lte)
        ) {
          stored.delete(q._id);
          return { deletedCount: 1 };
        }
        return { deletedCount: 0 };
      }),
      insertOne: jest.fn(async (lock) => {
        if (stored.has(lock._id)) {
          const error = new Error("duplicate");
          error.code = 11000;
          throw error;
        }
        stored.set(lock._id, lock);
      }),
      updateOne: jest.fn(async (q, update) => {
        const lock = stored.get(q._id);
        if (
          !lock ||
          lock.owner !== q.owner ||
          (q.expiresAt && lock.expiresAt <= q.expiresAt.$gt)
        )
          return { matchedCount: 0 };
        Object.assign(lock, update.$set);
        return { matchedCount: 1 };
      }),
    };
    jest.spyOn(mongoose.connection, "collection").mockReturnValue(collection);
  });
  afterEach(() => jest.restoreAllMocks());
  it("prevents concurrent employee/calendar writes for the same tenant", async () => {
    let release, entered;
    const started = new Promise((r) => (entered = r));
    const held = new Promise((r) => (release = r));
    const handler = jest.fn(async (r) => {
      await r.assertWfhWriteLock();
      entered();
      await held;
    });
    const guarded = withWfhWriteLock(handler);
    const first = guarded(req("org"), response());
    await started;
    const second = response();
    await guarded(req("org"), second);
    expect(second.statusCode).toBe(409);
    expect(second.body.code).toBe("WFH_UPDATE_IN_PROGRESS");
    expect(handler).toHaveBeenCalledTimes(1);
    release();
    await first;
    expect(stored.size).toBe(0);
    await withWfhWriteLock(async () => {})(req("org"), response());
    expect(stored.size).toBe(0);
  });
  it("allows unrelated tenants to write independently", async () => {
    stored.set("other", {
      _id: "other",
      owner: "different",
      expiresAt: new Date(Date.now() + 90000),
    });
    const handler = jest.fn(async (r) => r.assertWfhWriteLock());
    await withWfhWriteLock(handler)(req("org"), response());
    expect(handler).toHaveBeenCalled();
    expect(stored.has("other")).toBe(true);
  });
  it("recovers expired leases after a crashed worker", async () => {
    stored.set("org", {
      _id: "org",
      owner: "old",
      expiresAt: new Date(Date.now() - 1000),
    });
    const handler = jest.fn(async (r) => r.assertWfhWriteLock());
    await withWfhWriteLock(handler)(req("org"), response());
    expect(handler).toHaveBeenCalled();
    expect(stored.size).toBe(0);
  });
  it("refuses to write after losing ownership and preserves the new owner’s lease", async () => {
    const out = response();
    await withWfhWriteLock(async (r) => {
      stored.set("org", {
        _id: "org",
        owner: "new-owner",
        expiresAt: new Date(Date.now() + 90000),
      });
      await r.assertWfhWriteLock();
    })(req("org"), out);
    expect(out.statusCode).toBe(409);
    expect(stored.get("org").owner).toBe("new-owner");
  });
  it("fails closed on database coordination errors", async () => {
    collection.insertOne.mockRejectedValue(new Error("database unavailable"));
    const handler = jest.fn();
    const out = response();
    await withWfhWriteLock(handler)(req("org"), out);
    expect(handler).not.toHaveBeenCalled();
    expect(out.statusCode).toBe(503);
  });
});
