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
    },
    { timestamps: true }
);

addOrgMasterIndexes(locationSchema);
locationSchema.plugin(organizationIsolationPlugin, { requireOrganizationId: false });

const OrgLocation = mongoose.model('OrgLocation', locationSchema, 'org_locations');
export default OrgLocation;
