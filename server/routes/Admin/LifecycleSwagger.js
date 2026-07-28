/**
 * @swagger
 * tags:
 *   name: Lifecycle Enterprise
 *   description: Phase F — statutory compliance, IT, LMS, dashboards, search, bulk, notifications
 */

/**
 * @swagger
 * /admin/lifecycle/statutory/generate:
 *   post:
 *     summary: Generate India statutory document PDF
 *     tags: [Lifecycle Enterprise]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               docType:
 *                 type: string
 *                 enum: [form16, form12ba, tds_summary, epf_statement, esi_statement]
 *               employeeId:
 *                 type: string
 *     responses:
 *       200:
 *         description: PDF generated
 */

/**
 * @swagger
 * /admin/lifecycle/probation/center:
 *   get:
 *     summary: Probation center dashboard
 *     tags: [Lifecycle Enterprise]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Active, upcoming, and all probation workflows
 */

/**
 * @swagger
 * /admin/lifecycle/dashboards/{type}:
 *   get:
 *     summary: Enterprise dashboard (executive, hr, recruitment, lifecycle, department, manager, country, location)
 *     tags: [Lifecycle Enterprise]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dashboard KPIs and charts
 */

/**
 * @swagger
 * /admin/lifecycle/search:
 *   get:
 *     summary: Global lifecycle search
 *     tags: [Lifecycle Enterprise]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Search results
 */

/**
 * @swagger
 * /admin/lifecycle/bulk/execute:
 *   post:
 *     summary: Execute bulk lifecycle operation
 *     tags: [Lifecycle Enterprise]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               operation:
 *                 type: string
 *               payload:
 *                 type: object
 *     responses:
 *       200:
 *         description: Bulk operation results
 */

export {};
