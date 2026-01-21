/**
 * Request context storage using AsyncLocalStorage
 * Used for passing organizationId to Mongoose queries automatically
 */
import { AsyncLocalStorage } from 'node:async_hooks';

const asyncLocalStorage = new AsyncLocalStorage();

export const runWithRequestContext = (context, fn) => {
    asyncLocalStorage.run(context, fn);
};

export const getRequestContext = () => asyncLocalStorage.getStore();

export const setRequestContextValue = (key, value) => {
    const store = asyncLocalStorage.getStore();
    if (store) {
        store[key] = value;
    }
};

export default {
    runWithRequestContext,
    getRequestContext,
    setRequestContextValue
};

