import mongoose from 'mongoose';
import { organizationIsolationPlugin } from '../../plugins/organizationIsolation.js';
import { orgMasterBaseFields, addOrgMasterIndexes } from './orgMasterBase.js';

const departmentSchema = new mongoose.Schema(
    {
        ...orgMasterBaseFields,
        parentDepartmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'OrgDepartment',
            default: null,
        },
        departmentHeadId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            default: null,
        },
    },
    { timestamps: true }
);

addOrgMasterIndexes(departmentSchema);
departmentSchema.plugin(organizationIsolationPlugin, { requireOrganizationId: false });

const OrgDepartment = mongoose.model('OrgDepartment', departmentSchema, 'org_departments');
export default OrgDepartment;
