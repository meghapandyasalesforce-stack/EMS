export const ACCESS_PROVISIONING_CATALOG = [
    {
        key: 'microsoft-teams',
        match: ['microsoft teams', 'teams'],
        label: 'Microsoft Teams',
        fields: [
            { key: 'teamsEmail', label: 'Teams Email ID', type: 'email', required: true },
            { key: 'role', label: 'Role', type: 'text', required: false },
            { key: 'license', label: 'License', type: 'text', required: false },
            { key: 'remarks', label: 'Remarks', type: 'textarea', required: false },
        ],
    },
    {
        key: 'outlook',
        match: ['outlook', 'microsoft outlook'],
        label: 'Outlook',
        fields: [
            { key: 'outlookEmail', label: 'Outlook Email ID', type: 'email', required: true },
            { key: 'mailboxAlias', label: 'Mailbox Alias', type: 'text', required: false },
            { key: 'remarks', label: 'Remarks', type: 'textarea', required: false },
        ],
    },
    {
        key: 'gitlab',
        match: ['gitlab'],
        label: 'GitLab',
        fields: [
            { key: 'username', label: 'Username', type: 'text', required: true },
            { key: 'email', label: 'Email', type: 'email', required: true },
            { key: 'groupOrRepository', label: 'Group/Repository', type: 'text', required: false },
            { key: 'remarks', label: 'Remarks', type: 'textarea', required: false },
        ],
    },
    {
        key: 'jira',
        match: ['jira'],
        label: 'Jira',
        fields: [
            { key: 'jiraEmail', label: 'Jira Email', type: 'email', required: true },
            { key: 'project', label: 'Project', type: 'text', required: false },
            { key: 'role', label: 'Role', type: 'text', required: false },
            { key: 'remarks', label: 'Remarks', type: 'textarea', required: false },
        ],
    },
    {
        key: 'slack',
        match: ['slack'],
        label: 'Slack',
        fields: [
            { key: 'slackEmail', label: 'Slack Email', type: 'email', required: true },
            { key: 'workspace', label: 'Workspace', type: 'text', required: false },
            { key: 'channel', label: 'Channel', type: 'text', required: false },
            { key: 'remarks', label: 'Remarks', type: 'textarea', required: false },
        ],
    },
];

function normalizeValue(value = '') {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

export function getProvisioningTemplateForSystem(system) {
    const normalized = normalizeValue(system);
    const exact = ACCESS_PROVISIONING_CATALOG.find((item) =>
        item.match.some((alias) => normalizeValue(alias) === normalized));
    if (exact) return exact;

    const partial = ACCESS_PROVISIONING_CATALOG.find((item) =>
        item.match.some((alias) => normalized.includes(normalizeValue(alias))
            || normalizeValue(alias).includes(normalized)));
    if (partial) return partial;

    return {
        key: 'generic-access',
        match: [],
        label: system || 'Access',
        fields: [
            { key: 'accountId', label: 'Account ID / Email', type: 'text', required: true },
            { key: 'role', label: 'Role', type: 'text', required: false },
            { key: 'remarks', label: 'Remarks', type: 'textarea', required: false },
        ],
    };
}

export function listProvisioningTemplates() {
    return ACCESS_PROVISIONING_CATALOG;
}
