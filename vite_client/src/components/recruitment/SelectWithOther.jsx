import React from 'react';

export const OTHER_OPTION = '__other__';

export const JOB_FORM_DEPARTMENTS = [
    'Engineering', 'HR', 'Finance', 'Sales', 'Marketing', 'IT Support', 'Operations',
    'Customer Support', 'Legal', 'Product', 'Research & Development', 'Design', 'Administration', 'IT',
];

export const JOB_FORM_TITLES = [
    'Software Engineer', 'Frontend Developer', 'Backend Developer', 'DevOps Engineer',
    'HR Manager', 'HR Executive', 'Financial Analyst', 'Marketing Executive',
    'Sales Representative', 'Product Manager', 'QA Tester', 'Customer Support Specialist',
    'UX/UI Designer', 'Project Manager', 'Legal Advisor', 'Operations Coordinator',
    'Full Stack Developer', 'Web Intern', 'Intern',
];

export const JOB_FORM_POSITIONS = [
    'Intern', 'Junior', 'Mid-Level', 'Senior', 'Lead', 'Supervisor', 'Manager',
    'Director', 'Executive', 'VP', 'CTO', 'CFO', 'CEO', 'Developer',
];

export const JOB_FORM_LOCATIONS = ['Remote', 'Hybrid', 'On-site', 'Work From Home', 'Jaipur', 'Delhi', 'Mumbai', 'Bengaluru', 'Hyderabad', 'Pune', 'Chennai'];

const selectClass = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-theme-secondary focus:ring-2 focus:ring-theme-secondary/20';
const inputClass = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-gray-400 focus:border-theme-secondary focus:ring-2 focus:ring-theme-secondary/20';

/** Dropdown with an Other option that reveals a manual text field */
export const SelectWithOther = ({
    label,
    required,
    options,
    selectValue,
    customValue,
    onSelectChange,
    onCustomChange,
    placeholder,
}) => {
    const isOther = selectValue === OTHER_OPTION;
    return (
        <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">
                {label}{required ? ' *' : ''}
            </span>
            <select
                className={selectClass}
                value={selectValue}
                required={required && !isOther}
                onChange={(e) => onSelectChange(e.target.value)}
            >
                <option value="">{placeholder || `Select ${label.toLowerCase()}`}</option>
                {options.map((t) => (
                    <option key={t} value={t}>{t}</option>
                ))}
                <option value={OTHER_OPTION}>Other</option>
            </select>
            {isOther && (
                <input
                    className={`${inputClass} mt-2`}
                    value={customValue}
                    onChange={(e) => onCustomChange(e.target.value)}
                    placeholder={`Enter ${label.toLowerCase()} manually`}
                    required={required}
                    autoFocus
                />
            )}
        </label>
    );
};

export function resolveSelectValue(selectValue, customValue) {
    if (selectValue === OTHER_OPTION) return String(customValue || '').trim();
    return selectValue;
}

/** Load org departments / locations and merge with defaults */
export async function loadJobFormOptions(axios) {
    const options = {
        titles: [...JOB_FORM_TITLES],
        departments: [...JOB_FORM_DEPARTMENTS],
        positions: [...JOB_FORM_POSITIONS],
        locations: [...JOB_FORM_LOCATIONS],
    };
    try {
        const { data } = await axios.get('/v1/admin/organization/profile', { withCredentials: true });
        const org = data?.organization || data?.data?.organization || data?.data || {};
        const deptSet = new Set(options.departments);
        (org.orgDepartments || []).forEach((d) => {
            const name = typeof d === 'object' ? d.name : d;
            if (name && String(name).trim()) deptSet.add(String(name).trim());
        });
        const locSet = new Set(options.locations);
        (org.officeLocations || []).forEach((loc) => {
            if (loc?.name) locSet.add(loc.name);
            const city = loc?.address?.city;
            if (city) locSet.add(city);
        });
        options.departments = [...deptSet].sort();
        options.locations = [...locSet].sort();
    } catch {
        /* keep defaults */
    }
    return options;
}
