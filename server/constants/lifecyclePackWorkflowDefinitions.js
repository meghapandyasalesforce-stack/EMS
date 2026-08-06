/**
 * Industry & compliance pack → concrete workflow artifacts (tasks, checklist, documents, software requests).
 * Applied by lifecyclePackWorkflowService when packs are installed or workflows created.
 */

const task = (t) => Object.freeze(t);
const check = (c) => Object.freeze(c);
const sw = (s) => Object.freeze(s);

export const LIFECYCLE_PACK_WORKFLOW_ARTIFACTS = Object.freeze({
    // ── IT & Software ──
    'industry.it': {
        tasks: [
            task({ title: 'Provision GitHub/GitLab access', category: 'Access', assigneeRole: 'it', featureKey: 'industry.it.repositoryAccess', mandatory: true, phase: 'Day 1', order: 11 }),
            task({ title: 'Allocate development laptop', category: 'Equipment', assigneeRole: 'it', featureKey: 'industry.it.laptopAllocation', mandatory: true, phase: 'Day 1', order: 12 }),
            task({ title: 'Install required software stack', category: 'IT Setup', assigneeRole: 'it', featureKey: 'industry.it.softwareAllocation', mandatory: true, phase: 'Week 1', order: 13 }),
        ],
        checklist: [
            check({ item: 'NDA signed', category: 'HR', mandatory: true, phase: 'Day 1', featureKey: 'industry.it.nda' }),
            check({ item: 'Repository access granted', category: 'IT', mandatory: true, phase: 'Day 1', featureKey: 'industry.it.repositoryAccess' }),
        ],
        softwareRequests: [
            sw({ system: 'GitHub', category: 'scm', mandatory: true, featureKey: 'industry.it.repositoryAccess' }),
            sw({ system: 'GitLab', category: 'scm', mandatory: false, featureKey: 'industry.it.repositoryAccess' }),
            sw({ system: 'Terms', category: 'project', mandatory: true, featureKey: 'industry.it.softwareAllocation' }),
            sw({ system: 'Outlook', category: 'communication', mandatory: true, featureKey: 'industry.it.softwareAllocation' }),
        ],
        documentKeys: ['NDA'],
    },

    // ── Healthcare ──
    'industry.healthcare': {
        tasks: [
            task({ title: 'Verify medical license', category: 'Documentation', assigneeRole: 'hr', featureKey: 'industry.healthcare.license', mandatory: true, phase: 'Week 1', order: 20 }),
            task({ title: 'Validate professional credentials', category: 'Documentation', assigneeRole: 'hr', featureKey: 'industry.healthcare.credentials', mandatory: true, phase: 'Week 1', order: 21 }),
            task({ title: 'Upload credential documents', category: 'Documentation', assigneeRole: 'employee', featureKey: 'industry.healthcare.credentials', mandatory: true, phase: 'Week 1', order: 22 }),
        ],
        checklist: [
            check({ item: 'Medical license verified', category: 'HR', mandatory: true, phase: 'Week 1', featureKey: 'industry.healthcare.license' }),
            check({ item: 'Board credentials on file', category: 'HR', mandatory: true, phase: 'Week 1', featureKey: 'industry.healthcare.credentials' }),
        ],
        documentKeys: ['MEDICAL_CERTIFICATE'],
    },

    // ── Manufacturing ──
    'industry.manufacturing': {
        tasks: [
            task({ title: 'Complete safety induction training', category: 'Training', assigneeRole: 'employee', featureKey: 'industry.manufacturing.safetyTraining', mandatory: true, phase: 'Day 1', order: 30 }),
            task({ title: 'Issue PPE kit', category: 'Equipment', assigneeRole: 'it', featureKey: 'industry.manufacturing.ppeAllocation', mandatory: true, phase: 'Day 1', order: 31 }),
            task({ title: 'Authorize machine access', category: 'Access', assigneeRole: 'manager', featureKey: 'industry.manufacturing.machineAuthorization', mandatory: false, phase: 'Week 1', order: 32 }),
        ],
        checklist: [
            check({ item: 'Safety induction completed', category: 'HR', mandatory: true, phase: 'Day 1', featureKey: 'industry.manufacturing.safetyTraining' }),
            check({ item: 'PPE issued and acknowledged', category: 'IT', mandatory: true, phase: 'Day 1', featureKey: 'industry.manufacturing.ppeAllocation' }),
        ],
        assets: [{ assetType: 'Other', name: 'PPE Kit', mandatory: true }],
    },

    // ── BFSI ──
    'industry.bfsi': {
        tasks: [
            task({ title: 'Complete AML/KYC verification', category: 'HR Paperwork', assigneeRole: 'hr', featureKey: 'industry.bfsi.amlKyc', mandatory: true, phase: 'Week 1', order: 40 }),
            task({ title: 'Obtain regulatory sign-off', category: 'HR Paperwork', assigneeRole: 'admin', featureKey: 'industry.bfsi.regulatoryApproval', mandatory: true, phase: 'Week 2', order: 41 }),
            task({ title: 'Submit KYC documents', category: 'Documentation', assigneeRole: 'employee', featureKey: 'industry.bfsi.amlKyc', mandatory: true, phase: 'Week 1', order: 42 }),
        ],
        checklist: [
            check({ item: 'AML/KYC cleared', category: 'HR', mandatory: true, phase: 'Week 2', featureKey: 'industry.bfsi.amlKyc' }),
            check({ item: 'Regulatory approval recorded', category: 'Admin', mandatory: true, phase: 'Week 2', featureKey: 'industry.bfsi.regulatoryApproval' }),
        ],
        documentKeys: ['POLICE_VERIFICATION', 'PAN', 'AADHAAR'],
    },

    // ── Retail / Hospitality ──
    'industry.retail': {
        tasks: [
            task({ title: 'Fast-track documentation review', category: 'Documentation', assigneeRole: 'hr', featureKey: 'industry.retail.fastTrackOnboarding', mandatory: true, phase: 'Day 1', order: 50 }),
            task({ title: 'Assign store/location', category: 'HR Paperwork', assigneeRole: 'hr', featureKey: 'industry.retail.bulkHiring', mandatory: true, phase: 'Day 1', order: 51 }),
        ],
        checklist: [
            check({ item: 'Day 1 essentials complete', category: 'HR', mandatory: true, phase: 'Day 1', featureKey: 'industry.retail.fastTrackOnboarding' }),
        ],
        fastTrack: true,
    },

    // ── Construction ──
    'industry.construction': {
        tasks: [
            task({ title: 'Complete site safety induction', category: 'Training', assigneeRole: 'employee', featureKey: 'industry.construction.siteSafety', mandatory: true, phase: 'Day 1', order: 60 }),
            task({ title: 'Classify worker type (employee/contractor)', category: 'HR Paperwork', assigneeRole: 'hr', featureKey: 'industry.construction.contractorClassification', mandatory: true, phase: 'Day 1', order: 61 }),
            task({ title: 'Issue site access permit', category: 'Access', assigneeRole: 'admin', featureKey: 'industry.construction.safetyCertification', mandatory: true, phase: 'Day 1', order: 62 }),
        ],
        checklist: [
            check({ item: 'Site safety induction done', category: 'HR', mandatory: true, phase: 'Day 1', featureKey: 'industry.construction.siteSafety' }),
            check({ item: 'Contractor classification recorded', category: 'HR', mandatory: true, phase: 'Day 1', featureKey: 'industry.construction.contractorClassification' }),
            check({ item: 'Site permit issued', category: 'Admin', mandatory: true, phase: 'Day 1', featureKey: 'industry.construction.safetyCertification' }),
        ],
    },

    // ── Education ──
    'industry.education': {
        tasks: [
            task({ title: 'Verify faculty credentials', category: 'Documentation', assigneeRole: 'hr', featureKey: 'industry.education.facultyCredentials', mandatory: true, phase: 'Week 1', order: 70 }),
            task({ title: 'Child safety background check', category: 'Documentation', assigneeRole: 'hr', featureKey: 'industry.education.childSafetyBgv', mandatory: true, phase: 'Week 1', order: 71, requiredDocuments: ['POLICE_VERIFICATION'] }),
        ],
        checklist: [
            check({ item: 'Faculty credentials verified', category: 'HR', mandatory: true, phase: 'Week 1', featureKey: 'industry.education.facultyCredentials' }),
            check({ item: 'Child protection BGV clear', category: 'HR', mandatory: true, phase: 'Week 1', featureKey: 'industry.education.childSafetyBgv' }),
        ],
        bgvCheckTypes: ['criminal', 'identity', 'education'],
    },

    // ── India Core Identity & Statutory ──
    'compliance.india.core': {
        tasks: [
            task({ title: 'Collect and verify Aadhaar', category: 'Documentation', assigneeRole: 'employee', featureKey: 'compliance.india.aadhaar', mandatory: true, phase: 'Day 1', order: 1 }),
            task({ title: 'Collect and verify PAN', category: 'Documentation', assigneeRole: 'employee', featureKey: 'compliance.india.pan', mandatory: true, phase: 'Day 1', order: 2 }),
            task({ title: 'Register / link UAN', category: 'HR Paperwork', assigneeRole: 'hr', featureKey: 'compliance.india.uan', mandatory: true, phase: 'Week 1', order: 3 }),
            task({ title: 'Complete EPF Form 11', category: 'HR Paperwork', assigneeRole: 'employee', featureKey: 'compliance.india.epf', mandatory: true, phase: 'Week 1', order: 4 }),
            task({ title: 'Complete ESI registration', category: 'HR Paperwork', assigneeRole: 'hr', featureKey: 'compliance.india.esi', mandatory: true, phase: 'Week 1', order: 5 }),
            task({ title: 'Submit nomination forms', category: 'HR Paperwork', assigneeRole: 'employee', featureKey: 'compliance.india.nomination', mandatory: true, phase: 'Week 1', order: 6 }),
            task({ title: 'Capture digital consent', category: 'HR Paperwork', assigneeRole: 'employee', featureKey: 'compliance.india.digitalConsent', mandatory: true, phase: 'Day 1', order: 7 }),
        ],
        checklist: [
            check({ item: 'Aadhaar verified', category: 'HR', mandatory: true, phase: 'Day 1', featureKey: 'compliance.india.aadhaar' }),
            check({ item: 'PAN verified', category: 'HR', mandatory: true, phase: 'Day 1', featureKey: 'compliance.india.pan' }),
            check({ item: 'UAN linked', category: 'HR', mandatory: true, phase: 'Week 1', featureKey: 'compliance.india.uan' }),
            check({ item: 'EPF enrollment done', category: 'Payroll', mandatory: true, phase: 'Week 1', featureKey: 'compliance.india.epf' }),
            check({ item: 'ESI enrollment done', category: 'Payroll', mandatory: true, phase: 'Week 1', featureKey: 'compliance.india.esi' }),
            check({ item: 'Nomination forms filed', category: 'HR', mandatory: true, phase: 'Week 1', featureKey: 'compliance.india.nomination' }),
            check({ item: 'Digital consent captured', category: 'HR', mandatory: true, phase: 'Day 1', featureKey: 'compliance.india.digitalConsent' }),
        ],
        documentKeys: ['AADHAAR', 'PAN', 'UAN_DOCUMENT', 'PF_FORM', 'ESI_FORM', 'NOMINEE_FORM', 'DIGITAL_CONSENT'],
    },

    // ── India Tax & Payroll ──
    'compliance.india.tax': {
        tasks: [
            task({ title: 'Configure professional tax', category: 'HR Paperwork', assigneeRole: 'payroll', featureKey: 'compliance.india.professionalTax', mandatory: true, phase: 'Week 1', order: 8 }),
            task({ title: 'Enrol Labour Welfare Fund', category: 'HR Paperwork', assigneeRole: 'payroll', featureKey: 'compliance.india.lwf', mandatory: false, phase: 'Week 2', order: 9 }),
            task({ title: 'Submit investment declaration', category: 'HR Paperwork', assigneeRole: 'employee', featureKey: 'compliance.india.investmentDeclaration', mandatory: true, phase: 'Week 2', order: 10 }),
            task({ title: 'Issue Form 16 (annual)', category: 'Documentation', assigneeRole: 'payroll', featureKey: 'compliance.india.form16', mandatory: false, phase: 'Ongoing', order: 11 }),
        ],
        checklist: [
            check({ item: 'Professional tax configured', category: 'Payroll', mandatory: true, phase: 'Week 1', featureKey: 'compliance.india.professionalTax' }),
            check({ item: 'Investment declaration received', category: 'Payroll', mandatory: true, phase: 'Week 2', featureKey: 'compliance.india.investmentDeclaration' }),
        ],
        documentKeys: ['INVESTMENT_DECLARATION'],
    },

    // ── India Gratuity ──
    'compliance.india.gratuity': {
        tasks: [
            task({ title: 'Record gratuity nomination', category: 'HR Paperwork', assigneeRole: 'employee', featureKey: 'compliance.india.gratuity', mandatory: true, phase: 'Week 2', order: 12 }),
        ],
        checklist: [
            check({ item: 'Gratuity nomination on file', category: 'HR', mandatory: true, phase: 'Week 2', featureKey: 'compliance.india.gratuity' }),
        ],
        documentKeys: ['NOMINEE_FORM'],
        offboardingTasks: [
            task({ title: 'Calculate gratuity eligibility', category: 'Payroll', assigneeRole: 'payroll', featureKey: 'compliance.india.gratuity', mandatory: true, phase: 'LWD', order: 12 }),
        ],
    },

    // ── India Labour ──
    'compliance.india.labour': {
        tasks: [
            task({ title: 'Complete state labour compliance checklist', category: 'HR Paperwork', assigneeRole: 'hr', featureKey: 'compliance.india.stateLabour', mandatory: true, phase: 'Week 1', order: 13 }),
            task({ title: 'Verify Shops & Establishment registration', category: 'HR Paperwork', assigneeRole: 'hr', featureKey: 'compliance.india.shopsEstablishment', mandatory: false, phase: 'Week 2', order: 14 }),
        ],
        checklist: [
            check({ item: 'State labour compliance verified', category: 'HR', mandatory: true, phase: 'Week 1', featureKey: 'compliance.india.stateLabour' }),
        ],
    },

    // ── US Compliance ──
    'compliance.us.core': {
        tasks: [
            task({ title: 'Complete I-9 Section 1', category: 'HR Paperwork', assigneeRole: 'employee', featureKey: 'compliance.us.i9', mandatory: true, phase: 'Day 1', order: 80 }),
            task({ title: 'Complete I-9 Section 2 verification', category: 'HR Paperwork', assigneeRole: 'hr', featureKey: 'compliance.us.i9', mandatory: true, phase: 'Day 3', order: 81 }),
            task({ title: 'Submit W-4 tax withholding', category: 'HR Paperwork', assigneeRole: 'employee', featureKey: 'compliance.us.w4', mandatory: true, phase: 'Week 1', order: 82 }),
            task({ title: 'Sign at-will employment acknowledgment', category: 'HR Paperwork', assigneeRole: 'employee', featureKey: 'compliance.us.atWill', mandatory: true, phase: 'Day 1', order: 83 }),
        ],
        documentKeys: ['I9_FORM', 'W4_FORM', 'AT_WILL_ACK'],
    },

    // ── UK Compliance ──
    'compliance.uk.core': {
        tasks: [
            task({ title: 'Right to Work document check', category: 'Documentation', assigneeRole: 'hr', featureKey: 'compliance.uk.rightToWork', mandatory: true, phase: 'Day 1', order: 90 }),
            task({ title: 'Collect Right to Work evidence', category: 'Documentation', assigneeRole: 'employee', featureKey: 'compliance.uk.rightToWork', mandatory: true, phase: 'Day 1', order: 91 }),
        ],
        offboardingTasks: [
            task({ title: 'Issue P45', category: 'Documentation', assigneeRole: 'payroll', featureKey: 'compliance.uk.p45', mandatory: true, phase: 'LWD', order: 92 }),
        ],
        documentKeys: ['RIGHT_TO_WORK', 'P45_FORM'],
    },

    // ── EU Compliance ──
    'compliance.eu.core': {
        tasks: [
            task({ title: 'Employee GDPR consent', category: 'HR Paperwork', assigneeRole: 'employee', featureKey: 'compliance.eu.gdprConsent', mandatory: true, phase: 'Day 1', order: 100 }),
            task({ title: 'Works council notification (if applicable)', category: 'HR Paperwork', assigneeRole: 'hr', featureKey: 'compliance.eu.worksCouncil', mandatory: false, phase: 'Week 1', order: 101 }),
        ],
        documentKeys: ['GDPR_CONSENT'],
    },

    // ── Middle East Compliance ──
    'compliance.me.core': {
        tasks: [
            task({ title: 'Record labour card details', category: 'Documentation', assigneeRole: 'hr', featureKey: 'compliance.me.labourCard', mandatory: true, phase: 'Week 1', order: 110 }),
            task({ title: 'Link visa/sponsorship', category: 'Documentation', assigneeRole: 'hr', featureKey: 'compliance.me.visa', mandatory: true, phase: 'Week 1', order: 111 }),
            task({ title: 'Upload iqama/work permit', category: 'Documentation', assigneeRole: 'employee', featureKey: 'compliance.me.iqama', mandatory: true, phase: 'Week 1', order: 112 }),
        ],
        offboardingTasks: [
            task({ title: 'Process exit permit / visa cancellation', category: 'Documentation', assigneeRole: 'hr', featureKey: 'compliance.me.exitPermit', mandatory: true, phase: 'LWD', order: 113 }),
        ],
        documentKeys: ['LABOUR_CARD', 'VISA_DOCUMENT', 'IQAMA'],
    },
});

export function getPackWorkflowArtifacts(packKey) {
    return LIFECYCLE_PACK_WORKFLOW_ARTIFACTS[packKey] || null;
}

export function getArtifactsForInstalledPacks(packKeys = []) {
    const merged = { tasks: [], checklist: [], softwareRequests: [], assets: [], documentKeys: [], offboardingTasks: [], bgvCheckTypes: [], fastTrack: false };
    const seen = { tasks: new Set(), checklist: new Set() };

    for (const key of packKeys) {
        const art = getPackWorkflowArtifacts(key);
        if (!art) continue;
        for (const t of art.tasks || []) {
            const id = `${t.featureKey}:${t.title}`;
            if (!seen.tasks.has(id)) { seen.tasks.add(id); merged.tasks.push(t); }
        }
        for (const c of art.checklist || []) {
            const id = `${c.featureKey}:${c.item}`;
            if (!seen.checklist.has(id)) { seen.checklist.add(id); merged.checklist.push(c); }
        }
        merged.softwareRequests.push(...(art.softwareRequests || []));
        merged.assets.push(...(art.assets || []));
        merged.documentKeys.push(...(art.documentKeys || []));
        merged.offboardingTasks.push(...(art.offboardingTasks || []));
        if (art.bgvCheckTypes?.length) merged.bgvCheckTypes = [...new Set([...merged.bgvCheckTypes, ...art.bgvCheckTypes])];
        if (art.fastTrack) merged.fastTrack = true;
    }
    merged.documentKeys = [...new Set(merged.documentKeys)];
    return merged;
}
