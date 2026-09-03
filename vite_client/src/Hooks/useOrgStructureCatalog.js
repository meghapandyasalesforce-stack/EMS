import { useCallback, useEffect, useState } from 'react';
import axios from '../utils/axios';

const emptyCatalog = {
    departments: [],
    teams: [],
    jobFamilies: [],
    jobRoles: [],
    designations: [],
    locations: [],
    employmentTypes: [],
    workModes: [],
};

export function useOrgStructureCatalog(departmentId = null) {
    const [catalog, setCatalog] = useState(emptyCatalog);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = departmentId ? { departmentId } : {};
            const res = await axios.get('/v1/admin/org-structure/catalog', {
                params,
                withCredentials: true,
            });
            const data = res.data?.data || res.data || emptyCatalog;
            setCatalog({ ...emptyCatalog, ...data });
        } catch (err) {
            setError(err);
            setCatalog(emptyCatalog);
        } finally {
            setLoading(false);
        }
    }, [departmentId]);

    useEffect(() => {
        load();
    }, [load]);

    return { catalog, loading, error, reload: load };
}

export default useOrgStructureCatalog;
