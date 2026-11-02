import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { getOrganizationId } from "./organizationHelper.js";
import logger from "./logger.js";

const LEASE_MS = 90_000;

/** Serialize WFH request and HR calendar writes across all app workers.
 * Uses a small coordination collection, not another WFH business model.
 * MongoDB's unique _id provides exclusion; expired leases recover after crashes.
 */
export function withWfhWriteLock(handler) {
  return async (req, res) => {
    const organizationId = getOrganizationId(req);
    if (!organizationId) return handler(req, res);
    let locks;
    const _id = String(organizationId);
    const owner = randomUUID();
    let acquired = false;
    let heartbeat;
    try {
      locks = mongoose.connection.collection("wfh_write_locks");
      await locks.deleteOne({ _id, expiresAt: { $lte: new Date() } });
      try {
        await locks.insertOne({
          _id,
          owner,
          expiresAt: new Date(Date.now() + LEASE_MS),
        });
        acquired = true;
      } catch (error) {
        if (error.code !== 11000) throw error;
        return res
          .status(409)
          .json({
            success: false,
            code: "WFH_UPDATE_IN_PROGRESS",
            message:
              "Another WFH update is in progress. Please retry after refreshing.",
          });
      }
      heartbeat = setInterval(() => {
        locks
          .updateOne(
            { _id, owner },
            { $set: { expiresAt: new Date(Date.now() + LEASE_MS) } },
          )
          .catch((error) => {
            logger.warn("WFH write lease renewal failed", {
              error: error.message,
            });
          });
      }, LEASE_MS / 3);
      heartbeat.unref?.();
      req.assertWfhWriteLock = async () => {
        const result = await locks.updateOne(
          { _id, owner, expiresAt: { $gt: new Date() } },
          { $set: { expiresAt: new Date(Date.now() + LEASE_MS) } },
        );
        if (!result.matchedCount) {
          const error = new Error(
            "WFH data changed while processing. Refresh and retry.",
          );
          error.code = "WFH_WRITE_LOCK_LOST";
          throw error;
        }
      };
      return await handler(req, res);
    } catch (error) {
      logger.error("WFH mutation coordination failed", {
        error: error.message,
      });
      if (!res.headersSent && error.code === "WFH_WRITE_LOCK_LOST")
        return res
          .status(409)
          .json({ success: false, code: error.code, message: error.message });
      if (!res.headersSent)
        return res
          .status(503)
          .json({
            success: false,
            message: "WFH updates are temporarily unavailable. Please retry.",
          });
    } finally {
      clearInterval(heartbeat);
      if (acquired)
        await locks
          .deleteOne({ _id, owner })
          .catch((error) =>
            logger.warn("WFH write lease release failed", {
              error: error.message,
            }),
          );
    }
  };
}
