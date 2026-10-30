import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from '../utils/axios';

/** Resolve ID links from the same authenticated tenant as the Recruitment APIs. */
export default function useCareerPortalIdentifier() {
    const user = useSelector(state => state.auth.user);
    const rawOrg = user?.organizationId;
    const sessionKey = `${user?._id || user?.id || ''}:${typeof rawOrg === 'object' && rawOrg ? rawOrg._id || rawOrg.id || '' : rawOrg || ''}`;
    const [resolved, setResolved] = useState(null);
    useEffect(() => {
        let cancelled = false;
        axios.get('/v1/admin/recruitment/career-link', { withCredentials: true })
            .then(({ data }) => {
                const id = data?.data?.organizationId;
                if (!cancelled && typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)) {
                    setResolved({ sessionKey, id });
                }
            })
            .catch(() => { /* Do not offer a potentially different tenant's link. */ });
        return () => { cancelled = true; };
    }, [sessionKey]);
    return resolved?.sessionKey === sessionKey ? resolved.id : '';
}
