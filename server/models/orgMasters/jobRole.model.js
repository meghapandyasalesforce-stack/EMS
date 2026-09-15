import mongoose from 'mongoose';
import { organizationIsolationPlugin } from '../../plugins/organizationIsolation.js';
import { orgMasterBaseFields, addOrgMasterIndexes } from './orgMasterBase.js';

const jobRoleSchema = new mongoose.Schema(
    {
        ...orgMasterBaseFields,
        /** Job roles may span multiple departments */
        departmentIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'OrgDepartment',
        }],
        level: {
            type: String,
            trim: true,
            maxlength: 64,
        },
        jobFamilyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'OrgJobFamily',
            default: null,
        },
    },
    { timestamps: true }
);

addOrgMasterIndexes(jobRoleSchema);
jobRoleSchema.index({ organizationId: 1, departmentIds: 1 });
jobRoleSchema.plugin(organizationIsolationPlugin, { requireOrganizationId: false });

const OrgJobRole = mongoose.model('OrgJobRole', jobRoleSchema, 'org_job_roles');
export default OrgJobRole;
