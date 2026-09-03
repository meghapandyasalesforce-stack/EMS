import mongoose from 'mongoose';
import { organizationIsolationPlugin } from '../../plugins/organizationIsolation.js';
import { orgMasterBaseFields, addOrgMasterIndexes } from './orgMasterBase.js';

const employmentTypeSchema = new mongoose.Schema(
    {
        ...orgMasterBaseFields,
    },
    { timestamps: true }
);

addOrgMasterIndexes(employmentTypeSchema);
employmentTypeSchema.plugin(organizationIsolationPlugin, { requireOrganizationId: false });

const OrgEmploymentType = mongoose.model('OrgEmploymentType', employmentTypeSchema, 'org_employment_types');
export default OrgEmploymentType;
