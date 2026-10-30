import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from '../utils/axios';

/** Canonicalize only identifiers verified by the server against a saved organization. */
export default function useCanonicalCareerUrl(organizationId) {
    const navigate = useNavigate();
    const { pathname, search, hash } = useLocation();
    useEffect(() => {
        if (!organizationId) return undefined;
        let cancelled = false;
        axios.post(`/v1/public/recruitment/${organizationId}/portal-link`, {})
            .then(({ data }) => {
                const slug = data?.data?.slug;
                if (cancelled || typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return;
                const canonicalPath = pathname.replace(/^\/careers\/[^/]+/, `/careers/${slug}`);
                if (canonicalPath !== pathname) navigate(`${canonicalPath}${search}${hash}`, { replace: true });
            })
            .catch(() => { /* Keep working career links if the backend is temporarily unavailable. */ });
        return () => { cancelled = true; };
    }, [organizationId, pathname, search, hash, navigate]);
}
