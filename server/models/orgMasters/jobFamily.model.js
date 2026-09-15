import mongoose from 'mongoose';
import { organizationIsolationPlugin } from '../../plugins/organizationIsolation.js';
import { orgMasterBaseFields, addOrgMasterIndexes } from './orgMasterBase.js';

const jobFamilySchema = new mongoose.Schema(
    {
        ...orgMasterBaseFields,
    },
    { timestamps: true }
);

addOrgMasterIndexes(jobFamilySchema);
jobFamilySchema.plugin(organizationIsolationPlugin, { requireOrganizationId: false });

const OrgJobFamily = mongoose.model('OrgJobFamily', jobFamilySchema, 'org_job_families');
export default OrgJobFamily;
