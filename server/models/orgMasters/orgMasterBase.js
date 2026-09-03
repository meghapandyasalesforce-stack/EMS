/**
 * Shared fields for tenant-scoped organization master documents.
 */
import mongoose from 'mongoose';

export const orgMasterStatusEnum = ['active', 'inactive'];

export const orgMasterBaseFields = {
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
    },
    code: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: 32,
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500,
    },
    status: {
        type: String,
        enum: orgMasterStatusEnum,
        default: 'active',
    },
};

export const addOrgMasterIndexes = (schema, codeUnique = true) => {
    schema.index({ organizationId: 1, name: 1 });
    schema.index({ organizationId: 1, status: 1 });
    if (codeUnique) {
        schema.index({ organizationId: 1, code: 1 }, { unique: true, sparse: true });
    }
};
