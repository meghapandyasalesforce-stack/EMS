/**
 * India statutory compliance — Form 16, 12BA, TDS, EPF, ESI, Gratuity, PT, LWF, S&E reports.
 * Reuses payroll data, income-tax helpers, letter PDF generator, and Document library.
 */

import fs from 'fs';
import Payroll from '../models/payroll.model.js';
import Employee from '../models/employee.model.js';
import { Document } from '../models/document.model.js';
import Organization from '../models/organization.model.js';
import { generateLetterPdf } from '../helpers/lifecycleLetterPdf.js';
import {
    buildIncomeTaxParamsFromEmployee,
    computeAnnualIncomeTax,
    resolveTaxDeclaration,
    formatTaxRegimeLabel,
} from '../helpers/incomeTaxCalculation.js';
import { estimateGratuityFromEmployee } from './gratuityCalculationService.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';

export const STATUTORY_DOC_TYPES = Object.freeze([
    'form16', 'form12ba', 'tds_summary', 'epf_statement', 'esi_statement',
    'gratuity_statement', 'professional_tax', 'lwf_summary', 'shops_establishment',
    'investment_declaration', 'compliance_report',
]);

export const STATUTORY_MODULES = Object.freeze([
    {
        key: 'form16',
        label: 'Form 16',
        category: 'Tax',
        description: 'TDS certificate under Section 203 with salary breakup and computed annual tax.',
        featureKey: 'compliance.india.form16',
    },
    {
        key: 'form12ba',
        label: 'Form 12BA',
        category: 'Tax',
        description: 'Statement of perquisites and allowances for the financial year.',
        featureKey: 'compliance.india.form16',
    },
    {
        key: 'tds_summary',
        label: 'TDS Summary',
        category: 'Tax',
        description: 'Quarterly and annual TDS deducted from processed payroll.',
        featureKey: 'compliance.india.form16',
    },
    {
        key: 'epf_statement',
        label: 'EPF Statement',
        category: 'Provident Fund',
        description: 'Employee and employer PF contributions with UAN validation.',
        featureKey: 'compliance.india.epf',
    },
    {
        key: 'esi_statement',
        label: 'ESI Statement',
        category: 'Insurance',
        description: 'ESI employee/employer contributions for the financial year.',
        featureKey: 'compliance.india.esi',
    },
    {
        key: 'gratuity_statement',
        label: 'Gratuity Statement',
        category: 'Benefits',
        description: 'Payment of Gratuity Act eligibility estimate from service and wage data.',
        featureKey: 'compliance.india.gratuity',
    },
    {
        key: 'professional_tax',
        label: 'Professional Tax',
        category: 'State Labour',
        description: 'State professional tax deducted across the financial year.',
        featureKey: 'compliance.india.professionalTax',
    },
    {
        key: 'lwf_summary',
        label: 'Labour Welfare Fund',
        category: 'State Labour',
        description: 'Labour Welfare Fund contribution summary by state.',
        featureKey: 'compliance.india.lwf',
    },
    {
        key: 'shops_establishment',
        label: 'Shops & Establishment',
        category: 'Org Compliance',
        description: 'Organization headcount and registration snapshot for S&E compliance.',
        featureKey: 'compliance.india.shopsEstablishment',
    },
    {
        key: 'investment_declaration',
        label: 'Investment Declaration',
        category: 'Tax',
        description: 'Employee 80C / 80D / 24b / HRA declarations from financialDetails.taxDeclaration.',
        featureKey: 'compliance.india.investmentDeclaration',
    },
    {
        key: 'compliance_report',
        label: 'Digital Compliance Report',
        category: 'Org Compliance',
        description: 'Combined TDS, EPF, and gratuity overview for an employee.',
        featureKey: 'indiaStatutoryCompliance',
    },
]);

const MONTH_INDEX = {
    january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3,
    april: 4, apr: 4, may: 5, june: 6, jun: 6, july: 7, jul: 7,
    august: 8, aug: 8, september: 9, sep: 9, sept: 9,
    october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
};

export function financialYear(fyStartMonth = 4) {
    const now = new Date();
    const year = now.getMonth() + 1 >= fyStartMonth ? now.getFullYear() : now.getFullYear() - 1;
    return { startYear: year, endYear: year + 1, label: `FY ${year}-${String(year + 1).slice(-2)}` };
}

export function validatePan(pan) {
    const value = String(pan || '').trim().toUpperCase();
    const valid = /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value);
    return { valid, value: value || null, message: valid ? 'Valid PAN' : 'PAN must be 5 letters, 4 digits, 1 letter' };
}

export function validateUan(uan) {
    const value = String(uan || '').replace(/\s/g, '');
    const valid = /^\d{12}$/.test(value);
    return { valid, value: value || null, message: valid ? 'Valid UAN' : 'UAN must be 12 digits' };
}

export function validateAadhaar(aadhaar) {
    const value = String(aadhaar || '').replace(/\s/g, '');
    const valid = /^\d{12}$/.test(value) && !/^0+$/.test(value);
    return { valid, value: value || null, message: valid ? 'Valid Aadhaar format' : 'Aadhaar must be 12 digits' };
}

export function validateEsiNumber(esi) {
    const value = String(esi || '').replace(/[\s-]/g, '');
    const valid = /^\d{10}(\d{7})?$/.test(value);
    return { valid, value: value || null, message: valid ? 'Valid ESI number format' : 'ESI number must be 10 or 17 digits' };
}

function inr(amount) {
    return `Rs.${Number(amount || 0).toLocaleString('en-IN')}`;
}

function monthNumber(month) {
    if (month == null) return 0;
    if (typeof month === 'number') return month;
    const raw = String(month).trim();
    if (/^\d+$/.test(raw)) return Number(raw);
    return MONTH_INDEX[raw.toLowerCase()] || 0;
}

function isInFinancialYear(p, fy) {
    const m = monthNumber(p.month);
    const y = Number(p.year);
    if (!m || !y) return false;
    if (y === fy.startYear && m >= 4) return true;
    if (y === fy.endYear && m <= 3) return true;
    return false;
}

function resolveEmployeeFields(employee = {}) {
    const fin = employee.financialDetails || {};
    const pan = fin.panNumber || employee.panNumber || null;
    const uan = fin.epfUan || employee.epfUan || employee.uanNumber || null;
    const aadhaar = employee.aadhaarNumber
        || employee.aadharNumber
        || fin.aadhaarNumber
        || fin.aadharNumber
        || employee.identity?.aadhaar
        || employee.identity?.aadhaarNumber
        || null;
    const esiNumber = employee.esiNumber || fin.esiNumber || null;
    const displayName = `${employee.name || ''} ${employee.lastName || ''}`.trim();

    return {
        id: employee._id,
        name: displayName,
        employeeCode: employee.employeeId || employee.email || '',
        pan,
        uan,
        aadhaar,
        esiNumber,
        panValidation: validatePan(pan),
        uanValidation: validateUan(uan),
        aadhaarValidation: aadhaar ? validateAadhaar(aadhaar) : { valid: false, value: null, message: 'Not on file' },
        esiValidation: esiNumber ? validateEsiNumber(esiNumber) : { valid: false, value: null, message: 'Not on file' },
        taxRegime: fin.taxRegime || employee.taxRegime || null,
        taxDeclaration: fin.taxDeclaration || null,
        joiningDate: employee.joiningDate || employee.dateOfJoining || null,
        state: employee.state || employee.address?.state || null,
        salary: employee.salary,
    };
}

function employeeForHtml(employee, fields) {
    return {
        ...employee,
        panNumber: fields.pan,
        uanNumber: fields.uan,
        aadhaarNumber: fields.aadhaar,
        esiNumber: fields.esiNumber,
        dateOfJoining: fields.joiningDate,
    };
}

async function loadEmployeePayrollYear(organizationId, employeeId, fy) {
    const raw = await Payroll.find({
        organizationId,
        employeeId,
        type: 'monthly',
        year: { $in: [fy.startYear, fy.endYear] },
        status: { $in: ['Processed', 'Paid'] },
    }).sort({ year: 1, month: 1 }).lean();

    const payrolls = raw.filter((p) => isInFinancialYear(p, fy));

    const totals = payrolls.reduce((acc, p) => {
        acc.gross += Number(p.earnings?.totalEarnings || p.basicSalary || 0);
        acc.basic += Number(p.earnings?.basicWage || p.basicSalary || 0);
        acc.pfEmployee += Number(p.deductions?.pfEmployee || 0);
        acc.pfEmployer += Number(p.earnings?.pfEmployer || 0);
        acc.esiEmployee += Number(p.deductions?.esiEmployee || 0);
        acc.esiEmployer += Number(p.earnings?.esiEmployer || 0);
        acc.professionalTax += Number(p.deductions?.professionalTax || 0);
        acc.incomeTax += Number(p.deductions?.incomeTax || 0);
        acc.hra += Number(p.earnings?.houseRentAllowance || 0);
        acc.transport += Number(p.earnings?.transportAllowance || 0);
        acc.medical += Number(p.earnings?.medicalAllowance || 0);
        acc.special += Number(p.earnings?.specialAllowance || 0);
        return acc;
    }, {
        gross: 0, basic: 0, pfEmployee: 0, pfEmployer: 0, esiEmployee: 0,
        esiEmployer: 0, professionalTax: 0, incomeTax: 0, hra: 0,
        transport: 0, medical: 0, special: 0,
    });

    const monthly = payrolls.map((p) => ({
        month: p.month,
        year: p.year,
        monthNumber: monthNumber(p.month),
        gross: Number(p.earnings?.totalEarnings || p.basicSalary || 0),
        basic: Number(p.earnings?.basicWage || p.basicSalary || 0),
        hra: Number(p.earnings?.houseRentAllowance || 0),
        pfEmployee: Number(p.deductions?.pfEmployee || 0),
        pfEmployer: Number(p.earnings?.pfEmployer || 0),
        esiEmployee: Number(p.deductions?.esiEmployee || 0),
        esiEmployer: Number(p.earnings?.esiEmployer || 0),
        professionalTax: Number(p.deductions?.professionalTax || 0),
        incomeTax: Number(p.deductions?.incomeTax || 0),
        net: Number(p.inHandSalary || 0),
        status: p.status,
    }));

    const quarters = [
        { key: 'Q1', label: 'Apr–Jun', months: [4, 5, 6], tds: 0, gross: 0 },
        { key: 'Q2', label: 'Jul–Sep', months: [7, 8, 9], tds: 0, gross: 0 },
        { key: 'Q3', label: 'Oct–Dec', months: [10, 11, 12], tds: 0, gross: 0 },
        { key: 'Q4', label: 'Jan–Mar', months: [1, 2, 3], tds: 0, gross: 0 },
    ];
    for (const row of monthly) {
        const q = quarters.find((item) => item.months.includes(row.monthNumber));
        if (!q) continue;
        q.tds += row.incomeTax;
        q.gross += row.gross;
    }

    return {
        payrolls,
        totals,
        monthly,
        quarters,
        salaryBreakup: {
            basic: totals.basic,
            hra: totals.hra,
            transport: totals.transport,
            medical: totals.medical,
            special: totals.special,
            gross: totals.gross,
        },
    };
}

function buildStatutoryHtml({ title, org, employee, fields, sections = [], extraHtml = '' }) {
    const pan = fields?.pan || employee?.panNumber || 'N/A';
    const uan = fields?.uan || employee?.uanNumber || 'N/A';
    const aadhaar = fields?.aadhaar ? `XXXX-XXXX-${String(fields.aadhaar).slice(-4)}` : 'N/A';
    const rows = sections.map(([label, value]) => (
        `<tr><td style="padding:6px 10px;font-weight:600;background:#f8fafc;width:40%">${label}</td>`
        + `<td style="padding:6px 10px">${value ?? '—'}</td></tr>`
    )).join('');

    return `
        <div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.45">
            <div style="border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:16px">
                <p style="margin:0;font-size:18px;font-weight:700">${org?.name || 'Organization'}</p>
                <p style="margin:4px 0 0;font-size:12px;color:#64748b">${org?.address?.street || ''} ${org?.address?.city || ''} ${org?.address?.state || ''}</p>
            </div>
            <p style="margin:0 0 4px"><strong>Employee:</strong> ${employee?.name || ''} ${employee?.lastName || ''} (${employee?.employeeId || employee?.email || ''})</p>
            <p style="margin:0 0 16px;font-size:13px"><strong>PAN:</strong> ${pan} &nbsp;|&nbsp; <strong>UAN:</strong> ${uan} &nbsp;|&nbsp; <strong>Aadhaar:</strong> ${aadhaar}</p>
            <h3 style="margin:0 0 12px;font-size:16px">${title}</h3>
            <table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px">${rows}</table>
            ${extraHtml}
        </div>
    `;
}

function monthlyTableHtml(monthly = []) {
    if (!monthly.length) return '<p style="margin-top:12px;color:#64748b">No processed payroll months in this FY.</p>';
    const rows = monthly.map((m) => (
        `<tr>
            <td style="padding:4px 8px">${m.month} ${m.year}</td>
            <td style="padding:4px 8px;text-align:right">${inr(m.gross)}</td>
            <td style="padding:4px 8px;text-align:right">${inr(m.incomeTax)}</td>
            <td style="padding:4px 8px;text-align:right">${inr(m.pfEmployee)}</td>
            <td style="padding:4px 8px;text-align:right">${inr(m.esiEmployee)}</td>
        </tr>`
    )).join('');
    return `
        <h4 style="margin:16px 0 8px">Monthly payroll</h4>
        <table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:12px">
            <tr style="background:#f1f5f9">
                <th style="padding:4px 8px;text-align:left">Period</th>
                <th style="padding:4px 8px;text-align:right">Gross</th>
                <th style="padding:4px 8px;text-align:right">TDS</th>
                <th style="padding:4px 8px;text-align:right">PF Emp</th>
                <th style="padding:4px 8px;text-align:right">ESI Emp</th>
            </tr>
            ${rows}
        </table>
    `;
}

async function generateStatutoryPdf(organizationId, { title, bodyHtml, employeeId, docType }) {
    return generateLetterPdf({
        organizationId,
        prefix: 'statutory',
        title,
        bodyHtml,
        fileName: `${docType}-${employeeId}-${Date.now()}.pdf`,
    });
}

async function loadEmployee(organizationId, employeeId) {
    const employee = await Employee.findOne({ _id: employeeId, organizationId }).lean();
    if (!employee) throw new Error('Employee not found');
    return employee;
}

async function buildContext(organizationId, employeeId, options = {}) {
    const employee = await loadEmployee(organizationId, employeeId);
    const fields = resolveEmployeeFields(employee);
    const fy = financialYear(options.fyStartMonth);
    const payroll = await loadEmployeePayrollYear(organizationId, employeeId, fy);
    const org = await Organization.findById(organizationId)
        .select('name address gstin pan panNumber registrationNumber')
        .lean();
    return { employee, fields, fy, payroll, org, htmlEmployee: employeeForHtml(employee, fields) };
}

function buildValidations(fields, extras = {}) {
    return {
        pan: fields.panValidation,
        uan: fields.uanValidation,
        aadhaar: fields.aadhaarValidation,
        esi: fields.esiValidation,
        ...extras,
    };
}

export async function buildTdsSummary(organizationId, employeeId, options = {}) {
    const { employee, fields, fy, payroll, org, htmlEmployee } = await buildContext(organizationId, employeeId, options);
    const { totals, monthly, quarters, salaryBreakup } = payroll;

    const data = {
        financialYear: fy.label,
        employee: fields,
        salaryBreakup,
        monthly,
        quarters,
        summary: {
            grossIncome: totals.gross,
            tdsDeducted: totals.incomeTax,
            professionalTax: totals.professionalTax,
            pfEmployee: totals.pfEmployee,
            netTaxableEstimate: Math.max(0, totals.gross - totals.pfEmployee - totals.esiEmployee),
        },
        validations: buildValidations(fields),
    };

    return {
        docType: 'tds_summary',
        financialYear: fy.label,
        employee: { id: fields.id, name: fields.name, pan: fields.pan },
        summary: data.summary,
        data,
        html: buildStatutoryHtml({
            title: `TDS Summary — ${fy.label}`,
            org,
            employee: htmlEmployee,
            fields,
            sections: [
                ['Gross income (processed payroll)', inr(totals.gross)],
                ['TDS deducted', inr(totals.incomeTax)],
                ['Professional tax', inr(totals.professionalTax)],
                ['PF (employee)', inr(totals.pfEmployee)],
                ['Q1 TDS (Apr–Jun)', inr(quarters[0].tds)],
                ['Q2 TDS (Jul–Sep)', inr(quarters[1].tds)],
                ['Q3 TDS (Oct–Dec)', inr(quarters[2].tds)],
                ['Q4 TDS (Jan–Mar)', inr(quarters[3].tds)],
            ],
            extraHtml: monthlyTableHtml(monthly),
        }),
    };
}

export async function buildForm16(organizationId, employeeId, options = {}) {
    const { employee, fields, fy, payroll, org, htmlEmployee } = await buildContext(organizationId, employeeId, options);
    const { totals, monthly, quarters, salaryBreakup } = payroll;
    const tan = org?.gstin || process.env.ORG_TAN || 'TAN-NOT-CONFIGURED';

    const taxParams = buildIncomeTaxParamsFromEmployee(employee, {
        annualGross: totals.gross,
        annualBasic: totals.basic,
        annualHra: totals.hra,
        annualPfEmployee: totals.pfEmployee,
        annualProfessionalTax: totals.professionalTax,
        month: 3,
        year: fy.endYear,
    });
    const computedTax = computeAnnualIncomeTax(taxParams);
    const declaration = resolveTaxDeclaration(employee, { month: 3, year: fy.endYear });

    const data = {
        financialYear: fy.label,
        employee: fields,
        tan,
        period: { from: `01-Apr-${fy.startYear}`, to: `31-Mar-${fy.endYear}` },
        salaryBreakup,
        monthly,
        quarters,
        tax: {
            regime: formatTaxRegimeLabel(taxParams.taxRegime),
            computedAnnualTax: computedTax,
            tdsDeducted: totals.incomeTax,
            difference: Number(computedTax) - Number(totals.incomeTax),
            params: taxParams,
            declaration,
        },
        validations: buildValidations(fields, {
            panRequired: !fields.panValidation.valid
                ? { valid: false, message: 'Valid PAN required for Form 16' }
                : { valid: true, message: 'PAN on file' },
        }),
    };

    return {
        docType: 'form16',
        financialYear: fy.label,
        tan,
        data,
        html: buildStatutoryHtml({
            title: `Form 16 — Certificate under Section 203 (${fy.label})`,
            org,
            employee: htmlEmployee,
            fields,
            sections: [
                ['Employer TAN', tan],
                ['Employee PAN', fields.pan || 'Not on file'],
                ['Tax regime', data.tax.regime],
                ['Period', `${data.period.from} to ${data.period.to}`],
                ['Gross salary', inr(totals.gross)],
                ['Basic', inr(totals.basic)],
                ['HRA', inr(totals.hra)],
                ['Total TDS deducted', inr(totals.incomeTax)],
                ['Computed annual tax', inr(computedTax)],
                ['TDS vs computed difference', inr(data.tax.difference)],
            ],
            extraHtml: monthlyTableHtml(monthly),
        }),
    };
}

export async function buildForm12ba(organizationId, employeeId, options = {}) {
    const { fields, fy, payroll, org, htmlEmployee } = await buildContext(organizationId, employeeId, options);
    const { totals, salaryBreakup } = payroll;

    const perquisites = [
        { name: 'House Rent Allowance', value: totals.hra },
        { name: 'Transport allowance', value: totals.transport || Number(htmlEmployee?.salary?.transportAllowance || 0) },
        { name: 'Medical allowance', value: totals.medical || Number(htmlEmployee?.salary?.medicalAllowance || 0) },
        { name: 'Special allowance', value: totals.special },
    ];
    const totalPerquisites = perquisites.reduce((sum, p) => sum + Number(p.value || 0), 0);

    const data = {
        financialYear: fy.label,
        employee: fields,
        salaryBreakup,
        perquisites,
        totalPerquisites,
        validations: buildValidations(fields),
    };

    const table = `
        <table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;margin-top:12px;font-size:13px">
            <tr style="background:#f1f5f9"><th style="text-align:left">Perquisite</th><th style="text-align:right">Value (Rs.)</th></tr>
            ${perquisites.map((p) => `<tr><td>${p.name}</td><td style="text-align:right">${Number(p.value).toLocaleString('en-IN')}</td></tr>`).join('')}
            <tr><td style="font-weight:700">Total</td><td style="text-align:right;font-weight:700">${totalPerquisites.toLocaleString('en-IN')}</td></tr>
        </table>
    `;

    return {
        docType: 'form12ba',
        financialYear: fy.label,
        perquisites: perquisites.map((p) => [p.name, p.value]),
        data,
        html: buildStatutoryHtml({
            title: `Form 12BA — Perquisites (${fy.label})`,
            org,
            employee: htmlEmployee,
            fields,
            sections: [['Total perquisites / allowances', inr(totalPerquisites)]],
            extraHtml: table,
        }),
    };
}

export async function buildEpfStatement(organizationId, employeeId, options = {}) {
    const { fields, fy, payroll, org, htmlEmployee } = await buildContext(organizationId, employeeId, options);
    const { totals, monthly } = payroll;

    const data = {
        financialYear: fy.label,
        employee: fields,
        uan: fields.uan,
        monthly: monthly.map((m) => ({
            month: m.month,
            year: m.year,
            employee: m.pfEmployee,
            employer: m.pfEmployer,
            total: m.pfEmployee + m.pfEmployer,
        })),
        summary: {
            employeeContribution: totals.pfEmployee,
            employerContribution: totals.pfEmployer,
            total: totals.pfEmployee + totals.pfEmployer,
        },
        validations: buildValidations(fields),
    };

    return {
        docType: 'epf_statement',
        uan: fields.uan,
        data,
        html: buildStatutoryHtml({
            title: `EPF Statement — ${fy.label}`,
            org,
            employee: htmlEmployee,
            fields,
            sections: [
                ['UAN', fields.uan || 'Not on file'],
                ['UAN validation', fields.uanValidation.message],
                ['Employee contribution', inr(totals.pfEmployee)],
                ['Employer contribution', inr(totals.pfEmployer)],
                ['Total PF', inr(totals.pfEmployee + totals.pfEmployer)],
            ],
            extraHtml: monthlyTableHtml(monthly),
        }),
    };
}

export async function buildEsiStatement(organizationId, employeeId, options = {}) {
    const { fields, fy, payroll, org, htmlEmployee } = await buildContext(organizationId, employeeId, options);
    const { totals, monthly } = payroll;

    const data = {
        financialYear: fy.label,
        employee: fields,
        esiNumber: fields.esiNumber,
        monthly: monthly.map((m) => ({
            month: m.month,
            year: m.year,
            employee: m.esiEmployee,
            employer: m.esiEmployer,
        })),
        summary: {
            employeeContribution: totals.esiEmployee,
            employerContribution: totals.esiEmployer,
            total: totals.esiEmployee + totals.esiEmployer,
        },
        validations: buildValidations(fields),
    };

    return {
        docType: 'esi_statement',
        esiNumber: fields.esiNumber,
        data,
        html: buildStatutoryHtml({
            title: `ESI Statement — ${fy.label}`,
            org,
            employee: htmlEmployee,
            fields,
            sections: [
                ['ESI number', fields.esiNumber || 'Not on file'],
                ['ESI validation', fields.esiValidation.message],
                ['Employee contribution', inr(totals.esiEmployee)],
                ['Employer contribution', inr(totals.esiEmployer)],
            ],
            extraHtml: monthlyTableHtml(monthly),
        }),
    };
}

export async function buildGratuityStatement(organizationId, employeeId) {
    const employee = await loadEmployee(organizationId, employeeId);
    const fields = resolveEmployeeFields(employee);
    const org = await Organization.findById(organizationId).select('name address').lean();
    const htmlEmployee = employeeForHtml(employee, fields);
    const gratuity = estimateGratuityFromEmployee({
        ...employee,
        dateOfJoining: fields.joiningDate,
    });

    const data = {
        employee: fields,
        gratuity,
        validations: buildValidations(fields),
    };

    return {
        docType: 'gratuity_statement',
        gratuity,
        data,
        html: buildStatutoryHtml({
            title: 'Gratuity Statement (Estimate)',
            org,
            employee: htmlEmployee,
            fields,
            sections: [
                ['Eligible', gratuity.eligible ? 'Yes' : 'No'],
                ['Years of service', gratuity.yearsOfService ?? '—'],
                ['Estimated amount', gratuity.eligible ? inr(gratuity.amount) : inr(0)],
                ['Formula', gratuity.formula || gratuity.reason || '—'],
            ],
        }),
    };
}

export async function buildProfessionalTaxSummary(organizationId, employeeId, options = {}) {
    const { fields, fy, payroll, org, htmlEmployee } = await buildContext(organizationId, employeeId, options);
    const { totals, monthly } = payroll;
    const state = fields.state || org?.address?.state || '—';

    const data = {
        financialYear: fy.label,
        employee: fields,
        state,
        monthly: monthly.map((m) => ({ month: m.month, year: m.year, professionalTax: m.professionalTax })),
        summary: { totalProfessionalTax: totals.professionalTax },
        validations: buildValidations(fields),
    };

    return {
        docType: 'professional_tax',
        state,
        data,
        html: buildStatutoryHtml({
            title: `Professional Tax Summary — ${fy.label}`,
            org,
            employee: htmlEmployee,
            fields,
            sections: [
                ['State', state],
                ['Total PT deducted', inr(totals.professionalTax)],
            ],
            extraHtml: monthlyTableHtml(monthly),
        }),
    };
}

export async function buildLwfSummary(organizationId, employeeId) {
    const employee = await loadEmployee(organizationId, employeeId);
    const fields = resolveEmployeeFields(employee);
    const org = await Organization.findById(organizationId).select('name address').lean();
    const htmlEmployee = employeeForHtml(employee, fields);
    const state = fields.state || org?.address?.state || '—';
    const lwfAmount = Number(employee?.salary?.lwf || employee?.salaryStructure?.lwf || 0);

    const data = {
        employee: fields,
        state,
        summary: { lwfAnnualEstimate: lwfAmount },
        validations: buildValidations(fields),
    };

    return {
        docType: 'lwf_summary',
        data,
        html: buildStatutoryHtml({
            title: 'Labour Welfare Fund Summary',
            org,
            employee: htmlEmployee,
            fields,
            sections: [
                ['State', state],
                ['LWF contribution (annual est.)', inr(lwfAmount)],
            ],
        }),
    };
}

export async function buildShopsEstablishmentReport(organizationId) {
    const org = await Organization.findById(organizationId).select('name address registrationNumber').lean();
    const headcount = await Employee.countDocuments({ organizationId, status: { $in: ['active', 'Active'] } });
    const onboardingActive = await Employee.countDocuments({ organizationId, status: 'Onboarding' });
    const missingPan = await Employee.countDocuments({
        organizationId,
        status: { $in: ['active', 'Active'] },
        $or: [
            { 'financialDetails.panNumber': { $in: [null, ''] } },
            { financialDetails: { $exists: false } },
        ],
        panNumber: { $in: [null, ''] },
    });

    const data = {
        organization: {
            name: org?.name,
            registrationNumber: org?.registrationNumber || null,
            address: org?.address || null,
        },
        headcount,
        onboardingActive,
        missingPan,
        generatedAt: new Date().toISOString(),
    };

    const html = `
        <div style="font-family:Segoe UI,Arial,sans-serif">
            <h3>Shops &amp; Establishments Compliance Report</h3>
            <p><strong>${org?.name || ''}</strong></p>
            <p>Registration: ${org?.registrationNumber || '—'}</p>
            <p>Address: ${org?.address?.street || ''} ${org?.address?.city || ''} ${org?.address?.state || ''}</p>
            <table border="1" cellpadding="6" style="border-collapse:collapse;width:100%">
                <tr><td>Active employees</td><td>${headcount}</td></tr>
                <tr><td>Onboarding</td><td>${onboardingActive}</td></tr>
                <tr><td>Active without PAN on file</td><td>${missingPan}</td></tr>
                <tr><td>Generated at</td><td>${data.generatedAt}</td></tr>
            </table>
        </div>
    `;

    return { docType: 'shops_establishment', html, headcount, data };
}

export async function buildInvestmentDeclaration(organizationId, employeeId, options = {}) {
    const { employee, fields, fy, org, htmlEmployee } = await buildContext(organizationId, employeeId, options);
    const declaration = employee.financialDetails?.taxDeclaration || {};
    const section80C = declaration.section80C || {};
    const section80D = declaration.section80D || {};
    const section80E = declaration.section80E || {};
    const section24b = declaration.section24b || {};
    const hra = declaration.hra || {};

    const sections80C = [
        ['PPF', Number(section80C.ppf || 0)],
        ['ELSS', Number(section80C.elss || 0)],
        ['Life Insurance (LIC)', Number(section80C.lic || 0)],
        ['EPF (declared)', Number(section80C.epf || 0)],
        ['Tuition fees', Number(section80C.tuitionFees || 0)],
        ['Home loan principal', Number(section80C.homeLoanPrincipal || 0)],
        ['Other 80C', Number(section80C.other || 0)],
    ];
    const total80C = sections80C.reduce((s, [, v]) => s + v, 0);

    const data = {
        financialYear: declaration.financialYear || fy.label,
        employee: fields,
        taxDeclaration: declaration,
        section80C: Object.fromEntries(sections80C.map(([k, v]) => [k, v])),
        section80CTotal: total80C,
        section80D: {
            selfFamilyPremium: Number(section80D.selfFamilyPremium || 0),
            parentsPremium: Number(section80D.parentsPremium || 0),
            selfSeniorCitizen: Boolean(section80D.selfSeniorCitizen),
            parentsSeniorCitizen: Boolean(section80D.parentsSeniorCitizen),
        },
        section80E: Number(section80E.educationLoanInterest || 0),
        section24b: Number(section24b.homeLoanInterest || 0),
        hra: {
            monthlyRent: Number(hra.monthlyRent || 0),
            landlordPan: hra.landlordPan || null,
            metroCity: Boolean(hra.metroCity),
        },
        updatedAt: declaration.updatedAt || null,
        validations: buildValidations(fields),
    };

    return {
        docType: 'investment_declaration',
        data,
        html: buildStatutoryHtml({
            title: `Investment Declaration (80C / 80D) — ${data.financialYear}`,
            org,
            employee: htmlEmployee,
            fields,
            sections: [
                ...sections80C.map(([label, value]) => [label, inr(value)]),
                ['Total 80C', inr(total80C)],
                ['Health Insurance self/family (80D)', inr(data.section80D.selfFamilyPremium)],
                ['Health Insurance parents (80D)', inr(data.section80D.parentsPremium)],
                ['Education loan interest (80E)', inr(data.section80E)],
                ['Home loan interest (24b)', inr(data.section24b)],
                ['Monthly rent (HRA)', inr(data.hra.monthlyRent)],
                ['Metro city', data.hra.metroCity ? 'Yes' : 'No'],
            ],
        }),
    };
}

export async function buildComplianceReport(organizationId, employeeId, options = {}) {
    const [tds, epf, gratuity] = await Promise.all([
        buildTdsSummary(organizationId, employeeId, options),
        buildEpfStatement(organizationId, employeeId, options),
        buildGratuityStatement(organizationId, employeeId),
    ]);

    const data = {
        tds: tds.data,
        epf: epf.data,
        gratuity: gratuity.data,
        validations: {
            ...tds.data.validations,
            uan: epf.data.validations.uan,
        },
    };

    return {
        docType: 'compliance_report',
        data,
        html: `<h3>Digital Compliance Report</h3>${[tds, epf, gratuity].map((d) => d.html).join('<hr/>')}`,
    };
}

async function buildStatutoryDocument(organizationId, { docType, employeeId }, options = {}) {
    if (!STATUTORY_DOC_TYPES.includes(docType)) throw new Error(`Unknown statutory document: ${docType}`);
    if (!organizationId) throw new Error('Organization is required');
    if (docType !== 'shops_establishment' && !employeeId) {
        throw new Error('Select an employee to generate this document');
    }

    switch (docType) {
        case 'form16': return buildForm16(organizationId, employeeId, options);
        case 'form12ba': return buildForm12ba(organizationId, employeeId, options);
        case 'tds_summary': return buildTdsSummary(organizationId, employeeId, options);
        case 'epf_statement': return buildEpfStatement(organizationId, employeeId, options);
        case 'esi_statement': return buildEsiStatement(organizationId, employeeId, options);
        case 'gratuity_statement': return buildGratuityStatement(organizationId, employeeId);
        case 'professional_tax': return buildProfessionalTaxSummary(organizationId, employeeId, options);
        case 'lwf_summary': return buildLwfSummary(organizationId, employeeId);
        case 'shops_establishment': return buildShopsEstablishmentReport(organizationId);
        case 'investment_declaration': return buildInvestmentDeclaration(organizationId, employeeId, options);
        case 'compliance_report': return buildComplianceReport(organizationId, employeeId, options);
        default: throw new Error('Unsupported document type');
    }
}

export async function previewStatutoryDocument(organizationId, { docType, employeeId, fyStartMonth } = {}) {
    const built = await buildStatutoryDocument(organizationId, { docType, employeeId }, { fyStartMonth });
    return {
        docType: built.docType,
        financialYear: built.financialYear || built.data?.financialYear || financialYear().label,
        data: built.data || null,
        html: built.html,
        preview: true,
    };
}

async function saveStatutoryDocumentRecord({
    organizationId,
    employeeId,
    docType,
    pdf,
    actor,
    requireApproval = false,
}) {
    if (!employeeId || !pdf?.url) return null;
    const uploader = actor?._id || actor;
    if (!uploader) return null;

    const fileSize = pdf.fullPath && fs.existsSync(pdf.fullPath) ? fs.statSync(pdf.fullPath).size : 1;
    const docName = String(docType).replace(/_/g, ' ').toUpperCase();
    const approvalStatus = requireApproval ? 'Pending' : 'Approved';
    const verificationStatus = requireApproval ? 'Pending' : 'Approved';

    const existing = await Document.findOne({
        organizationId,
        relatedId: employeeId,
        tags: { $all: ['statutory', docType] },
        isActive: { $ne: false },
    }).sort({ version: -1, createdAt: -1 });

    if (existing) {
        if (!existing.previousVersions) existing.previousVersions = [];
        existing.previousVersions.push({
            fileUrl: existing.fileUrl,
            fileName: existing.fileName,
            version: existing.version || 1,
            uploadedAt: existing.updatedAt || existing.createdAt || new Date(),
            uploadedBy: existing.uploadedBy,
            fileSize: existing.fileSize,
            mimeType: existing.mimeType,
        });
        existing.fileUrl = pdf.url;
        existing.fileName = pdf.fileName;
        existing.fileSize = fileSize;
        existing.mimeType = 'application/pdf';
        existing.version = (existing.version || 1) + 1;
        existing.uploadedBy = uploader;
        existing.approvalStatus = approvalStatus;
        existing.verificationStatus = verificationStatus;
        existing.requiresApproval = Boolean(requireApproval);
        existing.tags = ['statutory', docType];
        existing.name = docName;
        await existing.save();
        return existing.toObject();
    }

    const created = await Document.create({
        organizationId,
        name: docName,
        category: 'Compliance',
        type: 'PDF',
        fileUrl: pdf.url,
        fileName: pdf.fileName,
        fileSize,
        mimeType: 'application/pdf',
        relatedTo: 'Employee',
        relatedId: employeeId,
        relatedToModel: 'Employee',
        verificationStatus,
        approvalStatus,
        requiresApproval: Boolean(requireApproval),
        version: 1,
        tags: ['statutory', docType],
        uploadedBy: uploader,
    });
    return created.toObject?.() || created;
}

export async function generateStatutoryDocument(
    organizationId,
    { docType, employeeId, requireApproval = false, fyStartMonth } = {},
    { actor, req } = {}
) {
    const built = await buildStatutoryDocument(organizationId, { docType, employeeId }, { fyStartMonth });

    const pdf = await generateStatutoryPdf(organizationId, {
        title: String(docType || 'statutory').replace(/_/g, ' ').toUpperCase(),
        bodyHtml: built.html,
        employeeId: employeeId || 'org',
        docType,
    });

    let documentRecord = null;
    try {
        documentRecord = await saveStatutoryDocumentRecord({
            organizationId,
            employeeId,
            docType,
            pdf,
            actor,
            requireApproval,
        });
    } catch (docErr) {
        console.warn('Statutory document library save skipped:', docErr.message);
    }

    await logLifecycleAudit({
        action: 'Generate',
        entityType: 'StatutoryDocument',
        entityId: employeeId || organizationId,
        entityName: docType,
        actor,
        req,
        metadata: {
            docType,
            pdfUrl: pdf.url,
            requireApproval: Boolean(requireApproval),
            documentId: documentRecord?._id,
            version: documentRecord?.version,
        },
    }).catch(() => {});

    return {
        ...built,
        pdfUrl: pdf.url || pdf.pdfUrl,
        fileName: pdf.fileName || pdf.pdfFileName,
        document: documentRecord,
        requireApproval: Boolean(requireApproval),
        approvalStatus: documentRecord?.approvalStatus || (requireApproval ? 'Pending' : 'Approved'),
    };
}

export async function bulkGenerateStatutoryDocuments(
    organizationId,
    { docType, employeeIds = [], requireApproval = false, fyStartMonth } = {},
    ctx = {}
) {
    if (!STATUTORY_DOC_TYPES.includes(docType)) throw new Error(`Unknown statutory document: ${docType}`);
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
        throw new Error('employeeIds array is required');
    }

    const results = [];
    for (const employeeId of employeeIds) {
        try {
            const result = await generateStatutoryDocument(
                organizationId,
                { docType, employeeId, requireApproval, fyStartMonth },
                ctx
            );
            results.push({
                employeeId,
                success: true,
                pdfUrl: result.pdfUrl,
                documentId: result.document?._id,
                approvalStatus: result.approvalStatus,
            });
        } catch (error) {
            results.push({
                employeeId,
                success: false,
                message: error.message || 'Generation failed',
            });
        }
    }

    await logLifecycleAudit({
        action: 'BulkGenerate',
        entityType: 'StatutoryDocument',
        entityId: organizationId,
        entityName: docType,
        actor: ctx.actor,
        req: ctx.req,
        metadata: {
            docType,
            total: employeeIds.length,
            succeeded: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            requireApproval: Boolean(requireApproval),
        },
    }).catch(() => {});

    return {
        docType,
        total: results.length,
        succeeded: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
    };
}

export async function listEmployeeStatutoryDocuments(organizationId, employeeId) {
    return Document.find({
        organizationId,
        relatedId: employeeId,
        tags: { $in: ['statutory'] },
    }).sort({ createdAt: -1 }).lean();
}

export async function listStatutoryHistory(organizationId, { docType, employeeId, limit = 50 } = {}) {
    const query = {
        organizationId,
        tags: { $in: ['statutory'] },
    };
    if (employeeId) query.relatedId = employeeId;
    if (docType) query.tags = { $all: ['statutory', docType] };

    const docs = await Document.find(query)
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(Math.min(Number(limit) || 50, 200))
        .populate('uploadedBy', 'name lastName email')
        .populate('relatedId', 'name lastName employeeId email')
        .lean();

    return docs.map((doc) => ({
        ...doc,
        docType: (doc.tags || []).find((t) => STATUTORY_DOC_TYPES.includes(t)) || null,
        versionCount: 1 + (doc.previousVersions?.length || 0),
    }));
}

export async function getStatutoryOrgDashboard(organizationId) {
    const fy = financialYear();
    const [activeEmployees, recentDocs, pendingApproval, byType] = await Promise.all([
        Employee.countDocuments({ organizationId, status: { $in: ['active', 'Active'] } }),
        Document.find({
            organizationId,
            tags: { $in: ['statutory'] },
        }).sort({ createdAt: -1 }).limit(10).lean(),
        Document.countDocuments({
            organizationId,
            tags: { $in: ['statutory'] },
            approvalStatus: 'Pending',
        }),
        Document.aggregate([
            { $match: { organizationId, tags: 'statutory' } },
            { $project: { tags: 1, approvalStatus: 1 } },
            {
                $addFields: {
                    docType: {
                        $first: {
                            $filter: {
                                input: '$tags',
                                as: 't',
                                cond: { $ne: ['$$t', 'statutory'] },
                            },
                        },
                    },
                },
            },
            {
                $group: {
                    _id: '$docType',
                    count: { $sum: 1 },
                    pending: {
                        $sum: { $cond: [{ $eq: ['$approvalStatus', 'Pending'] }, 1, 0] },
                    },
                },
            },
            { $sort: { count: -1 } },
        ]),
    ]);

    const employees = await Employee.find({
        organizationId,
        status: { $in: ['active', 'Active'] },
    }).select('financialDetails.panNumber financialDetails.epfUan panNumber epfUan').lean();

    let missingPan = 0;
    let missingUan = 0;
    let invalidPan = 0;
    let invalidUan = 0;
    for (const emp of employees) {
        const fields = resolveEmployeeFields(emp);
        if (!fields.pan) missingPan += 1;
        else if (!fields.panValidation.valid) invalidPan += 1;
        if (!fields.uan) missingUan += 1;
        else if (!fields.uanValidation.valid) invalidUan += 1;
    }

    return {
        financialYear: fy,
        modules: STATUTORY_MODULES,
        totals: {
            activeEmployees,
            statutoryDocuments: byType.reduce((s, row) => s + row.count, 0),
            pendingApproval,
            missingPan,
            missingUan,
            invalidPan,
            invalidUan,
        },
        byType: byType.map((row) => ({
            docType: row._id,
            count: row.count,
            pending: row.pending,
            module: STATUTORY_MODULES.find((m) => m.key === row._id) || null,
        })),
        recent: recentDocs,
    };
}
