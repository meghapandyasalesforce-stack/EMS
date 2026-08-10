import { describe, it, expect } from '@jest/globals';
import {
    buildOfferPlaceholderMap,
    buildSampleOfferPlaceholderMap,
    resolveOfferLetterHtml,
    validateOfferLetterHtml,
    findPlaceholdersInTemplate,
    formatOrgAddress,
    amountToWordsINR,
} from '../../helpers/offerPlaceholderResolver.js';

describe('offerPlaceholderResolver', () => {
    const candidate = {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '9876543210',
        offerDetails: { salary: 1200000, startDate: new Date('2026-09-01') },
    };

    const org = {
        name: 'Acme Corp',
        legalName: 'Acme Corp Pvt Ltd',
        email: 'hr@acme.com',
        phone: '+91 80 1111 2222',
        website: 'https://acme.com',
        address: { street: '1 Tech Park', city: 'Bengaluru', state: 'KA', country: 'India' },
        workingHours: { start: '09:00', end: '18:00' },
    };

    const job = {
        jobTitle: 'Senior Engineer',
        department: 'Engineering',
        location: 'Bengaluru',
        employmentType: 'Full-time',
        hiringManager: { name: 'Alex Manager' },
    };

    const offer = {
        position: 'Senior Engineer',
        department: 'Engineering',
        salary: 1200000,
        startDate: new Date('2026-09-01'),
        expiryDate: new Date('2026-09-15'),
        benefits: ['Health insurance'],
        createdAt: new Date('2026-08-05'),
    };

    it('formats organization address', () => {
        expect(formatOrgAddress(org.address)).toContain('Bengaluru');
    });

    it('resolves HTML template with bold and placeholders', () => {
        const template = '<p><b>OFFER OF EMPLOYMENT</b></p><p>Dear {{candidateName}},</p>';
        const map = buildOfferPlaceholderMap({ candidate, org, offer, job, settings: {}, payload: {} });
        const html = resolveOfferLetterHtml(template, map);
        expect(html).toContain('<b>OFFER OF EMPLOYMENT</b>');
        expect(html).toContain('Dear Jane Doe,');
        expect(html).not.toContain('{{candidateName}}');
    });

    it('resolves salary breakdown placeholders from annual CTC', () => {
        const map = buildOfferPlaceholderMap({ candidate, org, offer, job, settings: {}, payload: {} });
        expect(map['{{annualCTC}}']).toMatch(/Rs/);
        expect(map['{{basicSalary}}']).toMatch(/Rs/);
        expect(map['{{hra}}']).toMatch(/Rs/);
        expect(map['{{employmentType}}']).toBe('Full-time');
        expect(map['{{reportingManager}}']).toBe('Alex Manager');
        expect(map['{{workingHours}}']).toBe('09:00 – 18:00');
    });

    it('does not require reportingManager when empty in template', () => {
        const template = '<p>{{candidateName}} — Manager: {{reportingManager}}</p>';
        const map = {
            '{{candidateName}}': 'Jane Doe',
            '{{reportingManager}}': '',
        };
        const result = validateOfferLetterHtml(template, map);
        expect(result.ok).toBe(true);
        expect(result.missing).toHaveLength(0);
        expect(result.renderedHtml).toContain('Jane Doe');
        expect(result.renderedHtml).not.toContain('{{reportingManager}}');
    });

    it('flags missing placeholders used in template', () => {
        const template = '<p>{{employmentType}} · {{probationPeriod}} · {{candidateName}}</p>';
        const map = buildOfferPlaceholderMap({
            candidate,
            org,
            offer: { ...offer, salary: null },
            job: { ...job, employmentType: undefined },
            settings: {},
            payload: {},
        });
        map['{{candidateName}}'] = 'Jane Doe';
        map['{{employmentType}}'] = '';
        map['{{probationPeriod}}'] = '';

        const result = validateOfferLetterHtml(template, map);
        expect(result.ok).toBe(false);
        expect(result.missing.map((m) => m.label)).toEqual(
            expect.arrayContaining(['Employment Type', 'Probation Period']),
        );
        expect(result.renderedHtml).not.toContain('{{employmentType}}');
    });

    it('preserves HTML tables after placeholder replacement', () => {
        const template = `<table><tr><th>Component</th><th>Monthly</th></tr>
            <tr><td>Basic</td><td>{{basicSalary}}</td></tr></table>`;
        const map = buildOfferPlaceholderMap({ candidate, org, offer, job, settings: {}, payload: {} });
        const html = resolveOfferLetterHtml(template, map);
        expect(html).toContain('<table>');
        expect(html).toContain('<td>Basic</td>');
        expect(html).not.toContain('{{basicSalary}}');
    });

    it('finds all placeholders in template', () => {
        const tokens = findPlaceholdersInTemplate('<p>{{candidateName}} {{email}}</p>');
        expect(tokens).toEqual(['{{candidateName}}', '{{email}}']);
    });

    it('builds complete sample map for template preview', () => {
        const sample = buildSampleOfferPlaceholderMap();
        expect(sample['{{candidateName}}']).toBeTruthy();
        expect(sample['{{companyName}}']).toBeTruthy();
        expect(sample['{{salaryWords}}']).toMatch(/Rupees Only/i);
        const result = validateOfferLetterHtml('<p>{{candidateName}} — {{companyName}}</p>', sample);
        expect(result.ok).toBe(true);
    });

    it('synchronizes salaryWords with annual CTC', () => {
        expect(amountToWordsINR(500000)).toBe('Five Lakh Rupees Only');
        expect(amountToWordsINR(600000)).toBe('Six Lakh Rupees Only');

        const map = buildOfferPlaceholderMap({
            candidate,
            org,
            offer: { ...offer, salary: 500000 },
            job,
            settings: {},
            payload: {},
        });
        expect(map['{{annualCTC}}']).toMatch(/5,00,000|500,000/);
        expect(map['{{salaryWords}}']).toBe('Five Lakh Rupees Only');
        expect(map['{{annualCTCInWords}}']).toBe('Five Lakh Rupees Only');

        const map2 = buildOfferPlaceholderMap({
            candidate,
            org,
            offer: { ...offer, salary: 600000 },
            job,
            settings: {},
            payload: {},
        });
        expect(map2['{{salaryWords}}']).toBe('Six Lakh Rupees Only');
    });

    it('resolves company and annualCTCInWords template aliases', () => {
        const map = buildOfferPlaceholderMap({ candidate, org, offer, job, settings: {}, payload: {} });
        expect(map['{{company}}']).toBe(map['{{companyName}}']);
        expect(map['{{company}}']).toContain('Acme');
        expect(map['{{annualCTCInWords}}']).toBe(map['{{salaryWords}}']);
        expect(map['{{employeeESI}}']).toBeTruthy();
        expect(map['{{gratuity}}']).toMatch(/Rs/);

        const template = '<p>{{company}} — {{annualCTCInWords}} — {{employeeESI}} — {{gratuity}}</p>';
        const result = validateOfferLetterHtml(template, map);
        expect(result.ok).toBe(true);
        expect(result.missing).toHaveLength(0);
    });

    it('accepts HR form overrides for company, ESI, gratuity, and CTC words', () => {
        const map = buildOfferPlaceholderMap({
            candidate,
            org: { ...org, name: '', legalName: '' },
            offer: { ...offer, salary: null },
            job,
            settings: {},
            payload: {
                companyName: 'Paarsiv Technologies Pvt Ltd',
                annualCTCInWords: 'Five Lakh Rupees Only',
                employeeESI: 'Rs 0',
                gratuity: 'Rs 1,200',
            },
        });
        expect(map['{{company}}']).toBe('Paarsiv Technologies Pvt Ltd');
        expect(map['{{annualCTCInWords}}']).toBe('Five Lakh Rupees Only');
        expect(map['{{employeeESI}}']).toBe('Rs 0');
        expect(map['{{gratuity}}']).toBe('Rs 1,200');
    });

    it('does not leave unresolved placeholders or undefined/null/NaN in rendered HTML', () => {
        const template = '<p>{{candidateName}} {{unknownToken}} {{salary}}</p>';
        const map = buildOfferPlaceholderMap({ candidate, org, offer, job, settings: {}, payload: {} });
        map['{{weird}}'] = 'undefined';
        const html = resolveOfferLetterHtml(template + '{{weird}}', map);
        expect(html).not.toContain('{{candidateName}}');
        expect(html).not.toContain('{{unknownToken}}');
        expect(html).not.toContain('{{weird}}');
        expect(html).not.toMatch(/\bundefined\b/);
        expect(html).not.toMatch(/\bNaN\b/);
        expect(html).toContain('Jane Doe');
    });

    it('noticePeriod uses payload value — never probationNoticeDays (15)', () => {
        const settings = {
            noticePeriodPolicy: { defaultNoticeDays: 30, probationNoticeDays: 15 },
        };
        const with32 = buildOfferPlaceholderMap({
            candidate: { ...candidate, offerDetails: { ...candidate.offerDetails, probationPeriod: '15 days' } },
            org,
            offer,
            job,
            settings,
            payload: { noticePeriod: '32 days', probationPeriod: '15 days' },
        });
        expect(with32['{{noticePeriod}}']).toBe('32 days');
        expect(with32['{{probationPeriod}}']).toBe('15 days');

        const with90Bare = buildOfferPlaceholderMap({
            candidate,
            org,
            offer,
            job,
            settings,
            payload: { noticePeriod: '90', probationPeriod: '6 months' },
        });
        expect(with90Bare['{{noticePeriod}}']).toBe('90 days');
        expect(with90Bare['{{probationPeriod}}']).toBe('6 months');

        const with15 = buildOfferPlaceholderMap({
            candidate,
            org,
            offer,
            job,
            settings,
            payload: { noticePeriod: '15 days' },
        });
        expect(with15['{{noticePeriod}}']).toBe('15 days');

        const blankNotice = buildOfferPlaceholderMap({
            candidate: { ...candidate, offerDetails: { ...candidate.offerDetails, probationPeriod: '15 days' } },
            org,
            offer,
            job,
            settings,
            payload: { probationPeriod: '15 days' },
        });
        // Blank notice → defaultNoticeDays (30), NOT probationNoticeDays (15)
        expect(blankNotice['{{noticePeriod}}']).toBe('30 days');
        expect(blankNotice['{{noticePeriod}}']).not.toBe('15 days');
        expect(blankNotice['{{probationPeriod}}']).toBe('15 days');
    });
});
