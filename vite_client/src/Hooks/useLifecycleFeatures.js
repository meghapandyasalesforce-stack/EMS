/**
 * Org Configure feature flags — single source of truth for lifecycle UI.
 * Available to both HR/Admin (admin registry) and employees (both features endpoint).
 *
 * Pass `showAll: true` to treat every feature as enabled (temporary: Configure UI hidden).
 */

import { useCallback, useEffect, useState } from 'react';
import axios from '../utils/axios';
import { ADMIN_LIFECYCLE_ENDPOINT, BOTH_LIFECYCLE_ENDPOINT } from '../utils/constant';

const cache = { data: null, fetchedAt: 0 };
const CACHE_MS = 5_000;

export function useLifecycleFeatures({ admin = false, showAll = false } = {}) {
    const [enabledFeatures, setEnabledFeatures] = useState(cache.data?.enabledFeatures || {});
    const [modules, setModules] = useState(cache.data?.modules || { onboarding: true, offboarding: true });
    const [loading, setLoading] = useState(!cache.data);
    const [loaded, setLoaded] = useState(Boolean(cache.data));

    const load = useCallback(async (force = false) => {
        if (!force && cache.data && Date.now() - cache.fetchedAt < CACHE_MS) {
            setEnabledFeatures(cache.data.enabledFeatures || {});
            setModules(cache.data.modules || { onboarding: true, offboarding: true });
            setLoading(false);
            setLoaded(true);
            return cache.data;
        }
        try {
            setLoading(true);
            let payload;
            if (admin) {
                const { data } = await axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/registry`, { withCredentials: true });
                const settings = data.data?.settings || {};
                payload = {
                    enabledFeatures: settings.enabledFeatures || {},
                    modules: {
                        onboarding: settings.modules?.onboarding?.enabled !== false,
                        offboarding: settings.modules?.offboarding?.enabled !== false,
                    },
                };
            } else {
                const { data } = await axios.get(`${BOTH_LIFECYCLE_ENDPOINT}/features`, { withCredentials: true });
                payload = data.data || {};
            }
            cache.data = payload;
            cache.fetchedAt = Date.now();
            setEnabledFeatures(payload.enabledFeatures || {});
            setModules(payload.modules || { onboarding: true, offboarding: true });
            setLoaded(true);
            return payload;
        } catch {
            return null;
        } finally {
            setLoading(false);
        }
    }, [admin]);

    useEffect(() => { load(); }, [load]);

    const isEnabled = useCallback((key) => {
        if (!key || showAll) return true;
        // Fail-closed until first successful load — avoids briefly showing disabled features
        if (!loaded) return false;
        if (!enabledFeatures || !Object.keys(enabledFeatures).length) return false;
        return enabledFeatures[key] === true;
    }, [enabledFeatures, loaded, showAll]);

    const isModuleOn = useCallback((module) => {
        if (showAll) return true;
        if (!loaded) return false;
        if (module === 'onboarding') return modules?.onboarding !== false;
        if (module === 'offboarding') return modules?.offboarding !== false;
        return true;
    }, [modules, loaded, showAll]);

    /** Filter workflow items by Configure featureKey (tasks, docs, checklist, etc.). */
    const filterByFeature = useCallback((items = []) => (
        (items || []).filter((item) => {
            if (!item?.featureKey || showAll) return true;
            return isEnabled(item.featureKey);
        })
    ), [isEnabled, showAll]);

    const refresh = useCallback(() => load(true), [load]);

    return {
        enabledFeatures,
        modules,
        isEnabled,
        isModuleOn,
        filterByFeature,
        loading,
        loaded,
        refresh,
    };
}

export function clearLifecycleFeaturesCache() {
    cache.data = null;
    cache.fetchedAt = 0;
}

export default useLifecycleFeatures;
