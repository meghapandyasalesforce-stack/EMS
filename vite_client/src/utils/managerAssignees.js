/**
 * Manager assignee filters for lifecycle create forms.
 * Excludes: self, org-tree juniors (reports), and junior-level roles (intern/trainee/junior).
 */

const empId = (emp) => String(emp?._id || emp?.id || '').trim();

const normalize = (value) => String(value || '').toLowerCase().trim();

const managerRefId = (emp) => {
    const m = emp?.managerId;
    if (!m) return '';
    if (typeof m === 'object') return String(m._id || m.id || '').trim();
    return String(m).trim();
};

/** Position levels that should never appear as Assigned Manager. */
const NON_MANAGER_POSITIONS = new Set(['intern', 'trainee', 'junior']);

/** All direct + nested reports of `rootId` via managerId tree. */
export function getJuniorIds(employees = [], rootId) {
    const root = String(rootId || '').trim();
    const juniors = new Set();
    if (!root) return juniors;

    const childrenByManager = new Map();
    for (const emp of employees || []) {
        const id = empId(emp);
        const mid = managerRefId(emp);
        if (!id || !mid) continue;
        if (!childrenByManager.has(mid)) childrenByManager.set(mid, []);
        childrenByManager.get(mid).push(id);
    }

    const stack = [root];
    while (stack.length) {
        const current = stack.pop();
        for (const childId of childrenByManager.get(current) || []) {
            if (juniors.has(childId)) continue;
            juniors.add(childId);
            stack.push(childId);
        }
    }
    return juniors;
}

/** True when employee is an intern / trainee / junior (by position, title, type, or name). */
export function isJuniorLevelEmployee(emp) {
    if (!emp) return false;
    const position = normalize(emp.position);
    const jobTitle = normalize(emp.jobTitle);
    const employmentType = normalize(emp.employmentType);
    const name = normalize(`${emp.name || ''} ${emp.lastName || ''}`);

    if (NON_MANAGER_POSITIONS.has(position)) return true;
    if (/\bintern(?:ship)?\b/.test(position) || /\bintern(?:ship)?\b/.test(jobTitle) || /\bintern(?:ship)?\b/.test(employmentType)) {
        return true;
    }
    // Names like "testingintern"
    if (/intern/.test(name) && !/internal/.test(name)) return true;
    if (/\btrainee\b/.test(position) || /\btrainee\b/.test(jobTitle)) return true;
    if (/\bjunior\b/.test(jobTitle) || /\bjunior\b/.test(position)) return true;
    return false;
}

/**
 * Eligible managers: not self, not org-tree juniors, not intern/trainee/junior level.
 */
export function filterManagerCandidates(employees = [], selectedEmployeeId = '') {
    const selfId = String(selectedEmployeeId || '').trim();
    const juniors = getJuniorIds(employees, selfId);
    return (employees || []).filter((emp) => {
        const id = empId(emp);
        if (!id) return false;
        if (selfId && id === selfId) return false;
        if (juniors.has(id)) return false;
        if (isJuniorLevelEmployee(emp)) return false;
        return true;
    });
}

export default filterManagerCandidates;
