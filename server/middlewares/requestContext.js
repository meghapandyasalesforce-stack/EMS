/**
 * Request context middleware
 * Initializes AsyncLocalStorage for per-request context
 */
import { runWithRequestContext } from '../helpers/requestContext.js';

const requestContextMiddleware = (req, res, next) => {
    const initialContext = {
        requestId: req.id
    };

    runWithRequestContext(initialContext, () => next());
};

export default requestContextMiddleware;

