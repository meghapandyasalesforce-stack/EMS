/**
 * Offer letter management — templates, PDF, approval, portal, e-sign.
 */

import crypto from 'crypto';
import { Candidate } from '../models/recruitment.model.js';
import Organization from '../models/organization.model.js';
import { OfferLetter, OfferLetterTemplate } from '../models/lifecycleGap.model.js';
import { applyPlaceholders, generateLetterPdf } from '../helpers/lifecycleLetterPdf.js';
import { initiateLifecycleApproval } from './lifecycleApprovalService.js';
import { captureSignature } from './esignAdapter.js';
import { getOrCreateLifecycleSettings, isFeatureEnabled, assertFeatureEnabled } from './lifecycleConfigService.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';
import { notify } from '../helpers/notificationManager.js';
import logger from '../helpers/logger.js';

const DEFAULT_OFFER_BODY = `<p>Dear {{candidateName}},</p>
<p>We are pleased to offer you the position of <strong>{{position}}</strong> at {{companyName}}.</p>
<p><strong>Department:</strong> {{department}}<br/>
<strong>Location:</strong> {{location}}<br/>
<strong>Annual CTC:</strong> {{salary}}<br/>
<strong>Date of Joining:</strong> {{startDate}}<br/>
<strong>Offer Valid Until:</strong> {{offerExpiryDate}}</p>
<p>Please accept this offer through the candidate portal.</p>
<p>Regards,<br/>{{companyName}} HR Team</p>`;

export async function ensureDefaultOfferTemplate(organizationId) {
    let template = await OfferLetterTemplate.findOne({ organizationId, isDefault: true });
    if (template) return template;
    template = await OfferLetterTemplate.create({
        organizationId,
        name: 'Default Offer Letter',
        bodyHtml: DEFAULT_OFFER_BODY,
        isDefault: true,
    });
    return template;
}

export async function listOfferTemplates(organizationId) {
    await ensureDefaultOfferTemplate(organizationId);
    return OfferLetterTemplate.find({ organizationId, isActive: { $ne: false } }).sort({ isDefault: -1, name: 1 }).lean();
}

export async function upsertOfferTemplate(organizationId, payload, actor) {
    await assertFeatureEnabled(organizationId, 'offerLetter', 'Offer letter');
    const { id, ...data } = payload;
    if (data.isDefault) {
        await OfferLetterTemplate.updateMany({ organizationId }, { $set: { isDefault: false } });
    }
    let template;
    if (id) {
        const existing = await OfferLetterTemplate.findOne({ _id: id, organizationId });
        if (!existing) throw new Error('Template not found');
        if (data.bodyHtml && data.bodyHtml !== existing.bodyHtml) {
            existing.versionHistory = existing.versionHistory || [];
            existing.versionHistory.push({
                version: existing.version,
                bodyHtml: existing.bodyHtml,
                changedBy: actor?._id,
                changedAt: new Date(),
            });
            existing.version = (existing.version || 1) + 1;
        }
        Object.assign(existing, data, { updatedBy: actor?._id });
        template = await existing.save();
    } else {
        template = await OfferLetterTemplate.create({ ...data, organizationId, createdBy: actor?._id });
    }
    return template;
}

function buildOfferPlaceholderData({ candidate, org, offer, job }) {
    const name = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ');
    return {
        '{{candidateName}}': name,
        '{{candidateEmail}}': candidate.email || '',
        '{{position}}': offer.position || job?.jobTitle || '',
        '{{department}}': offer.department || job?.department || '',
        '{{salary}}': offer.salary ? `Rs ${Number(offer.salary).toLocaleString('en-IN')}` : '',
        '{{startDate}}': offer.startDate ? new Date(offer.startDate).toLocaleDateString('en-IN') : '',
        '{{companyName}}': org?.name || org?.legalName || 'Organization',
        '{{location}}': job?.location || '',
        '{{benefits}}': (offer.benefits || []).join(', '),
        '{{offerExpiryDate}}': offer.expiryDate ? new Date(offer.expiryDate).toLocaleDateString('en-IN') : '',
        '{{currentDate}}': new Date().toLocaleDateString('en-IN'),
        '{{reportingManager}}': '',
    };
}

export async function createOfferLetter({
    organizationId,
    candidateId,
    payload,
    actor,
    req,
}) {
    const settings = await assertFeatureEnabled(organizationId, 'offerLetter', 'Offer letter');

    const candidate = await Candidate.findOne({ _id: candidateId, organizationId });
    if (!candidate) throw new Error('Candidate not found');

    const template = payload.templateId
        ? await OfferLetterTemplate.findOne({ _id: payload.templateId, organizationId })
        : await ensureDefaultOfferTemplate(organizationId);
    if (!template) throw new Error('Offer template not found');

    const org = await Organization.findById(organizationId).select('name legalName').lean();
    const defaultExpiryDays = settings.offerPolicy?.defaultExpiryDays ?? 7;
    const expiryDate = payload.expiryDate
        ? new Date(payload.expiryDate)
        : new Date(Date.now() + defaultExpiryDays * 86400000);

    const offerData = {
        organizationId,
        candidateId,
        jobPostingId: candidate.jobPostingId,
        templateId: template._id,
        templateVersion: template.version,
        position: payload.position || candidate.offerDetails?.position,
        department: payload.department,
        salary: payload.salary ?? candidate.offerDetails?.salary,
        benefits: payload.benefits || candidate.offerDetails?.benefits || [],
        startDate: payload.startDate ? new Date(payload.startDate) : candidate.offerDetails?.startDate,
        expiryDate,
        status: 'Draft',
        createdBy: actor?._id,
    };

    const lastVersion = await OfferLetter.findOne({ organizationId, candidateId }).sort({ version: -1 }).lean();
    offerData.version = (lastVersion?.version || 0) + 1;

    const draft = new OfferLetter(offerData);
    draft.bodyHtml = applyPlaceholders(template.bodyHtml, buildOfferPlaceholderData({
        candidate, org, offer: draft, job: null,
    }));

    const pdf = await generateLetterPdf({
        organizationId,
        prefix: 'offer',
        title: 'Offer Letter',
        bodyHtml: draft.bodyHtml,
        fileName: `offer-${candidateId}-v${draft.version}.pdf`,
    });
    draft.pdfUrl = pdf.pdfUrl;
    draft.pdfFileName = pdf.pdfFileName;
    draft.activityFeed.push({
        action: 'offer_created',
        description: `Offer letter v${draft.version} created`,
        actor: actor?._id,
    });

    await draft.save();

    candidate.offerDetails = {
        ...(candidate.offerDetails?.toObject?.() || candidate.offerDetails || {}),
        position: draft.position,
        startDate: draft.startDate,
        salary: draft.salary,
        benefits: draft.benefits,
        offerLetter: { url: draft.pdfUrl, sentDate: null, expiryDate: draft.expiryDate },
        status: 'Draft',
    };
    await candidate.save();

    await logLifecycleAudit({
        action: 'Create',
        entityType: 'Offer',
        entityId: draft._id,
        entityName: `Offer v${draft.version}`,
        req,
        actor,
        after: draft.toObject(),
    });

    return draft;
}

export async function submitOfferForApproval(organizationId, offerId, actor, req) {
    await assertFeatureEnabled(organizationId, 'offerApproval', 'Offer approval');
    const offer = await OfferLetter.findOne({ _id: offerId, organizationId });
    if (!offer) throw new Error('Offer not found');
    if (!['Draft', 'PendingApproval'].includes(offer.status) && offer.status !== 'Draft') {
        if (offer.status === 'Approved') return offer;
    }

    const approval = await initiateLifecycleApproval({
        organizationId,
        entityType: 'Offer',
        entityId: offer._id,
        requestedBy: actor?._id,
        metadata: { salary: offer.salary, position: offer.position },
        req,
        actor,
    });

    if (approval.approvalInstanceId) {
        offer.approvalInstanceId = approval.approvalInstanceId;
        offer.status = 'PendingApproval';
    } else if (approval.status === 'Approved') {
        offer.status = 'Approved';
    }
    offer.activityFeed.push({ action: 'offer_submitted', description: 'Submitted for approval', actor: actor?._id });
    await offer.save();
    return offer;
}

export async function sendOfferToCandidate(organizationId, offerId, actor) {
    await assertFeatureEnabled(organizationId, 'offerLetter', 'Offer letter');
    const offer = await OfferLetter.findOne({ _id: offerId, organizationId });
    if (!offer) throw new Error('Offer not found');
    const resend = ['Sent', 'Viewed', 'Countered'].includes(offer.status);
    if (!['Approved', 'Draft', 'Sent', 'Viewed', 'Countered'].includes(offer.status)) {
        throw new Error(`Cannot send offer in status: ${offer.status}`);
    }

    offer.portalToken = crypto.randomBytes(32).toString('hex');
    offer.portalTokenExpiresAt = offer.expiryDate || new Date(Date.now() + 14 * 86400000);
    offer.status = 'Sent';
    offer.sentAt = new Date();
    offer.activityFeed.push({
        action: resend ? 'offer_resent' : 'offer_sent',
        description: resend ? 'Offer resent to candidate' : 'Offer sent to candidate',
        actor: actor?._id,
    });
    await offer.save();

    const candidate = await Candidate.findById(offer.candidateId);
    if (candidate) {
        candidate.status = 'Offer Extended';
        candidate.stage = 'Offer';
        candidate.offerDetails = candidate.offerDetails || {};
        candidate.offerDetails.status = 'Sent';
        candidate.offerDetails.offerLetter = {
            url: offer.pdfUrl,
            sentDate: offer.sentAt,
            expiryDate: offer.expiryDate,
        };
        await candidate.save();
    }

    const frontendBase = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
    const portalUrl = `${frontendBase.replace(/\/$/, '')}/offer/${offer.portalToken}`;

    if (candidate?.email) {
        try {
            const { sendOfferLinkEmail } = await import('./recruitmentEmailService.js');
            await sendOfferLinkEmail({
                candidate,
                offer,
                portalUrl,
                actorId: actor?._id,
            });
        } catch (e) {
            logger.warn('Auto offer email failed (portal link still generated)', { error: e.message });
        }
    }

    await notify({
        type: 'lifecycle_offer_sent',
        organizationId,
        data: { offer, candidate, portalToken: offer.portalToken },
    }).catch((e) => logger.warn('Offer sent notification failed', { error: e.message }));

    return offer;
}

export async function getOfferByPortalToken(token) {
    const offer = await OfferLetter.findOne({
        portalToken: token,
        portalTokenExpiresAt: { $gt: new Date() },
        status: { $in: ['Sent', 'Viewed'] },
    }).populate('candidateId', 'firstName lastName email');
    if (!offer) return null;
    if (offer.status === 'Sent') {
        offer.status = 'Viewed';
        offer.viewedAt = new Date();
        await offer.save();
    }
    return offer;
}

export async function respondToOfferPortal({ token, action, signatureData, ipAddress, notes, counterOffer }) {
    const offer = await OfferLetter.findOne({ portalToken: token, portalTokenExpiresAt: { $gt: new Date() } });
    if (!offer) throw new Error('Invalid or expired offer link');
    if (!['Sent', 'Viewed'].includes(offer.status)) throw new Error('Offer already responded');

    await assertFeatureEnabled(offer.organizationId, 'offerAcceptance', 'Offer acceptance');
    if (action === 'accept') {
        await assertFeatureEnabled(offer.organizationId, 'eSignature', 'E-signature');
    }
    const settings = await getOrCreateLifecycleSettings(offer.organizationId);
    const provider = settings.esignProvider || 'internal';

    if (action === 'counter') {
        offer.versionHistory = offer.versionHistory || [];
        offer.versionHistory.push({
            version: offer.version,
            bodyHtml: offer.bodyHtml,
            changedBy: null,
            changedAt: new Date(),
            changeNotes: 'Candidate counter-offer',
        });
        if (counterOffer?.salary != null) offer.salary = Number(counterOffer.salary);
        if (counterOffer?.startDate) offer.startDate = new Date(counterOffer.startDate);
        if (counterOffer?.benefits) offer.benefits = counterOffer.benefits;
        offer.status = 'Countered';
        offer.respondedAt = new Date();
        offer.responseNotes = notes || counterOffer?.notes || 'Candidate submitted a counter-offer';
        offer.activityFeed.push({
            action: 'offer_countered',
            description: offer.responseNotes,
            metadata: counterOffer || {},
        });
        await offer.save();

        const candidate = await Candidate.findById(offer.candidateId);
        if (candidate) {
            candidate.offerDetails = candidate.offerDetails || {};
            candidate.offerDetails.status = 'Countered';
            await candidate.save();
        }

        await notify({
            type: 'lifecycle_offer_declined',
            organizationId: offer.organizationId,
            data: { offer, counter: true },
        }).catch(() => {});

        return offer;
    }

    if (action === 'accept') {
        const signature = await captureSignature({
            provider,
            offerLetter: offer,
            signatureData,
            ipAddress,
        });
        offer.signature = signature;
        offer.status = 'Accepted';
        offer.respondedAt = new Date();
        offer.responseNotes = notes;
        offer.activityFeed.push({ action: 'offer_accepted', description: 'Candidate accepted offer' });

        const candidate = await Candidate.findById(offer.candidateId);
        if (candidate) {
            candidate.status = 'Offer Accepted';
            candidate.offerDetails.status = 'Accepted';
            await candidate.save();
        }
    } else {
        offer.status = 'Declined';
        offer.respondedAt = new Date();
        offer.responseNotes = notes;
        offer.activityFeed.push({ action: 'offer_declined', description: notes || 'Candidate declined offer' });
        const candidate = await Candidate.findById(offer.candidateId);
        if (candidate) {
            candidate.status = 'Offer Declined';
            candidate.offerDetails.status = 'Declined';
            await candidate.save();
        }
    }
    await offer.save();

    await notify({
        type: action === 'accept' ? 'lifecycle_offer_accepted' : 'lifecycle_offer_declined',
        organizationId: offer.organizationId,
        data: { offer },
    }).catch(() => {});

    return offer;
}

/**
 * HR revises a countered offer → new version, back to Draft for re-approval
 */
export async function reviseCounteredOffer(organizationId, offerId, payload, actor) {
    const offer = await OfferLetter.findOne({ _id: offerId, organizationId });
    if (!offer) throw new Error('Offer not found');
    if (offer.status !== 'Countered' && offer.status !== 'Draft') {
        throw new Error('Only Countered or Draft offers can be revised this way');
    }

    offer.versionHistory = offer.versionHistory || [];
    offer.versionHistory.push({
        version: offer.version,
        bodyHtml: offer.bodyHtml,
        changedBy: actor?._id,
        changedAt: new Date(),
    });
    offer.version = (offer.version || 1) + 1;

    if (payload.salary != null) offer.salary = Number(payload.salary);
    if (payload.startDate) offer.startDate = new Date(payload.startDate);
    if (payload.position) offer.position = payload.position;
    if (payload.benefits) offer.benefits = payload.benefits;
    if (payload.bodyHtml) offer.bodyHtml = payload.bodyHtml;
    if (payload.expiryDate) offer.expiryDate = new Date(payload.expiryDate);

    offer.status = 'Draft';
    offer.portalToken = undefined;
    offer.portalTokenExpiresAt = undefined;
    offer.activityFeed.push({
        action: 'offer_revised',
        description: payload.notes || 'Offer revised after counter',
        actor: actor?._id,
    });
    await offer.save();
    return offer;
}

export async function listOffersForCandidate(organizationId, candidateId) {
    return OfferLetter.find({ organizationId, candidateId }).sort({ version: -1 }).lean();
}
