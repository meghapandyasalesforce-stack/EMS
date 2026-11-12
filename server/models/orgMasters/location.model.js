import mongoose from 'mongoose';
import { organizationIsolationPlugin } from '../../plugins/organizationIsolation.js';
import { orgMasterBaseFields, addOrgMasterIndexes } from './orgMasterBase.js';

const locationSchema = new mongoose.Schema(
    {
        ...orgMasterBaseFields,
        type: {
            type: String,
            enum: ['head', 'branch', 'remote_hub'],
            default: 'branch',
        },
        isPrimary: { type: Boolean, default: false },
        address: {
            street: { type: String, trim: true },
            city: { type: String, trim: true },
            state: { type: String, trim: true },
            country: { type: String, trim: true },
            zipCode: { type: String, trim: true },
        },
        phone: { type: String, trim: true },
        /** Punch-in geofence. Absent coordinates fall back to the organization attendance rule pin. */
        coordinates: {
            latitude: { type: Number },
            longitude: { type: Number },
        },
        maximumRadius: {
            type: Number,
            default: 500,
            min: [50, 'Minimum radius is 50 meters'],
            max: [1000, 'Maximum radius is 1000 meters'],
        },
    },
    { timestamps: true }
);

addOrgMasterIndexes(locationSchema);
locationSchema.plugin(organizationIsolationPlugin, { requireOrganizationId: false });

const OrgLocation = mongoose.model('OrgLocation', locationSchema, 'org_locations');
export default OrgLocation;
