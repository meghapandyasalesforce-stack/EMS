import mongoose from 'mongoose';
import { organizationIsolationPlugin } from '../../plugins/organizationIsolation.js';
import { orgMasterBaseFields, addOrgMasterIndexes } from './orgMasterBase.js';

const teamSchema = new mongoose.Schema(
    {
        ...orgMasterBaseFields,
        departmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'OrgDepartment',
            required: true,
            index: true,
        },
        teamLeadId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            default: null,
        },
    },
    { timestamps: true }
);

addOrgMasterIndexes(teamSchema);
teamSchema.index({ organizationId: 1, departmentId: 1 });
teamSchema.plugin(organizationIsolationPlugin, { requireOrganizationId: false });

const OrgTeam = mongoose.model('OrgTeam', teamSchema, 'org_teams');
export default OrgTeam;
