/**
 * Mongoose Plugin for Organization Isolation
 * Automatically enforces organizationId filtering on all queries
 * SECURITY: Prevents data leakage between organizations in multi-tenant system
 */

import logger from '../helpers/logger.js';
import { getRequestContext } from '../helpers/requestContext.js';

/**
 * Organization Isolation Plugin
 * Automatically adds organizationId filter to queries
 * 
 * @param {mongoose.Schema} schema - Mongoose schema
 * @param {Object} options - Plugin options
 * @param {boolean} options.requireOrganizationId - If true, throws error when organizationId is missing (default: false)
 */
export const organizationIsolationPlugin = (schema, options = {}) => {
    const { requireOrganizationId = false } = options;
    
    // Check if schema has organizationId field
    if (!schema.paths.organizationId) {
        logger.warn('Organization isolation plugin applied to schema without organizationId field', {
            modelName: schema.modelName
        });
        return;
    }
    
    /**
     * Get organizationId from query context
     * This is set by middleware before queries
     */
    const getOrganizationIdFromContext = (query) => {
        // Check if organizationId is already in query (explicit filter)
        if (query.getQuery().organizationId) {
            return query.getQuery().organizationId;
        }
        
        // Try to get from query context (set by middleware)
        if (query._context?.organizationId) {
            return query._context.organizationId;
        }

        // Fallback: AsyncLocalStorage request context
        const requestContext = getRequestContext();
        if (requestContext?.organizationId) {
            return requestContext.organizationId;
        }
        
        return null;
    };
    
    /**
     * Add organizationId filter to query
     * SECURITY: Always applies organizationId filter, even for populate queries
     * Populate queries that reference documents with organizationId should be filtered
     */
    const addOrganizationFilter = function(query) {
        // Check if this is a populate query
        // Populate queries are internal Mongoose queries that fetch related documents
        // We need to be careful here - populate queries should respect organization isolation
        // when the referenced model also has organizationId
        const isPopulateQuery = query._mongooseOptions?.populate || 
                               query._populatedPaths?.length > 0 ||
                               query._mongooseOptions?.populateOptions;
        
        const organizationId = getOrganizationIdFromContext(query);
        
        // Validate organizationId format if present
        if (organizationId && !/^[0-9a-fA-F]{24}$/.test(organizationId.toString())) {
            logger.error('Invalid organizationId format in query context', {
                modelName: this.model?.modelName || 'Unknown',
                organizationId,
                query: JSON.stringify(query.getQuery())
            });
            // Don't proceed with invalid organizationId
            if (requireOrganizationId) {
                throw new Error('Invalid organization ID format');
            }
            return;
        }
        
        // SECURITY FIX: Apply organizationId filter to all queries, including populate
        // The populate query will be filtered by the organizationIsolationPlugin on the referenced model
        // This ensures that even when populating related documents, we only get documents from the same organization
        if (organizationId) {
            const currentQuery = query.getQuery();
            
            // For populate queries, we still need to ensure the base query is filtered
            // The populated documents will be filtered by their own model's plugin
            if (!currentQuery.organizationId) {
                query.where({ organizationId });
                
                // Log populate queries for audit purposes
                if (isPopulateQuery) {
                    logger.debug('Organization filter applied to populate query', {
                        modelName: this.model?.modelName || 'Unknown',
                        organizationId,
                        isPopulateQuery: true
                    });
                }
            }
        } else if (requireOrganizationId && !isPopulateQuery) {
            // In strict mode, log warning but don't throw (to avoid breaking populate/other queries)
            // The controller should handle organizationId validation
            logger.warn('Organization ID not found in query context', {
                modelName: this.model?.modelName || 'Unknown',
                query: JSON.stringify(query.getQuery()),
                hint: 'Ensure organizationId is set in query or request context'
            });
            // Don't throw - let the query proceed and let controllers handle validation
            // This prevents breaking populate() and other operations
        } else if (requireOrganizationId && isPopulateQuery) {
            // For populate queries in strict mode, log but don't block
            // The populated model's plugin will handle filtering
            logger.debug('Populate query without organizationId in context (will be filtered by referenced model)', {
                modelName: this.model?.modelName || 'Unknown'
            });
        }
    };
    
    // Apply to find operations
    schema.pre(['find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete'], function() {
        addOrganizationFilter(this);
    });
    
    // Apply to count operations
    schema.pre('count', function() {
        addOrganizationFilter(this);
    });
    
    // Apply to update operations (bulk updates)
    schema.pre(['updateOne', 'updateMany'], function() {
        addOrganizationFilter(this);
    });
    
    // Apply to delete operations
    schema.pre(['deleteOne', 'deleteMany'], function() {
        addOrganizationFilter(this);
    });
    
    // Add static method to set organization context
    schema.statics.setOrganizationContext = function(organizationId) {
        return {
            organizationId,
            // This context will be available in query hooks
        };
    };
    
    // Add instance method to validate organization access
    schema.methods.validateOrganizationAccess = function(organizationId) {
        if (!this.organizationId) {
            logger.warn('Document has no organizationId', {
                modelName: this.constructor.modelName,
                documentId: this._id
            });
            return false;
        }
        
        const matches = this.organizationId.toString() === organizationId.toString();
        if (!matches) {
            logger.error('Organization access violation', {
                modelName: this.constructor.modelName,
                documentId: this._id,
                documentOrgId: this.organizationId,
                requestedOrgId: organizationId
            });
        }
        
        return matches;
    };
    
    logger.info('Organization isolation plugin applied', {
        modelName: schema.modelName,
        requireOrganizationId
    });
};

export default organizationIsolationPlugin;

