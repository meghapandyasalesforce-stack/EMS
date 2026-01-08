/**
 * Prometheus Metrics Setup
 * Basic Prometheus metrics collection for monitoring
 * 
 * Note: This is a basic setup. Full Prometheus/Grafana setup requires:
 * 1. Prometheus server installation
 * 2. Grafana installation
 * 3. Service discovery configuration
 * 4. Dashboard creation
 */

// Check if prom-client is available
let promClient = null;
let metricsEnabled = false;

try {
    promClient = require('prom-client');
    metricsEnabled = true;
} catch (error) {
    console.warn('prom-client not installed. Metrics collection disabled.');
    console.warn('Install with: npm install prom-client');
}

// Create a Registry to register the metrics
const register = metricsEnabled ? new promClient.Registry() : null;

// Enable default metrics (CPU, memory, etc.)
if (metricsEnabled) {
    promClient.collectDefaultMetrics({ register });
}

// Custom metrics
const httpRequestDuration = metricsEnabled ? new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.5, 1, 2, 5, 10]
}) : null;

const httpRequestTotal = metricsEnabled ? new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
}) : null;

const activeConnections = metricsEnabled ? new promClient.Gauge({
    name: 'active_connections',
    help: 'Number of active connections'
}) : null;

const databaseQueryDuration = metricsEnabled ? new promClient.Histogram({
    name: 'database_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['operation', 'collection'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2]
}) : null;

// Register custom metrics
if (metricsEnabled && register) {
    register.registerMetric(httpRequestDuration);
    register.registerMetric(httpRequestTotal);
    register.registerMetric(activeConnections);
    register.registerMetric(databaseQueryDuration);
}

/**
 * Middleware to collect HTTP metrics
 */
export const metricsMiddleware = (req, res, next) => {
    if (!metricsEnabled) {
        return next();
    }

    const startTime = Date.now();
    const route = req.route ? req.route.path : req.path;

    // Track active connections
    activeConnections.inc();

    // Override res.end to capture response
    const originalEnd = res.end;
    res.end = function(...args) {
        const duration = (Date.now() - startTime) / 1000;
        const statusCode = res.statusCode;

        // Record metrics
        httpRequestDuration.observe(
            { method: req.method, route, status_code: statusCode },
            duration
        );
        httpRequestTotal.inc({
            method: req.method,
            route,
            status_code: statusCode
        });

        // Decrement active connections
        activeConnections.dec();

        // Call original end
        originalEnd.apply(this, args);
    };

    next();
};

/**
 * Track database query duration
 */
export const trackDatabaseQuery = async (operation, collection, queryFn) => {
    if (!metricsEnabled) {
        return await queryFn();
    }

    const endTimer = databaseQueryDuration.startTimer({ operation, collection });
    try {
        const result = await queryFn();
        endTimer();
        return result;
    } catch (error) {
        endTimer();
        throw error;
    }
};

/**
 * Get metrics endpoint handler
 */
export const getMetrics = async (req, res) => {
    if (!metricsEnabled) {
        return res.status(503).json({
            error: 'Metrics not enabled',
            message: 'Install prom-client package to enable metrics'
        });
    }

    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
};

/**
 * Check if metrics are enabled
 */
export const isMetricsEnabled = () => metricsEnabled;

export default {
    metricsMiddleware,
    trackDatabaseQuery,
    getMetrics,
    isMetricsEnabled,
    register
};

