import mongoose from 'mongoose';
import { organizationIsolationPlugin } from '../../plugins/organizationIsolation.js';
import { orgMasterBaseFields, addOrgMasterIndexes } from './orgMasterBase.js';

const workModeSchema = new mongoose.Schema(
    {
        ...orgMasterBaseFields,
    },
    { timestamps: true }
);

addOrgMasterIndexes(workModeSchema);
workModeSchema.plugin(organizationIsolationPlugin, { requireOrganizationId: false });

const OrgWorkMode = mongoose.model('OrgWorkMode', workModeSchema, 'org_work_modes');
export default OrgWorkMode;
