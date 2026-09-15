import mongoose from 'mongoose';
import { organizationIsolationPlugin } from '../../plugins/organizationIsolation.js';
import { orgMasterBaseFields, addOrgMasterIndexes } from './orgMasterBase.js';

const designationSchema = new mongoose.Schema(
    {
        ...orgMasterBaseFields,
        /** Sort order for hierarchy (Intern=1 … VP=10) */
        levelOrder: {
            type: Number,
            default: 1,
            min: 1,
            max: 100,
        },
    },
    { timestamps: true }
);

addOrgMasterIndexes(designationSchema);
designationSchema.plugin(organizationIsolationPlugin, { requireOrganizationId: false });

const OrgDesignation = mongoose.model('OrgDesignation', designationSchema, 'org_designations');
export default OrgDesignation;
