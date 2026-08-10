import { getOrganizationId } from '../../helpers/organizationHelper.js';
import { OffboardingWorkflow, OnboardingWorkflow } from '../../models/onboarding.model.js';
import {
    listOfferTemplates,
    upsertOfferTemplate,
    createOfferLetter,
    previewOfferLetter,
    previewOfferTemplate,
    submitOfferForApproval,
    sendOfferToCandidate,
    listOffersForCandidate,
    deleteOfferLetter,
    getOfferByPortalToken,
    respondToOfferPortal,
    reviseCounteredOffer,
} from '../../services/offerLetterService.js';
import {
    createBgvCase,
    updateBgvCheckStatus,
    syncBgvVendorCase,
    listBgvCases,
    getBgvCaseForWorkflow,
    buildBgvDashboard,
    trackBgvTimeline,
    initiateBgvApproval,
    completeManualVerification,
    getBgvCaseWithAnalytics,
    bulkSyncBgvCases,
    waiveBgvRequirement,
    getBgvStatistics,
    getEmployeeBgvDashboard,
    getEmployeeBgvCase,
    uploadBgvDocument,
    deleteBgvDocument,
    replaceBgvDocument,
    addReference,
    updateReference,
    deleteReference,
    acceptCriminalDeclaration,
    updateDocumentOcrStatus,
    updateDocumentMatchStatus,
    submitCheckForReview,
    verifyCheck,
    requestAdditionalInfo,
    respondToInfoRequest,
    getHrBgvDashboard,
    getHrBgvCaseDetail,
    addHrRemarks,
    addInternalNote,
    updateVerificationDetails,
    updateReferenceContactStatus,
    uploadVendorReport,
    generateBgvReport,
} from '../../services/backgroundVerificationService.js';
import {
    applyNoticePeriodToWorkflow,
    approveNoticeBuyout,
    buildNoticePeriodDashboard,
} from '../../services/noticePeriodService.js';
import {
    calculateFnfSettlement,
    generateFnfSummaryPdf,
    submitFnfForApproval,
    buildFnfDashboard,
} from '../../services/fnfSettlementService.js';
import { saveOffboardingWorkflow } from '../../services/offboardingService.js';
import { logLifecycleAudit } from '../../services/lifecycleAuditService.js';

const orgId = (req) => getOrganizationId(req);
const actor = (req) => req.employee || req.user;

async function loadOffboardingWorkflow(organizationId, workflowId) {
    const workflow = await OffboardingWorkflow.findOne({ _id: workflowId, organizationId })
        .populate('employeeId', 'name lastName email department jobTitle');
    if (!workflow) {
        const error = new Error('Offboarding workflow not found');
        error.statusCode = 404;
        throw error;
    }
    return workflow;
}

// —— Offer letter templates ——

export const getOfferTemplates = async (req, res) => {
    try {
        const templates = await listOfferTemplates(orgId(req));
        return res.json({ success: true, data: templates });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const saveOfferTemplate = async (req, res) => {
    try {
        const template = await upsertOfferTemplate(orgId(req), req.body, actor(req));
        await logLifecycleAudit({
            action: req.body.id ? 'Update' : 'Create',
            entityType: 'Offer',
            entityId: template._id,
            entityName: template.name,
            req,
            actor: actor(req),
        });
        return res.json({ success: true, data: template, message: 'Offer template saved' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postOfferLetter = async (req, res) => {
    try {
        const { candidateId, ...payload } = req.body;
        if (!candidateId) {
            return res.status(400).json({ success: false, message: 'candidateId is required' });
        }
        const offer = await createOfferLetter({
            organizationId: orgId(req),
            candidateId,
            payload,
            actor: actor(req),
            req,
        });
        return res.status(201).json({ success: true, data: offer, message: 'Offer letter created' });
    } catch (error) {
        if (error.code === 'OFFER_PLACEHOLDER_MISSING') {
            return res.status(400).json({
                success: false,
                message: error.message,
                missingFields: error.missingFields || [],
                renderedHtml: error.renderedHtml || '',
            });
        }
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postOfferPreview = async (req, res) => {
    try {
        const { candidateId, ...payload } = req.body;
        if (!candidateId) {
            return res.status(400).json({ success: false, message: 'candidateId is required' });
        }
        const preview = await previewOfferLetter({
            organizationId: orgId(req),
            candidateId,
            payload,
        });
        return res.json({ success: true, data: preview });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postOfferTemplatePreview = async (req, res) => {
    try {
        const { templateId, useSampleData = true } = req.body;
        const preview = await previewOfferTemplate(orgId(req), templateId, { useSampleData });
        return res.json({ success: true, data: preview });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const getOffersForCandidate = async (req, res) => {
    try {
        const offers = await listOffersForCandidate(orgId(req), req.params.candidateId);
        return res.json({ success: true, data: offers });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteOfferLetterHandler = async (req, res) => {
    try {
        const result = await deleteOfferLetter(orgId(req), req.params.id, actor(req), req);
        return res.json({ success: true, data: result, message: 'Offer letter deleted' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postOfferSubmitApproval = async (req, res) => {
    try {
        const offer = await submitOfferForApproval(orgId(req), req.params.id, actor(req), req);
        return res.json({ success: true, data: offer, message: 'Offer submitted for approval' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postOfferSend = async (req, res) => {
    try {
        const offer = await sendOfferToCandidate(orgId(req), req.params.id, actor(req));
        return res.json({ success: true, data: offer, message: 'Offer sent to candidate' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postOfferRevise = async (req, res) => {
    try {
        const offer = await reviseCounteredOffer(orgId(req), req.params.id, req.body, actor(req));
        return res.json({ success: true, data: offer, message: 'Offer revised — submit for approval again' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// —— Candidate portal (public) ——

export const getOfferPortal = async (req, res) => {
    try {
        const offer = await getOfferByPortalToken(req.params.token);
        if (!offer) {
            return res.status(404).json({ success: false, message: 'Offer link is invalid or expired' });
        }
        return res.json({
            success: true,
            data: {
                position: offer.position,
                department: offer.department,
                salary: offer.salary,
                startDate: offer.startDate,
                expiryDate: offer.expiryDate,
                bodyHtml: offer.bodyHtml,
                pdfUrl: offer.pdfUrl,
                status: offer.status,
                candidate: offer.candidateId,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const postOfferPortalRespond = async (req, res) => {
    try {
        const { action, signatureData, notes, counterOffer } = req.body;
        if (!['accept', 'decline', 'counter'].includes(action)) {
            return res.status(400).json({ success: false, message: 'action must be accept, decline, or counter' });
        }
        const offer = await respondToOfferPortal({
            token: req.params.token,
            action,
            signatureData,
            ipAddress: req.ip,
            notes,
            counterOffer,
        });
        const messages = {
            accept: 'Offer accepted',
            decline: 'Offer declined',
            counter: 'Counter-offer submitted',
        };
        return res.json({
            success: true,
            data: { status: offer.status },
            message: messages[action] || 'Response recorded',
        });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// —— Background verification ——

const bgvErrorStatus = (error) => {
    if (error?.code === 'FEATURE_DISABLED' || error?.name === 'LifecycleFeatureDisabledError') return 403;
    if (error?.status || error?.statusCode) return error.status || error.statusCode;
    return 400;
};

export const getBgvCases = async (req, res) => {
    try {
        if (req.featureDisabled) {
            return res.json({ success: true, data: [], dashboard: buildBgvDashboard([]), featureDisabled: true });
        }
        const cases = await listBgvCases(orgId(req), req.query);
        return res.json({ success: true, data: cases, dashboard: buildBgvDashboard(cases) });
    } catch (error) {
        return res.status(bgvErrorStatus(error) === 403 ? 403 : 500).json({
            success: false,
            code: error.code,
            message: error.message,
        });
    }
};

export const postBgvCase = async (req, res) => {
    try {
        const bgvCase = await createBgvCase({
            organizationId: orgId(req),
            ...req.body,
            actor: actor(req),
            req,
        });

        if (req.body.onboardingWorkflowId) {
            await OnboardingWorkflow.findOneAndUpdate(
                { _id: req.body.onboardingWorkflowId, organizationId: orgId(req) },
                {
                    $set: {
                        backgroundVerificationCaseId: bgvCase._id,
                        bgvStatus: bgvCase.overallStatus,
                    },
                },
            );
        }

        return res.status(201).json({ success: true, data: bgvCase, message: 'BGV case created' });
    } catch (error) {
        return res.status(bgvErrorStatus(error)).json({
            success: false,
            code: error.code,
            message: error.message,
        });
    }
};

export const patchBgvCheck = async (req, res) => {
    try {
        const bgvCase = await updateBgvCheckStatus(
            orgId(req),
            req.params.id,
            req.params.checkId,
            { ...req.body, actor: actor(req), req },
        );
        return res.json({ success: true, data: bgvCase, message: 'Check updated' });
    } catch (error) {
        return res.status(bgvErrorStatus(error)).json({
            success: false,
            code: error.code,
            message: error.message,
        });
    }
};

export const postBgvSync = async (req, res) => {
    try {
        const bgvCase = await syncBgvVendorCase(orgId(req), req.params.id, { actor: actor(req) });
        return res.json({ success: true, data: bgvCase, message: 'Vendor sync completed' });
    } catch (error) {
        return res.status(bgvErrorStatus(error)).json({
            success: false,
            code: error.code,
            message: error.message,
        });
    }
};

/** Employee (or buddy/manager with access) — read BGV for a specific onboarding workflow they own. */
export const getMyOnboardingBgv = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const workflowId = req.params.workflowId;
        const { resolveEmployeeIdFromRequest } = await import('../../services/onboardingService.js');
        const employeeId = await resolveEmployeeIdFromRequest(req);
        if (!employeeId) {
            return res.status(401).json({ success: false, message: 'Employee profile not found' });
        }

        const workflow = await OnboardingWorkflow.findOne({
            _id: workflowId,
            organizationId,
            isTemplate: { $ne: true },
        }).select('employeeId assignedBuddy assignedManager backgroundVerificationCaseId bgvStatus bgvProgress');

        if (!workflow) {
            return res.status(404).json({ success: false, message: 'Onboarding workflow not found' });
        }

        const actorId = String(employeeId);
        const isSubject = String(workflow.employeeId) === actorId;
        const isBuddy = String(workflow.assignedBuddy || '') === actorId;
        const isManager = String(workflow.assignedManager || '') === actorId;
        if (!isSubject && !isBuddy && !isManager) {
            return res.status(403).json({ success: false, message: 'Not authorized to view this BGV case' });
        }

        const bgvCase = await getBgvCaseForWorkflow(organizationId, workflowId, { workflow });
        return res.json({
            success: true,
            data: bgvCase,
            workflow: {
                bgvStatus: workflow.bgvStatus,
                bgvProgress: workflow.bgvProgress,
                backgroundVerificationCaseId: workflow.backgroundVerificationCaseId,
            },
        });
    } catch (error) {
        return res.status(bgvErrorStatus(error) === 403 ? 403 : 500).json({
            success: false,
            code: error.code,
            message: error.message,
        });
    }
};

/** Onboarding employee can start BGV on their own workflow when Configure has it enabled. */
export const postMyOnboardingBgv = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const workflowId = req.params.workflowId;
        const { resolveEmployeeIdFromRequest } = await import('../../services/onboardingService.js');
        const employeeId = await resolveEmployeeIdFromRequest(req);
        if (!employeeId) {
            return res.status(401).json({ success: false, message: 'Employee profile not found' });
        }

        const workflow = await OnboardingWorkflow.findOne({
            _id: workflowId,
            organizationId,
            employeeId,
            isTemplate: { $ne: true },
        });
        if (!workflow) {
            return res.status(404).json({
                success: false,
                message: 'Only the onboarding employee can start BGV on their own workflow',
            });
        }

        if (workflow.backgroundVerificationCaseId) {
            const existing = await getBgvCaseForWorkflow(organizationId, workflowId, { workflow });
            if (existing) {
                return res.json({
                    success: true,
                    data: existing,
                    message: 'Background verification already initiated',
                });
            }
        }

        const bgvCase = await createBgvCase({
            organizationId,
            subjectType: 'employee',
            employeeId: workflow.employeeId,
            onboardingWorkflowId: workflow._id,
            actor: actor(req),
            req,
        });

        workflow.backgroundVerificationCaseId = bgvCase._id;
        await workflow.save();

        return res.status(201).json({
            success: true,
            data: bgvCase,
            message: 'Background verification initiated',
        });
    } catch (error) {
        return res.status(bgvErrorStatus(error)).json({
            success: false,
            code: error.code,
            message: error.message,
        });
    }
};

/** Employee submits a check for HR review (Initiated → In Progress). */
export const patchMyOnboardingBgvCheck = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const { workflowId, checkId } = req.params;
        const { resolveEmployeeIdFromRequest } = await import('../../services/onboardingService.js');
        const employeeId = await resolveEmployeeIdFromRequest(req);
        if (!employeeId) {
            return res.status(401).json({ success: false, message: 'Employee profile not found' });
        }

        const workflow = await OnboardingWorkflow.findOne({
            _id: workflowId,
            organizationId,
            employeeId,
            isTemplate: { $ne: true },
        }).select('employeeId backgroundVerificationCaseId');
        if (!workflow) {
            return res.status(404).json({
                success: false,
                message: 'Only the onboarding employee can update BGV on their own workflow',
            });
        }

        const bgvSnapshot = await getBgvCaseForWorkflow(organizationId, workflowId, { workflow });
        if (!bgvSnapshot?._id) {
            return res.status(404).json({ success: false, message: 'BGV case not found for your onboarding' });
        }

        const nextStatus = req.body?.status || 'In Progress';
        if (!['In Progress', 'Initiated'].includes(nextStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Employees can only move checks to In Progress. HR completes Clear / Failed.',
            });
        }

        const bgvCase = await updateBgvCheckStatus(
            organizationId,
            bgvSnapshot._id,
            checkId,
            {
                status: nextStatus,
                notes: req.body?.notes,
                actor: actor(req),
                req,
            },
        );
        return res.json({ success: true, data: bgvCase, message: 'Check submitted for HR review' });
    } catch (error) {
        return res.status(bgvErrorStatus(error)).json({
            success: false,
            code: error.code,
            message: error.message,
        });
    }
};

// —— Notice period ——

export const getNoticePeriodDashboard = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const workflows = await OffboardingWorkflow.find({
            organizationId,
            status: { $nin: ['Draft', 'Cancelled'] },
        }).select('noticePeriod lastWorkingDate status employeeId').lean();
        return res.json({ success: true, data: buildNoticePeriodDashboard(workflows) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const postNoticeBuyout = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const workflow = await loadOffboardingWorkflow(organizationId, req.params.workflowId);
        const { buyoutDays, notes } = req.body;
        if (!buyoutDays || buyoutDays < 1) {
            return res.status(400).json({ success: false, message: 'buyoutDays is required' });
        }
        await approveNoticeBuyout(workflow, { buyoutDays, actor: actor(req)?._id, notes });
        await saveOffboardingWorkflow(workflow, organizationId, { actor: actor(req)?._id });
        return res.json({ success: true, data: workflow, message: 'Notice buyout approved' });
    } catch (error) {
        const status = error.statusCode || 400;
        return res.status(status).json({ success: false, message: error.message });
    }
};

export const patchNoticeLeaveAdjustment = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const workflow = await loadOffboardingWorkflow(organizationId, req.params.workflowId);
        workflow.noticePeriod = workflow.noticePeriod || {};
        workflow.noticePeriod.leaveAdjustmentDays = Number(req.body.leaveAdjustmentDays || 0);
        await applyNoticePeriodToWorkflow(workflow, organizationId);
        await saveOffboardingWorkflow(workflow, organizationId, { actor: actor(req)?._id });
        return res.json({ success: true, data: workflow, message: 'Leave adjustment updated' });
    } catch (error) {
        const status = error.statusCode || 400;
        return res.status(status).json({ success: false, message: error.message });
    }
};

// —— F&F settlement ——

export const getFnfDashboard = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const workflows = await OffboardingWorkflow.find({ organizationId })
            .select('finalSettlement status employeeId').lean();
        return res.json({ success: true, data: buildFnfDashboard(workflows) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const postFnfCalculate = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const workflow = await loadOffboardingWorkflow(organizationId, req.params.workflowId);
        const { leaveBalanceDays, dailyRate, pendingDues, recoveries, bonusAmount, gratuityEstimate, taxDeduction } = req.body;

        if (pendingDues != null) workflow.finalSettlement = { ...workflow.finalSettlement, pendingDues };
        if (recoveries != null) workflow.finalSettlement = { ...workflow.finalSettlement, recoveries };
        if (bonusAmount != null) workflow.finalSettlement = { ...workflow.finalSettlement, bonusAmount };
        if (gratuityEstimate != null) workflow.finalSettlement = { ...workflow.finalSettlement, gratuityEstimate };
        if (taxDeduction != null) workflow.finalSettlement = { ...workflow.finalSettlement, taxDeduction };

        await calculateFnfSettlement(workflow, {
            actor: actor(req),
            leaveBalanceDays: Number(leaveBalanceDays || 0),
            dailyRate: dailyRate != null ? Number(dailyRate) : null,
        });
        await saveOffboardingWorkflow(workflow, organizationId, { actor: actor(req)?._id });
        return res.json({ success: true, data: workflow.finalSettlement, message: 'F&F calculated' });
    } catch (error) {
        const status = error.statusCode || 400;
        return res.status(status).json({ success: false, message: error.message });
    }
};

export const postFnfSubmitApproval = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const workflow = await loadOffboardingWorkflow(organizationId, req.params.workflowId);
        if (!workflow.finalSettlement?.calculatedAt) {
            return res.status(400).json({ success: false, message: 'Calculate F&F before submitting for approval' });
        }
        await submitFnfForApproval(workflow, actor(req), req);
        await saveOffboardingWorkflow(workflow, organizationId, { actor: actor(req)?._id });
        return res.json({ success: true, data: workflow.finalSettlement, message: 'F&F submitted for approval' });
    } catch (error) {
        const status = error.statusCode || 400;
        return res.status(status).json({ success: false, message: error.message });
    }
};

export const postFnfGeneratePdf = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const workflow = await loadOffboardingWorkflow(organizationId, req.params.workflowId);
        await generateFnfSummaryPdf(workflow, organizationId);
        await saveOffboardingWorkflow(workflow, organizationId, { actor: actor(req)?._id });
        return res.json({ success: true, data: workflow.finalSettlement, message: 'F&F PDF generated' });
    } catch (error) {
        const status = error.statusCode || 400;
        return res.status(status).json({ success: false, message: error.message });
    }
};

// Enhanced BGV endpoints
export const postBgvTimeline = async (req, res) => {
    try {
        const { BackgroundVerificationCase } = await import('../../models/lifecycleGap.model.js');
        const bgvCase = await BackgroundVerificationCase.findOne({ _id: req.params.id, organizationId: orgId(req) });
        if (!bgvCase) throw new Error('BGV case not found');

        const updated = await trackBgvTimeline(bgvCase, {
            milestone: req.body.milestone,
            actor: actor(req),
            req,
        });
        return res.json({ success: true, data: updated, message: 'Timeline updated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postBgvApproval = async (req, res) => {
    try {
        const bgvCase = await initiateBgvApproval(orgId(req), req.params.id, { actor: actor(req), req });
        return res.json({ success: true, data: bgvCase, message: 'Approval workflow initiated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postBgvManualVerification = async (req, res) => {
    try {
        const bgvCase = await completeManualVerification(
            orgId(req),
            req.params.id,
            req.params.checkId,
            { ...req.body, actor: actor(req), req }
        );
        return res.json({ success: true, data: bgvCase, message: 'Manual verification completed' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const getBgvCaseAnalytics = async (req, res) => {
    try {
        if (req.featureDisabled) {
            return res.json({ success: true, data: null, featureDisabled: true });
        }
        const bgvCase = await getBgvCaseWithAnalytics(orgId(req), req.params.id);
        return res.json({ success: true, data: bgvCase });
    } catch (error) {
        return res.status(404).json({ success: false, message: error.message });
    }
};

export const postBgvBulkSync = async (req, res) => {
    try {
        const result = await bulkSyncBgvCases(orgId(req), { actor: actor(req) });
        return res.json({ success: true, data: result, message: 'Bulk sync completed' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postBgvWaive = async (req, res) => {
    try {
        const bgvCase = await waiveBgvRequirement(orgId(req), req.params.id, {
            reason: req.body.reason,
            actor: actor(req),
            req,
        });
        return res.json({ success: true, data: bgvCase, message: 'BGV requirement waived' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const getBgvStatisticsHandler = async (req, res) => {
    try {
        if (req.featureDisabled) {
            return res.json({ success: true, data: { total: 0, clear: 0, inProgress: 0, initiated: 0, failed: 0, discrepancy: 0 }, featureDisabled: true });
        }
        const stats = await getBgvStatistics(orgId(req));
        return res.json({ success: true, data: stats });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Real-time BGV handlers for employee and HR
export const getEmployeeBgvCaseHandler = async (req, res) => {
    try {
        const bgvCase = await getEmployeeBgvCase(orgId(req), actor(req)?._id);
        return res.json({ success: true, data: bgvCase });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const uploadBgvDocumentHandler = async (req, res) => {
    try {
        const bgvCase = await uploadBgvDocument(
            orgId(req),
            req.params.bgvCaseId,
            req.params.checkId,
            {
                documentUrl: req.body.documentUrl,
                documentName: req.body.documentName,
                documentType: req.body.documentType,
                actor: actor(req),
                req,
            }
        );
        return res.json({ success: true, data: bgvCase, message: 'Document uploaded' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const submitCheckForReviewHandler = async (req, res) => {
    try {
        const bgvCase = await submitCheckForReview(
            orgId(req),
            req.params.bgvCaseId,
            req.params.checkId,
            {
                notes: req.body.notes,
                actor: actor(req),
                req,
            }
        );
        return res.json({ success: true, data: bgvCase, message: 'Check submitted for review' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const verifyCheckHandler = async (req, res) => {
    try {
        const bgvCase = await verifyCheck(
            orgId(req),
            req.params.id,
            req.params.checkId,
            {
                verified: req.body.verified,
                notes: req.body.notes,
                actor: actor(req),
                req,
            }
        );
        return res.json({ success: true, data: bgvCase, message: req.body.verified ? 'Check verified' : 'Check rejected' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const requestAdditionalInfoHandler = async (req, res) => {
    try {
        const bgvCase = await requestAdditionalInfo(
            orgId(req),
            req.params.id,
            req.params.checkId,
            {
                request: req.body.request,
                actor: actor(req),
                req,
            }
        );
        return res.json({ success: true, data: bgvCase, message: 'Additional information requested' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const respondToInfoRequestHandler = async (req, res) => {
    try {
        const bgvCase = await respondToInfoRequest(
            orgId(req),
            req.params.id,
            req.params.checkId,
            {
                response: req.body.response,
                documents: req.body.documents,
                actor: actor(req),
                req,
            }
        );
        return res.json({ success: true, data: bgvCase, message: 'Information response submitted' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// Additional BGV workflow handlers
export const deleteBgvDocumentHandler = async (req, res) => {
    try {
        const bgvCase = await deleteBgvDocument(
            orgId(req),
            req.params.id,
            req.params.checkId,
            req.params.documentId,
            { actor: actor(req), req }
        );
        return res.json({ success: true, data: bgvCase, message: 'Document deleted' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const replaceBgvDocumentHandler = async (req, res) => {
    try {
        const bgvCase = await replaceBgvDocument(
            orgId(req),
            req.params.id,
            req.params.checkId,
            req.params.documentId,
            {
                documentUrl: req.body.documentUrl,
                documentName: req.body.documentName,
                documentType: req.body.documentType,
                actor: actor(req),
                req,
            }
        );
        return res.json({ success: true, data: bgvCase, message: 'Document replaced' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const addReferenceHandler = async (req, res) => {
    try {
        const bgvCase = await addReference(
            orgId(req),
            req.params.id,
            req.params.checkId,
            {
                name: req.body.name,
                company: req.body.company,
                designation: req.body.designation,
                relationship: req.body.relationship,
                phone: req.body.phone,
                email: req.body.email,
                actor: actor(req),
                req,
            }
        );
        return res.json({ success: true, data: bgvCase, message: 'Reference added' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateReferenceHandler = async (req, res) => {
    try {
        const bgvCase = await updateReference(
            orgId(req),
            req.params.id,
            req.params.checkId,
            req.params.referenceId,
            {
                name: req.body.name,
                company: req.body.company,
                designation: req.body.designation,
                relationship: req.body.relationship,
                phone: req.body.phone,
                email: req.body.email,
                actor: actor(req),
                req,
            }
        );
        return res.json({ success: true, data: bgvCase, message: 'Reference updated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const deleteReferenceHandler = async (req, res) => {
    try {
        const bgvCase = await deleteReference(
            orgId(req),
            req.params.id,
            req.params.checkId,
            req.params.referenceId,
            { actor: actor(req), req }
        );
        return res.json({ success: true, data: bgvCase, message: 'Reference deleted' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// HR Dashboard and Case Detail endpoints
export const getHrBgvDashboardHandler = async (req, res) => {
    try {
        const dashboard = await getHrBgvDashboard(orgId(req), req.query);
        return res.json({ success: true, data: dashboard });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getHrBgvCaseDetailHandler = async (req, res) => {
    try {
        const bgvCase = await getHrBgvCaseDetail(orgId(req), req.params.id);
        return res.json({ success: true, data: bgvCase });
    } catch (error) {
        return res.status(404).json({ success: false, message: error.message });
    }
};

export const addHrRemarksHandler = async (req, res) => {
    try {
        const bgvCase = await addHrRemarks(
            orgId(req),
            req.params.id,
            req.params.checkId,
            {
                remarks: req.body.remarks,
                actor: actor(req),
                req,
            }
        );
        return res.json({ success: true, data: bgvCase, message: 'HR remarks added' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const addInternalNoteHandler = async (req, res) => {
    try {
        const bgvCase = await addInternalNote(
            orgId(req),
            req.params.id,
            req.params.checkId,
            {
                note: req.body.note,
                actor: actor(req),
                req,
            }
        );
        return res.json({ success: true, data: bgvCase, message: 'Internal note added' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateVerificationDetailsHandler = async (req, res) => {
    try {
        const bgvCase = await updateVerificationDetails(
            orgId(req),
            req.params.id,
            req.params.checkId,
            {
                verificationData: req.body.verificationData,
                actor: actor(req),
                req,
            }
        );
        return res.json({ success: true, data: bgvCase, message: 'Verification details updated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateReferenceContactStatusHandler = async (req, res) => {
    try {
        const bgvCase = await updateReferenceContactStatus(
            orgId(req),
            req.params.id,
            req.params.checkId,
            req.params.referenceId,
            {
                contactStatus: req.body.contactStatus,
                notes: req.body.notes,
                actor: actor(req),
                req,
            }
        );
        return res.json({ success: true, data: bgvCase, message: 'Reference contact status updated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const uploadVendorReportHandler = async (req, res) => {
    try {
        const bgvCase = await uploadVendorReport(
            orgId(req),
            req.params.id,
            req.params.checkId,
            {
                reportUrl: req.body.reportUrl,
                reportName: req.body.reportName,
                actor: actor(req),
                req,
            }
        );
        return res.json({ success: true, data: bgvCase, message: 'Vendor report uploaded' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const generateBgvReportHandler = async (req, res) => {
    try {
        const report = await generateBgvReport(
            orgId(req),
            {
                reportType: req.body.reportType,
                filters: req.body.filters,
                actor: actor(req),
                req,
            }
        );
        return res.json({ success: true, data: report, message: 'Report generated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// Criminal verification specific
export const acceptCriminalDeclarationHandler = async (req, res) => {
    try {
        const bgvCase = await acceptCriminalDeclaration(
            orgId(req),
            req.params.id,
            req.params.checkId,
            {
                accepted: req.body.accepted,
                actor: actor(req),
                req,
            }
        );
        return res.json({ success: true, data: bgvCase, message: req.body.accepted ? 'Declaration accepted' : 'Declaration declined' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// Draft save handlers for employee data entry
export const saveEmploymentDraftHandler = async (req, res) => {
    try {
        const bgvCase = await saveEmploymentDraft(
            orgId(req),
            req.params.id,
            req.params.checkId,
            {
                previousCompany: req.body.previousCompany,
                designation: req.body.designation,
                joiningDate: req.body.joiningDate,
                relievingDate: req.body.relievingDate,
                hrContact: req.body.hrContact,
                salary: req.body.salary,
                reasonForLeaving: req.body.reasonForLeaving,
                actor: actor(req),
                req,
            }
        );
        return res.json({ success: true, data: bgvCase, message: 'Employment draft saved' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const saveEducationDraftHandler = async (req, res) => {
    try {
        const bgvCase = await saveEducationDraft(
            orgId(req),
            req.params.id,
            req.params.checkId,
            {
                educationRecords: req.body.educationRecords,
                actor: actor(req),
                req,
            }
        );
        return res.json({ success: true, data: bgvCase, message: 'Education draft saved' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const saveAddressDraftHandler = async (req, res) => {
    try {
        const bgvCase = await saveAddressDraft(
            orgId(req),
            req.params.id,
            req.params.checkId,
            {
                currentAddress: req.body.currentAddress,
                permanentAddress: req.body.permanentAddress,
                actor: actor(req),
                req,
            }
        );
        return res.json({ success: true, data: bgvCase, message: 'Address draft saved' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// Employee Dashboard handler
export const getEmployeeBgvDashboardHandler = async (req, res) => {
    try {
        const dashboard = await getEmployeeBgvDashboard(orgId(req), actor(req)?._id);
        return res.json({ success: true, data: dashboard });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// OCR and document matching
export const updateDocumentOcrStatusHandler = async (req, res) => {
    try {
        const bgvCase = await updateDocumentOcrStatus(
            orgId(req),
            req.params.id,
            req.params.checkId,
            req.params.documentId,
            {
                ocrStatus: req.body.ocrStatus,
                ocrData: req.body.ocrData,
                actor: actor(req),
                req,
            }
        );
        return res.json({ success: true, data: bgvCase, message: 'OCR status updated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateDocumentMatchStatusHandler = async (req, res) => {
    try {
        const bgvCase = await updateDocumentMatchStatus(
            orgId(req),
            req.params.id,
            req.params.checkId,
            req.params.documentId,
            {
                matchStatus: req.body.matchStatus,
                matchScore: req.body.matchScore,
                actor: actor(req),
                req,
            }
        );
        return res.json({ success: true, data: bgvCase, message: 'Document match status updated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

