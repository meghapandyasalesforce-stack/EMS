import logger from './logger.js';

/**
 * Tenant-scoped employee codes (e.g. PRS001). Unique per organization, not globally.
 */

export function buildPrefixedEmployeeId(prefix, number, minDigits = 3) {
    const safeDigits = Math.min(10, Math.max(2, Number(minDigits) || 3));
    const n = Math.max(1, Number(number) || 1);
    return `${String(prefix).toUpperCase()}${String(n).padStart(safeDigits, '0')}`;
}

/**
 * Plan sequential IDs for an org. If everyone already has the target ID, skip writes.
 */
export function planEmployeeIdMigration(employees, { prefix, minDigits = 3, startNumber = 1 } = {}) {
    const start = Math.max(1, Number(startNumber) || 1);
    const assignments = [];
    let currentNumber = start;

    for (const employee of employees) {
        const nextId = buildPrefixedEmployeeId(prefix, currentNumber, minDigits);
        assignments.push({
            _id: employee._id,
            from: employee.employeeId,
            to: nextId,
        });
        currentNumber += 1;
    }

    return {
        assignments,
        nextNumber: currentNumber,
        needsMigration: assignments.some((row) => String(row.from) !== String(row.to)),
    };
}

async function bulkSetEmployeeIds(Employee, organizationId, rows, idField) {
    if (!rows.length) return;
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
        const slice = rows.slice(i, i + batchSize);
        await Employee.bulkWrite(
            slice.map((row) => ({
                updateOne: {
                    filter: { _id: row._id, organizationId },
                    update: { $set: { employeeId: row[idField] } },
                },
            })),
            { ordered: true }
        );
    }
}

/**
 * Two-phase remumber so in-place swaps cannot hit the per-org unique index.
 */
export async function migrateOrganizationEmployeeIds(Employee, {
    organizationId,
    prefix,
    minDigits = 3,
    startNumber = 1,
} = {}) {
    const employees = await Employee.find({ organizationId })
        .select('_id employeeId')
        .sort({ joiningDate: 1, createdAt: 1 })
        .lean();

    if (!employees.length) {
        return { migrated: false, reason: 'no_employees', nextNumber: startNumber || 1, count: 0 };
    }

    const plan = planEmployeeIdMigration(employees, { prefix, minDigits, startNumber });
    if (!plan.needsMigration) {
        logger.info('Employee ID migration skipped — IDs already match target format', {
            organizationId,
            count: employees.length,
            nextNumber: plan.nextNumber,
        });
        return { migrated: false, reason: 'already_matching', nextNumber: plan.nextNumber, count: employees.length };
    }

    const tempRows = plan.assignments.map((row) => ({
        _id: row._id,
        temp: `__mig_${row._id}`,
        to: row.to,
        from: row.from,
    }));

    try {
        await bulkSetEmployeeIds(Employee, organizationId, tempRows, 'temp');
        await bulkSetEmployeeIds(Employee, organizationId, tempRows, 'to');
    } catch (error) {
        logger.error('Employee ID migration failed; restoring previous IDs', {
            organizationId,
            error: error.message,
        });
        try {
            await bulkSetEmployeeIds(
                Employee,
                organizationId,
                tempRows.map((row) => ({ _id: row._id, from: row.from })),
                'from'
            );
        } catch (restoreError) {
            logger.error('Failed to restore employee IDs after migration error', {
                organizationId,
                error: restoreError.message,
            });
        }
        throw error;
    }

    logger.info('Employee ID migration completed', {
        organizationId,
        employeesMigrated: employees.length,
        nextNumber: plan.nextNumber,
    });

    return { migrated: true, reason: 'updated', nextNumber: plan.nextNumber, count: employees.length };
}

/**
 * Drop leftover global unique index so the same code (PRS001) can exist in two orgs.
 */
export async function dropGlobalEmployeeIdUniqueIndex(Employee) {
    try {
        const collection = Employee.collection;
        const indexes = await collection.indexes();
        const globalUnique = indexes.find(
            (idx) => idx.name === 'employeeId_1' && idx.unique && !Object.prototype.hasOwnProperty.call(idx.key, 'organizationId')
        );
        if (!globalUnique) return false;
        await collection.dropIndex('employeeId_1');
        logger.info('Dropped global unique index employees.employeeId_1 (IDs are unique per organization)');
        return true;
    } catch (error) {
        if (error.code === 27 || error.codeName === 'IndexNotFound') return false;
        logger.warn('Could not drop global employeeId_1 index', { error: error.message });
        return false;
    }
}
