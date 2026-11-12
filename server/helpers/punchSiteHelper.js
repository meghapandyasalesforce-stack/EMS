/**
 * Chooses the geofence used for punch-in/out.
 * An employee's assigned branch pin wins when it has coordinates.
 * Otherwise the organization attendance-rule pin is used.
 */
import Employee from '../models/employee.model.js';
import OrgLocation from '../models/orgMasters/location.model.js';

export function hasValidPunchCoordinates(coordinates) {
    const lat = Number(coordinates?.latitude);
    const lng = Number(coordinates?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (lat === 0 && lng === 0) return false;
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function normalizePunchRadius(value) {
    const radius = Number(value);
    if (!Number.isFinite(radius)) return 500;
    if (radius < 50) return 50;
    if (radius > 1000) return 1000;
    return radius;
}

export function formatBranchAddress(location) {
    const address = location?.address || {};
    return [address.street, address.city, address.state, address.country, address.zipCode]
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join(', ');
}

/**
 * @param {object|null} branch OrgLocation lean doc
 * @param {object|null} rule Attendance rule lean doc
 */
export function selectPunchSite(branch, rule) {
    if (branch && hasValidPunchCoordinates(branch.coordinates)) {
        return {
            source: 'branch',
            locationId: branch._id || null,
            locationName: branch.name || 'Branch',
            address: formatBranchAddress(branch),
            coordinates: {
                latitude: Number(branch.coordinates.latitude),
                longitude: Number(branch.coordinates.longitude),
            },
            maximumRadius: normalizePunchRadius(branch.maximumRadius),
        };
    }

    if (rule && hasValidPunchCoordinates(rule.coordinates)) {
        return {
            source: 'rule',
            locationId: null,
            locationName: rule.location || 'Office',
            address: rule.address || '',
            coordinates: {
                latitude: Number(rule.coordinates.latitude),
                longitude: Number(rule.coordinates.longitude),
            },
            maximumRadius: normalizePunchRadius(rule.maximumRadius),
        };
    }

    return null;
}

export async function resolveEmployeePunchSite(employee, activeRule) {
    let locationId = employee?.locationId?._id || employee?.locationId || null;
    let organizationId = employee?.organizationId || null;

    if ((!locationId || !organizationId) && employee?._id) {
        const row = await Employee.findById(employee._id)
            .select('locationId organizationId')
            .lean();
        locationId = locationId || row?.locationId || null;
        organizationId = organizationId || row?.organizationId || null;
    }

    let branch = null;
    if (locationId && organizationId) {
        branch = await OrgLocation.findOne({
            _id: locationId,
            organizationId,
            status: 'active',
        }).lean();
    }

    return selectPunchSite(branch, activeRule);
}
