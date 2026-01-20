/**
 * Pagination Helper
 * Provides utilities for consistent pagination across all list endpoints
 */

/**
 * Parse and validate pagination parameters from request
 * @param {Object} req - Express request object
 * @param {Object} options - Options
 * @param {number} options.defaultLimit - Default items per page (default: 20)
 * @param {number} options.maxLimit - Maximum items per page (default: 100)
 * @returns {Object} Pagination parameters { page, limit, skip }
 */
export const parsePagination = (req, options = {}) => {
    const { defaultLimit = 20, maxLimit = 100 } = options;
    
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    
    // Validate page - handle NaN and invalid values
    if (isNaN(page) || page < 1) {
        page = 1;
    }
    
    // Validate and cap limit - handle NaN and invalid values
    if (isNaN(limit) || limit < 1) {
        limit = defaultLimit;
    }
    if (limit > maxLimit) {
        limit = maxLimit;
    }
    
    const skip = (page - 1) * limit;
    
    return { page, limit, skip };
};

/**
 * Create pagination response metadata
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @returns {Object} Pagination metadata
 */
export const createPaginationMeta = (page, limit, total) => {
    return {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
    };
};

/**
 * Create paginated response
 * @param {Object} res - Express response object
 * @param {Array} data - Data array
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @param {string} message - Success message
 * @returns {Object} Response object
 */
export const sendPaginatedResponse = (res, data, page, limit, total, message = 'Data retrieved successfully') => {
    return res.status(200).json({
        success: true,
        message,
        data,
        pagination: createPaginationMeta(page, limit, total)
    });
};

/**
 * Parse sort parameters from request
 * @param {Object} req - Express request object
 * @param {string} defaultSort - Default sort field (default: '-createdAt')
 * @returns {string|Object} Sort parameter
 */
export const parseSort = (req, defaultSort = '-createdAt') => {
    const sort = req.query.sort || defaultSort;
    
    // Handle multiple sort fields: "name,-createdAt"
    if (typeof sort === 'string' && sort.includes(',')) {
        const sortFields = sort.split(',').reduce((acc, field) => {
            const trimmed = field.trim();
            if (trimmed.startsWith('-')) {
                acc[trimmed.substring(1)] = -1;
            } else {
                acc[trimmed] = 1;
            }
            return acc;
        }, {});
        return sortFields;
    }
    
    return sort;
};

export default {
    parsePagination,
    createPaginationMeta,
    sendPaginatedResponse,
    parseSort
};

