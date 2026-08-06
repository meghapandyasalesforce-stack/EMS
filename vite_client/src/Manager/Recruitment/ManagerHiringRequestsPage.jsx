import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/** Redirect old path → unified Hiring hub */
const ManagerHiringRequestsPage = () => {
    const navigate = useNavigate();
    useEffect(() => {
        navigate('/employee/internal-jobs?tab=hire', { replace: true });
    }, [navigate]);
    return null;
};

export default ManagerHiringRequestsPage;
