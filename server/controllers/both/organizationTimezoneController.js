import { getOrganizationId } from '../../helpers/organizationHelper.js';
import { getTimezoneContext } from '../../helpers/organizationTimezoneService.js';
import { sendSuccess, sendError } from '../../helpers/responseHelper.js';
import logger from '../../helpers/logger.js';

/**
 * @route GET /api/v1/both/organization-timezone
 * @access Authenticated users (org-scoped)
 */
export const getOrganizationTimezoneContext = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    if (!organizationId) {
      return sendError(res, 'Organization ID is required', 400);
    }
    const context = await getTimezoneContext(organizationId);
    return sendSuccess(res, context, 'Organization timezone retrieved');
  } catch (error) {
    logger.error('Error fetching organization timezone', { error: error.message });
    return sendError(res, error.message || 'Failed to fetch timezone', 500);
  }
};
