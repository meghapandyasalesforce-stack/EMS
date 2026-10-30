import { useEffect, useState } from 'react';
import axios from '../utils/axios';

/** Prefer the stable company slug; retain legacy ID links if unavailable. */
export default function useCareerPortalIdentifier(organizationId) {
    const fallback = typeof organizationId === 'object' && organizationId
        ? String(organizationId._id || organizationId.id || '')
        : String(organizationId || '');
    const [resolved, setResolved] = useState(null);
    useEffect(() => {
        let cancelled = false;
        axios.post('/v1/admin/recruitment/career-link', {}, { withCredentials: true })
            .then(({ data }) => {
                if (!cancelled && data?.data?.slug) setResolved({ organizationId: fallback, slug: data.data.slug });
            })
            .catch(() => { /* Existing ID links remain usable during rollout. */ });
        return () => { cancelled = true; };
    }, [fallback]);
    return resolved?.organizationId === fallback ? resolved.slug : fallback;
}
