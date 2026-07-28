/**
 * Conditional logic evaluation for lifecycle forms.
 */

function compareValues(left, operator, right) {
    switch (operator) {
        case 'equals': return String(left) === String(right);
        case 'not_equals': return String(left) !== String(right);
        case 'contains': return String(left || '').includes(String(right ?? ''));
        case 'not_contains': return !String(left || '').includes(String(right ?? ''));
        case 'gt': return Number(left) > Number(right);
        case 'gte': return Number(left) >= Number(right);
        case 'lt': return Number(left) < Number(right);
        case 'lte': return Number(left) <= Number(right);
        case 'in': return Array.isArray(right) ? right.map(String).includes(String(left)) : String(right).split(',').map((s) => s.trim()).includes(String(left));
        case 'not_in': return Array.isArray(right) ? !right.map(String).includes(String(left)) : !String(right).split(',').map((s) => s.trim()).includes(String(left));
        case 'empty': return left == null || left === '' || (Array.isArray(left) && !left.length);
        case 'not_empty': return left != null && left !== '' && !(Array.isArray(left) && !left.length);
        default: return false;
    }
}

function evaluateRule(rule, formData = {}) {
    const conditions = rule.conditions || [];
    if (!conditions.length) return true;
    const results = conditions.map((c) => compareValues(formData[c.fieldKey], c.operator, c.value));
    return rule.combinator === 'or' ? results.some(Boolean) : results.every(Boolean);
}

export function isFieldVisible(field, formData = {}) {
    if (field.hidden) return false;
    const rules = (field.conditionalRules || []).filter((r) => ['show', 'hide'].includes(r.action));
    if (!rules.length) return true;
    const hasShow = rules.some((r) => r.action === 'show');
    const hasHide = rules.some((r) => r.action === 'hide');
    let visible = hasShow && !hasHide ? false : true;
    for (const rule of rules) {
        const match = evaluateRule(rule, formData);
        if (rule.action === 'show' && match) visible = true;
        if (rule.action === 'hide' && match) visible = false;
    }
    return visible;
}

export function isFieldRequired(field, formData = {}) {
    if (!isFieldVisible(field, formData)) return false;
    let required = field.required === true;
    for (const rule of (field.conditionalRules || []).filter((r) => ['require', 'optional'].includes(r.action))) {
        const match = evaluateRule(rule, formData);
        if (rule.action === 'require' && match) required = true;
        if (rule.action === 'optional' && match) required = false;
    }
    return required;
}

export function isFieldEnabled(field, formData = {}) {
    if (field.readOnly) return false;
    let enabled = true;
    for (const rule of (field.conditionalRules || []).filter((r) => ['enable', 'disable'].includes(r.action))) {
        const match = evaluateRule(rule, formData);
        if (rule.action === 'enable' && match) enabled = true;
        if (rule.action === 'disable' && match) enabled = false;
    }
    return enabled;
}

export function resolveFieldDefault(field, formData = {}) {
    for (const rule of (field.conditionalRules || []).filter((r) => r.action === 'set_default')) {
        if (evaluateRule(rule, formData)) return rule.targetValue;
    }
    return field.defaultValue;
}

export function getVisibleFields(fields = [], formData = {}) {
    return (fields || [])
        .filter((f) => !['heading', 'divider', 'paragraph', 'instructions'].includes(f.type))
        .filter((f) => isFieldVisible(f, formData))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function validateFormResponses(fields = [], formData = {}) {
    const errors = [];
    for (const field of getVisibleFields(fields, formData)) {
        const value = formData[field.key];
        if (isFieldRequired(field, formData) && (value == null || value === '' || (Array.isArray(value) && !value.length))) {
            errors.push({ fieldKey: field.key, message: `${field.label} is required` });
            continue;
        }
        if (value == null || value === '') continue;
        const v = field.validation || {};
        if (v.minLength != null && String(value).length < v.minLength) {
            errors.push({ fieldKey: field.key, message: `${field.label} must be at least ${v.minLength} characters` });
        }
        if (v.maxLength != null && String(value).length > v.maxLength) {
            errors.push({ fieldKey: field.key, message: `${field.label} must be at most ${v.maxLength} characters` });
        }
        if (v.min != null && Number(value) < v.min) {
            errors.push({ fieldKey: field.key, message: `${field.label} must be at least ${v.min}` });
        }
        if (v.max != null && Number(value) > v.max) {
            errors.push({ fieldKey: field.key, message: `${field.label} must be at most ${v.max}` });
        }
        if (v.pattern) {
            try {
                const re = new RegExp(v.pattern);
                if (!re.test(String(value))) errors.push({ fieldKey: field.key, message: `${field.label} format is invalid` });
            } catch {
                // ignore invalid regex in config
            }
        }
        if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
            errors.push({ fieldKey: field.key, message: `${field.label} must be a valid email` });
        }
    }
    return errors;
}

export function buildFormPreview(form) {
    const fields = [...(form.fields || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return {
        formId: form._id,
        name: form.name,
        version: form.version,
        status: form.status,
        category: form.category || form.module,
        fieldCount: fields.length,
        requiredFieldCount: fields.filter((f) => f.required).length,
        fields: fields.map((f) => ({
            key: f.key,
            label: f.label,
            type: f.type,
            required: f.required,
            hasConditionalRules: (f.conditionalRules || []).length > 0,
            sectionKey: f.sectionKey,
        })),
    };
}
