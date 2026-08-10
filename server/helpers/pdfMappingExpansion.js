/**
 * Expand PDF mappings to every occurrence of detected sample values (name, salary, dates).
 */

function itemKey(item, text) {
    return `${item.page}|${item.x}|${item.y}|${text}`;
}

function baseMapping(item, sourceText, fillPattern, token = '') {
    return {
        sourceText,
        fillPattern: fillPattern || sourceText,
        placeholderToken: token,
        page: item.page ?? 0,
        x: item.x ?? 0,
        y: item.y ?? 0,
        width: item.width ?? 0,
        height: item.height ?? 11,
        fontSize: item.fontSize ?? 11,
        required: true,
    };
}

function extractSampleReplacements(mappings = []) {
    const replacements = [];

    for (const mapping of mappings) {
        const source = String(mapping.sourceText || '').trim();
        const pattern = String(mapping.fillPattern || mapping.sourceText || '').trim();
        if (!source || !pattern.includes('{{')) continue;

        if (pattern.includes('{{candidateName}}')) {
            const dear = source.match(/^dear\s+(.+?)(,?\s*)$/i);
            if (dear?.[1]) {
                replacements.push({ sample: dear[1].trim(), token: 'candidateName', fillPattern: '{{candidateName}}' });
            } else if (source !== pattern) {
                replacements.push({ sample: source, token: 'candidateName', fillPattern: '{{candidateName}}' });
            }
        }

        if (pattern.includes('{{position}}')) {
            const pos = source.match(/position of\s+(.+?)(?:\s+at\b|[.,]|$)/i)
                || source.match(/position:\s*(.+)$/i)
                || source.match(/designation:\s*(.+)$/i);
            if (pos?.[1]) {
                replacements.push({ sample: pos[1].trim(), token: 'position', fillPattern: '{{position}}' });
            } else if (!/position of/i.test(source) && source.length < 80) {
                replacements.push({ sample: source, token: 'position', fillPattern: '{{position}}' });
            }
        }

        if (pattern.includes('{{annualCTC}}') || pattern.includes('{{totalCTC}}') || pattern.includes('{{salary}}')) {
            const token = pattern.includes('{{totalCTC}}') ? 'totalCTC' : 'annualCTC';
            const amount = source.match(/(?:rs\.?\s*|inr\s*)?([\d,]+(?:\.\d+)?)/i)?.[1]
                || source.match(/([\d,]+(?:\.\d+)?)/)?.[1];
            if (amount) replacements.push({ sample: amount, token, fillPattern: `{{${token}}}` });
            const fullAmount = source.match(/(?:rs\.?\s*|inr\s*)[\d,]+(?:\.\d+)?/i)?.[0];
            if (fullAmount) replacements.push({ sample: fullAmount, token, fillPattern: `{{${token}}}` });
        }

        for (const token of ['startDate', 'offerDate', 'offerExpiryDate']) {
            if (!pattern.includes(`{{${token}}}`)) continue;
            const date = source.match(/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/)?.[0];
            if (date) replacements.push({ sample: date, token, fillPattern: `{{${token}}}` });
        }

        for (const token of ['department', 'location', 'email', 'phone']) {
            if (!pattern.includes(`{{${token}}}`)) continue;
            const afterColon = source.match(/:\s*(.+)$/);
            if (afterColon?.[1]) {
                replacements.push({ sample: afterColon[1].trim(), token, fillPattern: `{{${token}}}` });
            }
        }
    }

    const unique = [];
    const seen = new Set();
    for (const r of replacements) {
        const key = `${r.token}|${r.sample}`;
        if (!r.sample || seen.has(key)) continue;
        seen.add(key);
        unique.push(r);
    }
    return unique;
}

/** Add a mapping for every text item that matches a known sample value. */
export function expandMappingsWithAllOccurrences(extractedItems = [], mappings = []) {
    const expanded = [...mappings];
    const seen = new Set(mappings.map((m) => itemKey(m, m.sourceText)));
    const samples = extractSampleReplacements(mappings);

    for (const item of extractedItems) {
        const text = String(item.text || '').trim();
        if (!text) continue;

        for (const { sample, token, fillPattern } of samples) {
            if (!sample || sample.length < 2) continue;

            const matches = text === sample
                || (sample.length >= 4 && text.includes(sample))
                || (token === 'candidateName' && text.replace(/,+$/, '') === sample);

            if (!matches) continue;

            const key = itemKey(item, text);
            if (seen.has(key)) continue;
            seen.add(key);

            let pattern = fillPattern;
            if (text.includes(sample) && text !== sample) {
                pattern = text.split(sample).join(fillPattern);
            }

            expanded.push(baseMapping(item, text, pattern, token));
        }
    }

    return expanded;
}

export default { expandMappingsWithAllOccurrences, extractSampleReplacements };
