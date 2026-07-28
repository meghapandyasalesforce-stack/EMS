import {
    rowsToCsv,
    rowsToExcelHtml,
    LIFECYCLE_REPORT_CATEGORIES,
} from '../../services/lifecycleReportsService.js';

describe('lifecycleReportsService', () => {
    it('exports csv with escaped values', () => {
        const csv = rowsToCsv(
            [{ key: 'name', label: 'Name' }, { key: 'note', label: 'Note' }],
            [{ name: 'Test', note: 'has "quotes"' }],
        );
        expect(csv).toContain('"has ""quotes"""');
        expect(csv.split('\n')).toHaveLength(2);
    });

    it('exports excel html table', () => {
        const html = rowsToExcelHtml('Test', [{ key: 'a', label: 'A' }], [{ a: 1 }]);
        expect(html).toContain('<table');
        expect(html).toContain('<td>1</td>');
    });

    it('defines all report categories', () => {
        expect(LIFECYCLE_REPORT_CATEGORIES).toContain('joiningTrend');
        expect(LIFECYCLE_REPORT_CATEGORIES).toContain('turnover');
        expect(LIFECYCLE_REPORT_CATEGORIES).toContain('fnf');
        expect(LIFECYCLE_REPORT_CATEGORIES).toContain('avgOnboardingTime');
        expect(LIFECYCLE_REPORT_CATEGORIES).toContain('knowledgeTransfer');
    });
});
