import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from '../utils/axios';

/** Replace legacy bookmarks with the stable company-name address, for guests too. */
export default function useCanonicalCareerUrl(organizationId) {
    const navigate = useNavigate();
    const { pathname, search, hash } = useLocation();
    useEffect(() => {
        if (!/^[a-f\d]{24}$/i.test(organizationId || '')) return undefined;
        let cancelled = false;
        axios.post(`/v1/public/recruitment/${organizationId}/portal-link`, {})
            .then(({ data }) => {
                const slug = data?.data?.slug;
                if (cancelled || typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return;
                const canonicalPath = pathname.replace(/^\/careers\/[^/]+/, `/careers/${slug}`);
                if (canonicalPath !== pathname) navigate(`${canonicalPath}${search}${hash}`, { replace: true });
            })
            .catch(() => { /* Keep working ID links if the backend is temporarily unavailable. */ });
        return () => { cancelled = true; };
    }, [organizationId, pathname, search, hash, navigate]);
}
