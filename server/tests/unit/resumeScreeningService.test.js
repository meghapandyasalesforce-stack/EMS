import { describe, it, expect } from '@jest/globals';
import { Document, Packer, Paragraph } from 'docx';
import { jsPDF } from 'jspdf';
import {
    calculateKeywordMatch,
    evaluateScreeningDecision,
    extractTextFromBuffer,
    hasMeaningfulKeywordMatch,
    isTrivialResumeText,
    keywordPresent,
    normalizeKeywordList,
    normalizeMinimumMatchPercent,
    normalizeResumeScreening,
    normalizeResumeText,
    reconcileScreeningFields,
    resolveMinimumMatchPercent,
    shouldSkipBlindForceRescreen,
} from '../../services/resumeScreeningService.js';
import { scoreJobTitleMatch } from '../../services/resumeInboxService.js';

const MERN_REQUIRED = ['React', 'Node.js', 'MongoDB'];
const MERN_OPTIONAL = ['Express', 'JavaScript'];

function screenDecision(resumeText, criteria, minimumMatchPercent = 70) {
    const result = calculateKeywordMatch(resumeText, criteria, {
        requiredKeywordWeight: 1,
        optionalKeywordWeight: 0.5,
    });
    const decision = evaluateScreeningDecision(result, minimumMatchPercent);
    return { result, decision };
}

function createPdfBuffer(text) {
    const doc = new jsPDF();
    doc.text(text, 10, 10);
    return Buffer.from(doc.output('arraybuffer'));
}

async function createDocxBuffer(text) {
    const doc = new Document({
        sections: [{
            children: [new Paragraph(text)],
        }],
    });
    return Buffer.from(await Packer.toBuffer(doc));
}

describe('resumeScreeningService', () => {
    describe('normalizeResumeText', () => {
        it('normalizes spacing and case without removing technical punctuation', () => {
            expect(normalizeResumeText(' React.js \n NODE.JS\tMongoDB  C++  '))
                .toBe('react.js node.js mongodb c++');
        });

        it('strips pdf-parse page markers so they cannot inflate content', () => {
            expect(normalizeResumeText('hello -- 1 of 1 --')).toBe('hello');
        });
    });

    describe('isTrivialResumeText', () => {
        it('flags hello-only and other joke resumes as trivial', () => {
            expect(isTrivialResumeText('hello')).toBe(true);
            expect(isTrivialResumeText('hello -- 1 of 1 --')).toBe(true);
            expect(isTrivialResumeText('hi')).toBe(true);
            expect(isTrivialResumeText('')).toBe(true);
        });

        it('does not flag a normal skills resume as trivial', () => {
            expect(isTrivialResumeText('React Node.js MongoDB Express JavaScript developer')).toBe(false);
        });
    });

    describe('keywordPresent', () => {
        it('matches common technical keyword variations', () => {
            const text = normalizeResumeText('Worked on React JS, Nodejs, MongoDB, .NET Core and C# APIs');
            expect(keywordPresent(text, 'react.js')).toBe(true);
            expect(keywordPresent(text, 'node.js')).toBe(true);
            expect(keywordPresent(text, '.net')).toBe(true);
            expect(keywordPresent(text, 'c#')).toBe(true);
        });

        it('matches Node.js/React.js against bare Node/React tokens', () => {
            const text = normalizeResumeText('Javascript,Node,React,Express');
            expect(keywordPresent(text, 'node.js')).toBe(true);
            expect(keywordPresent(text, 'react.js')).toBe(true);
            expect(keywordPresent(text, 'express.js')).toBe(true);
            expect(keywordPresent(text, 'javascript')).toBe(true);
        });

        it('avoids broad false positives like java inside javascript', () => {
            const text = normalizeResumeText('Built frontend apps using JavaScript and TypeScript');
            expect(keywordPresent(text, 'java')).toBe(false);
            expect(keywordPresent(text, 'javascript')).toBe(true);
        });
    });

    describe('normalizeKeywordList', () => {
        it('1) splits comma-separated string', () => {
            expect(normalizeKeywordList('React,Node.js,MongoDB'))
                .toEqual(['React', 'Node.js', 'MongoDB']);
        });

        it('2) splits newline-separated string', () => {
            expect(normalizeKeywordList('React\nNode.js\nMongoDB'))
                .toEqual(['React', 'Node.js', 'MongoDB']);
        });

        it('3) splits semicolon-separated string', () => {
            expect(normalizeKeywordList('React;Node.js;MongoDB'))
                .toEqual(['React', 'Node.js', 'MongoDB']);
        });

        it('4) splits mixed separators', () => {
            expect(normalizeKeywordList('React, Node.js\nMongoDB; Express'))
                .toEqual(['React', 'Node.js', 'MongoDB', 'Express']);
        });

        it('5) splits CSV values inside array elements', () => {
            expect(normalizeKeywordList(['React,Node.js', 'MongoDB']))
                .toEqual(['React', 'Node.js', 'MongoDB']);
        });

        it('6) dedupes case-insensitively preserving first casing', () => {
            expect(normalizeKeywordList('React,react, React')).toEqual(['React']);
        });

        it('7) drops empty values', () => {
            expect(normalizeKeywordList('React,,Node.js, ,MongoDB'))
                .toEqual(['React', 'Node.js', 'MongoDB']);
        });

        it('legacy bad DB composite keyword expands before match (requiredTotal = 5)', () => {
            const result = calculateKeywordMatch(
                'React Node JavaScript Express Mongo skills',
                {
                    requiredKeywords: ['React,Node,JavaScript,Express,Mongo'],
                    optionalKeywords: [],
                }
            );
            expect(result.requiredTotal).toBe(5);
            expect(result.requiredMatchPercent).toBe(100);
            expect(result.matchedKeywords).toEqual([
                'react', 'node', 'javascript', 'express', 'mongo',
            ]);
        });

        it('screening: 4/5 required at min 2% → Approved', () => {
            const { result, decision } = screenDecision(
                'React Node.js JavaScript Express developer',
                {
                    requiredKeywords: ['React', 'Node.js', 'JavaScript', 'Express', 'MongoDB'],
                    optionalKeywords: [],
                },
                2
            );
            expect(result.requiredMatchPercent).toBe(80);
            expect(decision.passed).toBe(true);
        });

        it('screening: 2/5 required at min 70% → Rejected', () => {
            const { result, decision } = screenDecision(
                'React and Node experience',
                {
                    requiredKeywords: 'React,Node.js,JavaScript,Express,MongoDB',
                    optionalKeywords: [],
                },
                70
            );
            expect(result.requiredTotal).toBe(5);
            expect(result.requiredMatchPercent).toBe(40);
            expect(decision.passed).toBe(false);
        });

        it('optional missing does not reject when required pass threshold', () => {
            const { decision } = screenDecision(
                'React Node.js MongoDB',
                {
                    requiredKeywords: ['React', 'Node.js', 'MongoDB'],
                    optionalKeywords: ['AWS', 'Docker'],
                },
                70
            );
            expect(decision.passed).toBe(true);
        });
    });

    describe('normalizeMinimumMatchPercent', () => {
        it('falls back only for empty/invalid values — never overrides a valid job %', () => {
            expect(normalizeMinimumMatchPercent('', 70)).toBe(70);
            expect(normalizeMinimumMatchPercent(undefined, 70)).toBe(70);
            expect(normalizeMinimumMatchPercent(NaN, 70)).toBe(70);
            expect(normalizeMinimumMatchPercent(null, 70)).toBe(70);
            expect(normalizeMinimumMatchPercent(70, 70)).toBe(70);
        });

        it('preserves low valid thresholds including 2% and 0%', () => {
            expect(normalizeMinimumMatchPercent(2, 70)).toBe(2);
            expect(normalizeMinimumMatchPercent('2', 70)).toBe(2);
            expect(normalizeMinimumMatchPercent('2%', 70)).toBe(2);
            expect(normalizeMinimumMatchPercent(0, 70)).toBe(0);
            expect(normalizeMinimumMatchPercent('0', 70)).toBe(0);
        });

        it('clamps out-of-range values', () => {
            expect(normalizeMinimumMatchPercent(-5, 70)).toBe(0);
            expect(normalizeMinimumMatchPercent(150, 70)).toBe(100);
        });

        it('resolveMinimumMatchPercent prefers job criteria over org default 70', () => {
            expect(resolveMinimumMatchPercent({ minimumMatchPercent: 2 }, { defaultMinimumMatchPercent: 70 })).toBe(2);
            expect(resolveMinimumMatchPercent({ minimumMatchPercent: '2%' }, { defaultMinimumMatchPercent: 70 })).toBe(2);
            expect(resolveMinimumMatchPercent({}, { defaultMinimumMatchPercent: 70 })).toBe(70);
            expect(resolveMinimumMatchPercent({ minimumMatchPercent: null }, { defaultMinimumMatchPercent: 55 })).toBe(55);
        });
    });

    describe('job minimumMatchPercent pass/fail (source of truth)', () => {
        const criteria = {
            requiredKeywords: MERN_REQUIRED,
            optionalKeywords: MERN_OPTIONAL,
        };
        const twoOfThree = 'React Node.js Express JavaScript'; // MongoDB missing → 66.7%

        it('1) Minimum = 2%, match = 66.7% → Approved', () => {
            const { result, decision } = screenDecision(twoOfThree, criteria, 2);
            expect(result.requiredMatchPercent).toBeCloseTo(66.7, 1);
            expect(decision.minRequired).toBe(2);
            expect(decision.passed).toBe(true);
        });

        it('2) Minimum = 70%, match = 66.7% → Rejected', () => {
            const { result, decision } = screenDecision(twoOfThree, criteria, 70);
            expect(result.requiredMatchPercent).toBeCloseTo(66.7, 1);
            expect(decision.minRequired).toBe(70);
            expect(decision.passed).toBe(false);
        });

        it('3) Minimum = 70%, match = 100% → Approved', () => {
            const { result, decision } = screenDecision(
                'React Node.js MongoDB Express JavaScript',
                criteria,
                70
            );
            expect(result.requiredMatchPercent).toBe(100);
            expect(decision.passed).toBe(true);
        });

        it('4) Minimum = 2%, match = 0% → Rejected', () => {
            const { result, decision } = screenDecision('Sales marketing excel', criteria, 2);
            expect(result.requiredMatchPercent).toBe(0);
            expect(decision.minRequired).toBe(2);
            expect(decision.passed).toBe(false);
        });

        it('5) required keywords missing — pass/fail follows actual % vs job threshold', () => {
            const { decision: rejectAt70 } = screenDecision('React only', criteria, 70);
            expect(rejectAt70.thresholdScore).toBeCloseTo(33.3, 1);
            expect(rejectAt70.passed).toBe(false);

            const { decision: passAt2 } = screenDecision('React only', criteria, 2);
            expect(passAt2.thresholdScore).toBeCloseTo(33.3, 1);
            expect(passAt2.passed).toBe(true);
        });

        it('6) optional keywords must not change required-keyword pass/fail', () => {
            const withoutOptional = screenDecision('React Node.js', {
                requiredKeywords: MERN_REQUIRED,
                optionalKeywords: [],
            }, 70);
            const withOptionalHits = screenDecision('React Node.js Express JavaScript', {
                requiredKeywords: MERN_REQUIRED,
                optionalKeywords: MERN_OPTIONAL,
            }, 70);
            expect(withoutOptional.result.requiredMatchPercent).toBeCloseTo(66.7, 1);
            expect(withOptionalHits.result.requiredMatchPercent).toBeCloseTo(66.7, 1);
            expect(withoutOptional.decision.passed).toBe(false);
            expect(withOptionalHits.decision.passed).toBe(false);

            const passWithOptionalAt2 = screenDecision('React Node.js Express JavaScript', {
                requiredKeywords: MERN_REQUIRED,
                optionalKeywords: MERN_OPTIONAL,
            }, 2);
            expect(passWithOptionalAt2.decision.passed).toBe(true);
        });
    });

    describe('normalizeResumeScreening (single display source of truth)', () => {
        it('maps passed → Approved and failed → Rejected consistently', () => {
            expect(normalizeResumeScreening({ status: 'passed', decision: 'approved' }).label).toBe('Approved');
            expect(normalizeResumeScreening({ status: 'failed', decision: 'rejected' }).label).toBe('Rejected');
            expect(normalizeResumeScreening({ status: 'pending' }).label).toBe('Pending - Not Screened');
        });

        it('maps legacy skipped to Pending - Not Screened (never Approved)', () => {
            const n = normalizeResumeScreening({ status: 'skipped', decision: 'approved', matchScore: 0 });
            expect(n.status).toBe('pending');
            expect(n.decision).toBe('pending');
            expect(n.label).toBe('Pending - Not Screened');
            expect(n.isApproved).toBe(false);
        });

        it('status wins over conflicting decision', () => {
            expect(normalizeResumeScreening({ status: 'failed', decision: 'approved' }).decision).toBe('rejected');
            expect(normalizeResumeScreening({ status: 'passed', decision: 'rejected' }).decision).toBe('approved');
        });

        it('reconcileScreeningFields normalizes skipped and decisions', () => {
            expect(reconcileScreeningFields({ status: 'skipped', decision: 'approved' })).toEqual(
                expect.objectContaining({ status: 'pending', decision: 'pending' })
            );
            expect(reconcileScreeningFields({ status: 'passed', decision: 'rejected' }).decision).toBe('approved');
        });
    });

    describe('end-to-end decision cases (Tests 1–7)', () => {
        const criteria = {
            requiredKeywords: MERN_REQUIRED,
            optionalKeywords: MERN_OPTIONAL,
        };

        it('Test 1: full match → APPROVED', () => {
            const { decision } = screenDecision('React Node.js MongoDB', criteria, 70);
            expect(decision.passed).toBe(true);
            expect(normalizeResumeScreening({ status: decision.passed ? 'passed' : 'failed', matchScore: 100 }).label).toMatch(/^Approved/);
        });

        it('Test 2: 2/3 at 70% → REJECTED', () => {
            const { result, decision } = screenDecision('React Node.js', criteria, 70);
            expect(result.requiredMatchPercent).toBeCloseTo(66.7, 1);
            expect(decision.passed).toBe(false);
        });

        it('Test 3: no match → REJECTED', () => {
            const { decision } = screenDecision('Java Python PHP', criteria, 70);
            expect(decision.passed).toBe(false);
        });

        it('Test 4: optional missing does not reject', () => {
            const { decision } = screenDecision('React Node.js MongoDB', {
                requiredKeywords: MERN_REQUIRED,
                optionalKeywords: ['AWS', 'Docker'],
            }, 70);
            expect(decision.passed).toBe(true);
        });

        it('Test 5: no screening config → not auto-approved (0 score, pending path)', () => {
            const { result, decision } = screenDecision('Anything', { requiredKeywords: [], optionalKeywords: [] }, 70);
            expect(result.requiredTotal).toBe(0);
            expect(result.matchScore).toBe(0);
            expect(decision.passed).toBe(false);
            expect(normalizeResumeScreening({ status: 'pending' }).label).toBe('Pending - Not Screened');
        });

        it('Test 6: unassigned / not screened display is Pending not Approved/Rejected', () => {
            const n = normalizeResumeScreening({
                status: 'pending',
                decision: 'pending',
                reason: 'Unable to determine matching job',
                matchScore: 0,
            });
            expect(n.label).toBe('Pending - Not Screened');
            expect(n.isApproved).toBe(false);
            expect(n.isRejected).toBe(false);
        });

        it('Test 7: meaningful match is eligible for job assignment then normal pass/fail', () => {
            const result = calculateKeywordMatch('React Node.js MongoDB Express', criteria);
            expect(hasMeaningfulKeywordMatch(result)).toBe(true);
            expect(evaluateScreeningDecision(result, 70).passed).toBe(true);
        });

        it('1/3 required → Rejected', () => {
            const { decision } = screenDecision('React only', criteria, 70);
            expect(decision.passed).toBe(false);
            expect(decision.thresholdScore).toBeCloseTo(33.3, 1);
        });

        it('empty extraction maps to Pending display (not Rejected - 0%)', () => {
            const n = normalizeResumeScreening({
                status: 'pending',
                decision: 'pending',
                reason: 'Resume text could not be extracted',
                matchScore: null,
            });
            expect(n.isPending).toBe(true);
            expect(n.isRejected).toBe(false);
            expect(n.label).toBe('Pending - Not Screened');
        });

        it('Mongo DB / JS aliases match without Java→JavaScript false positive', () => {
            const text = normalizeResumeText('Mongo DB, JS, TypeScript');
            expect(keywordPresent(text, 'mongodb')).toBe(true);
            expect(keywordPresent(text, 'javascript')).toBe(true);
            expect(keywordPresent(text, 'typescript')).toBe(true);
            expect(keywordPresent(normalizeResumeText('Built with JavaScript'), 'java')).toBe(false);
        });
    });

    describe('calculateKeywordMatch', () => {
        it('passes required keywords even when optional keywords are missing', () => {
            const result = calculateKeywordMatch(
                'React Node.js MongoDB',
                {
                    requiredKeywords: ['React', 'Node.js', 'MongoDB'],
                    optionalKeywords: ['AWS', 'Docker'],
                },
                { requiredKeywordWeight: 1, optionalKeywordWeight: 0.5 }
            );

            expect(result.requiredMatchPercent).toBe(100);
            expect(result.optionalMatchPercent).toBe(0);
            expect(result.matchScore).toBe(100);
            expect(result.matchedKeywords).toEqual(['react', 'node.js', 'mongodb']);
            expect(result.missingKeywords).toEqual([]);
        });

        it('passes required Node.js style keywords against bare Node/React text', () => {
            const result = calculateKeywordMatch(
                'Javascript,Node,React,Express',
                {
                    requiredKeywords: ['JavaScript', 'Node.js', 'React.js', 'Express.js'],
                    optionalKeywords: ['AWS'],
                },
                { requiredKeywordWeight: 1, optionalKeywordWeight: 0.5 }
            );

            expect(result.requiredMatchPercent).toBe(100);
            expect(result.matchScore).toBe(100);
            expect(result.missingKeywords).toEqual([]);
        });

        it('fails only on missing required keywords threshold, not optional ones', () => {
            const result = calculateKeywordMatch(
                'React Node.js',
                {
                    requiredKeywords: ['React', 'Node.js', 'MongoDB'],
                    optionalKeywords: ['AWS', 'Docker'],
                },
                { requiredKeywordWeight: 1, optionalKeywordWeight: 0.5 }
            );

            expect(result.requiredMatchPercent).toBeCloseTo(66.7, 1);
            expect(result.optionalMatchPercent).toBe(0);
            expect(result.matchScore).toBeCloseTo(66.7, 1);
            expect(result.missingKeywords).toEqual(['mongodb']);
        });

        it('uses optional keyword score when no required keywords are configured', () => {
            const result = calculateKeywordMatch(
                'AWS Docker',
                {
                    requiredKeywords: [],
                    optionalKeywords: ['AWS', 'Docker', 'Kubernetes'],
                },
                { requiredKeywordWeight: 1, optionalKeywordWeight: 0.5 }
            );

            expect(result.requiredTotal).toBe(0);
            expect(result.requiredMatchPercent).toBe(0);
            expect(result.optionalMatchPercent).toBeCloseTo(66.7, 1);
            expect(result.matchScore).toBeCloseTo(66.7, 1);
            expect(evaluateScreeningDecision(result, 70).passed).toBe(false);
            expect(evaluateScreeningDecision(result, 60).passed).toBe(true);
        });

        it('passes the MERN resume required keywords at 100% with optional present', () => {
            const resumeText = [
                'MERN',
                'MongoDB',
                'Express.js',
                'React.js',
                'Node.js',
                'JavaScript',
            ].join('\n');

            const result = calculateKeywordMatch(
                resumeText,
                {
                    requiredKeywords: ['React', 'Node.js', 'MongoDB'],
                    optionalKeywords: ['Express', 'JavaScript'],
                },
                { requiredKeywordWeight: 1, optionalKeywordWeight: 0.5 }
            );

            expect(result.matchedKeywords).toEqual(['react', 'node.js', 'mongodb']);
            expect(result.missingKeywords).toEqual([]);
            expect(result.requiredMatchPercent).toBe(100);
            expect(result.matchScore).toBe(100);
            expect(result.requiredMatchPercent >= 70).toBe(true);
            expect(hasMeaningfulKeywordMatch(result)).toBe(true);
        });

        it('treats zero-match results as not meaningful for auto-match assignment', () => {
            const result = calculateKeywordMatch(
                'Sales marketing excel',
                {
                    requiredKeywords: ['React', 'Node.js', 'MongoDB'],
                    optionalKeywords: ['Express', 'JavaScript'],
                }
            );
            expect(result.matchScore).toBe(0);
            expect(hasMeaningfulKeywordMatch(result)).toBe(false);
        });

        it('does not treat optional-only hits as meaningful when required keywords exist', () => {
            const result = calculateKeywordMatch(
                'Express JavaScript',
                {
                    requiredKeywords: ['React', 'Node.js', 'MongoDB'],
                    optionalKeywords: ['Express', 'JavaScript'],
                }
            );
            expect(result.matchedKeywords).toEqual([]);
            expect(result.optionalMatched.length).toBeGreaterThan(0);
            expect(hasMeaningfulKeywordMatch(result)).toBe(false);
            expect(evaluateScreeningDecision(result, 70).passed).toBe(false);
        });
    });

    describe('inbox duplicate independence + pending rules', () => {
        const criteria = {
            requiredKeywords: MERN_REQUIRED,
            optionalKeywords: MERN_OPTIONAL,
        };
        const twoOfThree = 'React Node.js Express';

        it('Test 1: MERN min 2% with 2/3 → Approved - 66.7%', () => {
            const { result, decision } = screenDecision(twoOfThree, criteria, 2);
            expect(result.requiredMatchPercent).toBeCloseTo(66.7, 1);
            expect(decision.passed).toBe(true);
            const label = normalizeResumeScreening({
                status: 'passed',
                decision: 'approved',
                requiredMatchPercent: result.requiredMatchPercent,
            }).label;
            expect(label).toBe('Approved - 66.7%');
        });

        it('Test 2: duplicate flag does not change Approved - 66.7%', () => {
            const { result, decision } = screenDecision(twoOfThree, criteria, 2);
            expect(decision.passed).toBe(true);
            // Duplicate is display-only; screening decision is identical
            const screening = normalizeResumeScreening({
                status: 'passed',
                decision: 'approved',
                requiredMatchPercent: result.requiredMatchPercent,
            });
            expect(screening.label).toBe('Approved - 66.7%');
            expect(`Duplicate - ${screening.label}`).toBe('Duplicate - Approved - 66.7%');
        });

        it('Test 3: duplicate + min 70% → Duplicate - Rejected - 66.7%', () => {
            const { result, decision } = screenDecision(twoOfThree, criteria, 70);
            expect(decision.passed).toBe(false);
            expect(result.requiredMatchPercent).toBeCloseTo(66.7, 1);
            const screening = normalizeResumeScreening({
                status: 'failed',
                decision: 'rejected',
                requiredMatchPercent: result.requiredMatchPercent,
            });
            expect(`Duplicate - ${screening.label}`).toBe('Duplicate - Rejected - 66.7%');
        });

        it('Test 4: no required keywords matched → Rejected - 0%', () => {
            const { result, decision } = screenDecision('Sales marketing excel', criteria, 2);
            expect(result.requiredMatchPercent).toBe(0);
            expect(decision.passed).toBe(false);
            expect(normalizeResumeScreening({
                status: 'failed',
                decision: 'rejected',
                requiredMatchPercent: 0,
            }).label).toBe('Rejected - 0%');
        });

        it('Test 5: extraction failure display is Pending - Not Screened (not Rejected - 0%)', () => {
            const n = normalizeResumeScreening({
                status: 'pending',
                decision: 'pending',
                reason: 'Resume text could not be extracted',
                matchScore: null,
                requiredMatchPercent: null,
            });
            expect(n.label).toBe('Pending - Not Screened');
            expect(n.isRejected).toBe(false);
        });

        it('Test 6: no job identified display is Pending - Not Screened', () => {
            const n = normalizeResumeScreening({
                status: 'pending',
                decision: 'pending',
                reason: 'Job could not be identified',
                matchScore: null,
            });
            expect(n.label).toBe('Pending - Not Screened');
            expect(n.isRejected).toBe(false);
        });

        it('Test 7: duplicate with valid match still uses required % vs job minimum', () => {
            const isDuplicate = true;
            const { result, decision } = screenDecision(twoOfThree, criteria, 2);
            expect(isDuplicate).toBe(true);
            expect(decision.minRequired).toBe(2);
            expect(result.requiredMatchPercent).toBeCloseTo(66.7, 1);
            expect(decision.passed).toBe(true);
        });

        it('blind force without override must not overwrite a completed screening (listImports race)', () => {
            expect(shouldSkipBlindForceRescreen({
                force: true,
                completed: true,
                hasOverride: false,
                replaceCompleted: false,
            })).toBe(true);

            // Inbox import with extracted text may replace
            expect(shouldSkipBlindForceRescreen({
                force: true,
                completed: true,
                hasOverride: true,
                replaceCompleted: false,
            })).toBe(false);

            // Explicit admin/assign rescreen may replace
            expect(shouldSkipBlindForceRescreen({
                force: true,
                completed: true,
                hasOverride: false,
                replaceCompleted: true,
            })).toBe(false);

            // Non-force catch-up must not skip via this guard (early-complete return handles it)
            expect(shouldSkipBlindForceRescreen({
                force: false,
                completed: true,
                hasOverride: false,
                replaceCompleted: false,
            })).toBe(false);
        });
    });

    describe('extractTextFromBuffer', () => {
        it('extracts readable text from PDF', async () => {
            const buffer = createPdfBuffer('React Node.js MongoDB');
            const text = await extractTextFromBuffer(buffer, 'resume.pdf');
            expect(text).toContain('react');
            expect(text).toContain('node.js');
            expect(text).toContain('mongodb');
        });

        it('extracts text from TXT', async () => {
            const text = await extractTextFromBuffer(Buffer.from('React\nNode.js\nMongoDB'), 'resume.txt');
            expect(text).toBe('react node.js mongodb');
        });

        it('uses best-effort fallback for DOC', async () => {
            const text = await extractTextFromBuffer(Buffer.from('React Node.js MongoDB', 'utf8'), 'resume.doc');
            expect(text).toContain('react');
            expect(text).toContain('node.js');
            expect(text).toContain('mongodb');
        });

        it('extracts text from DOCX using mammoth', async () => {
            const buffer = await createDocxBuffer('React.js Node.js MongoDB');
            const text = await extractTextFromBuffer(buffer, 'resume.docx');
            expect(text).toContain('react.js');
            expect(text).toContain('node.js');
            expect(text).toContain('mongodb');
        });
    });
});
