/**
 * Health Check Routes
 * Provides endpoints for monitoring application health
 */

import express from 'express';
import mongoose from 'mongoose';
import logger from '../../helpers/logger.js';

const router = express.Router();

/**
 * Basic health check endpoint
 * GET /api/health
 * Returns 200 if server is running
 */
router.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

/**
 * Readiness check endpoint
 * GET /api/health/ready
 * Returns 200 if all dependencies are ready (database, Redis, etc.)
 */
router.get('/ready', async (req, res) => {
    const checks = {
        server: true,
        database: false,
        redis: false,
        databaseState: 'disconnected'
    };
    const status = {
        success: true,
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks,
        version: process.env.npm_package_version || '1.0.0'
    };

    // Check MongoDB connection
    try {
        const dbState = mongoose.connection.readyState;
        // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
        const stateNames = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };
        checks.databaseState = stateNames[dbState] || 'unknown';
        
        if (dbState === 1) {
            checks.database = true;
            // Add database info if available
            if (mongoose.connection.db) {
                checks.databaseName = mongoose.connection.db.databaseName;
            }
        } else {
            checks.database = false;
            status.success = false;
            status.status = 'not ready';
        }
    } catch (error) {
        logger.error('Health check: Database connection failed', { error: error.message });
        checks.database = false;
        checks.databaseState = 'error';
        status.success = false;
        status.status = 'not ready';
    }

    // Check Redis connection (optional)
    try {
        const { isRedisConnected, getRedisClient } = await import('../../config/redis.js');
        checks.redis = isRedisConnected();
        if (checks.redis) {
            // Try to get Redis client info if available
            try {
                const redisClient = getRedisClient();
                if (redisClient) {
                    checks.redisState = 'connected';
                    // Try to ping Redis to verify it's actually responsive
                    try {
                        await redisClient.ping();
                        checks.redisPing = 'ok';
                    } catch (pingError) {
                        checks.redisPing = 'failed';
                        checks.redis = false;
                    }
                }
            } catch (infoError) {
                // Ignore info errors, connection check is enough
                checks.redisState = 'error';
            }
        } else {
            checks.redisState = 'disconnected';
        }
    } catch (error) {
        // Redis is optional, so don't fail health check if it's not configured
        checks.redis = false;
        checks.redisState = 'not configured';
    }

    const statusCode = status.success ? 200 : 503;
    res.status(statusCode).json(status);
});

/**
 * Liveness check endpoint
 * GET /api/health/live
 * Returns 200 if the application is alive (for Kubernetes liveness probes)
 */
router.get('/live', (req, res) => {
    res.status(200).json({
        success: true,
        status: 'alive',
        timestamp: new Date().toISOString()
    });
});

export default router;

