import { getOrganizationId } from '../../helpers/organizationHelper.js';
import {
    listDocumentLibrary,
    getPendingVerification,
    getExpiryDashboard,
    getCatalogWithOverrides,
    assignDocumentToWorkflow,
    verifyDocument,
    bulkVerifyDocuments,
    sendDocumentReminders,
    restoreDocumentVersion,
    buildDocumentReports,
    exportDocumentsCsv,
    upsertCatalogEntry,
    processDocumentOCR,
    createDocumentVersion,
    getDocumentPreview,
    initiateDocumentRenewal,
    completeDocumentRenewal,
    getDocumentVersionHistory,
    bulkDocumentOperation,
    LIFECYCLE_DOCUMENT_HUB_CATEGORIES,
} from '../../services/lifecycleDocumentHubService.js';

const orgId = (req) => getOrganizationId(req);
const actor = (req) => req.employee || req.user;

export const getDocumentHubCategories = async (_req, res) => {
    return res.json({ success: true, data: LIFECYCLE_DOCUMENT_HUB_CATEGORIES });
};

export const listDocumentHubLibrary = async (req, res) => {
    try {
        const docs = await listDocumentLibrary(orgId(req), {
            hubCategory: req.query.hubCategory,
            catalogKey: req.query.catalogKey,
            verificationStatus: req.query.verificationStatus,
            approvalStatus: req.query.approvalStatus,
            employeeId: req.query.employeeId,
            department: req.query.department,
            stageKey: req.query.stageKey,
            featureKey: req.query.featureKey,
            tag: req.query.tag,
            search: req.query.search,
            expiringWithinDays: req.query.expiringWithinDays,
            expired: req.query.expired === '1',
            limit: req.query.limit ? Number(req.query.limit) : undefined,
        });
        return res.json({ success: true, data: docs });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getDocumentHubPending = async (req, res) => {
    try {
        const docs = await getPendingVerification(orgId(req), req.query);
        return res.json({ success: true, data: docs });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getDocumentHubExpiryDashboard = async (req, res) => {
    try {
        const dashboard = await getExpiryDashboard(orgId(req));
        return res.json({ success: true, data: dashboard });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getDocumentHubCatalog = async (req, res) => {
    try {
        const catalog = await getCatalogWithOverrides(orgId(req), req.query.module || 'both');
        return res.json({ success: true, data: catalog });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const postDocumentHubCatalogEntry = async (req, res) => {
    try {
        const entry = await upsertCatalogEntry(orgId(req), req.body, { actor: actor(req), req });
        return res.status(201).json({ success: true, data: entry, message: 'Catalog entry saved' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const assignDocumentHubWorkflow = async (req, res) => {
    try {
        const doc = await assignDocumentToWorkflow(orgId(req), req.params.id, req.body, { actor: actor(req), req });
        return res.json({ success: true, data: doc, message: 'Document assigned' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const verifyDocumentHub = async (req, res) => {
    try {
        const doc = await verifyDocument(orgId(req), req.params.id, {
            status: req.body.status || 'Approved',
            remarks: req.body.remarks || req.body.rejectionReason,
            actor: actor(req),
            req,
        });
        return res.json({ success: true, data: doc, message: `Document ${doc.verificationStatus.toLowerCase()}` });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const bulkVerifyDocumentHub = async (req, res) => {
    try {
        const results = await bulkVerifyDocuments(
            orgId(req),
            req.body.documentIds || [],
            req.body.status,
            { remarks: req.body.remarks, actor: actor(req), req },
        );
        return res.json({ success: true, data: results });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const bulkReminderDocumentHub = async (req, res) => {
    try {
        const result = await sendDocumentReminders(orgId(req), req.body.documentIds || [], { actor: actor(req) });
        return res.json({ success: true, data: result });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const restoreDocumentHubVersion = async (req, res) => {
    try {
        const doc = await restoreDocumentVersion(orgId(req), req.params.id, Number(req.body.version), { actor: actor(req), req });
        return res.json({ success: true, data: doc, message: `Restored to v${req.body.version}` });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const getDocumentHubReports = async (req, res) => {
    try {
        const report = await buildDocumentReports(orgId(req));
        return res.json({ success: true, data: report });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const exportDocumentHubLibrary = async (req, res) => {
    try {
        const docs = await listDocumentLibrary(orgId(req), req.query);
        const format = req.query.format || 'csv';
        if (format === 'csv') {
            const csv = exportDocumentsCsv(docs);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="document-hub-export.csv"');
            return res.send(csv);
        }
        return res.json({ success: true, data: docs });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// Enhanced Document Hub endpoints
export const processDocumentOCRHandler = async (req, res) => {
    try {
        const doc = await processDocumentOCR(req.params.id, { organizationId: orgId(req), actor: actor(req), req });
        return res.json({ success: true, data: doc, message: 'OCR processing initiated' });
    } catch (error) {
        const status = error.status || 400;
        return res.status(status).json({
            success: false,
            code: error.code || 'OCR_FAILED',
            message: error.message,
            data: error.document || undefined,
        });
    }
};

export const createDocumentVersionHandler = async (req, res) => {
    try {
        const doc = await createDocumentVersion(orgId(req), req.params.id, {
            fileUrl: req.body.fileUrl,
            fileName: req.body.fileName,
            comments: req.body.comments,
            actor: actor(req),
            req,
        });
        return res.json({ success: true, data: doc, message: 'New version created' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const getDocumentPreviewHandler = async (req, res) => {
    try {
        const preview = await getDocumentPreview(req.params.id, { organizationId: orgId(req) });
        return res.json({ success: true, data: preview });
    } catch (error) {
        return res.status(404).json({ success: false, message: error.message });
    }
};

export const initiateDocumentRenewalHandler = async (req, res) => {
    try {
        const doc = await initiateDocumentRenewal(orgId(req), req.params.id, { actor: actor(req), req });
        return res.json({ success: true, data: doc, message: 'Renewal initiated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const completeDocumentRenewalHandler = async (req, res) => {
    try {
        const result = await completeDocumentRenewal(orgId(req), req.params.id, {
            newDocumentId: req.body.newDocumentId,
            actor: actor(req),
            req,
        });
        return res.json({ success: true, data: result, message: 'Renewal completed' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const getDocumentVersionHistoryHandler = async (req, res) => {
    try {
        const history = await getDocumentVersionHistory(req.params.id, { organizationId: orgId(req) });
        return res.json({ success: true, data: history });
    } catch (error) {
        return res.status(404).json({ success: false, message: error.message });
    }
};

export const bulkDocumentOperationHandler = async (req, res) => {
    try {
        const results = await bulkDocumentOperation(
            orgId(req),
            req.body.operation,
            req.body.documentIds,
            { actor: actor(req), req }
        );
        return res.json({ success: true, data: results });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};
