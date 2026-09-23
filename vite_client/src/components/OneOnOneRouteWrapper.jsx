import React, { Suspense } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useSearchParams } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';

// Module-level lazy — creating React.lazy inside render remounts Suspense forever.
const ScheduleComponent = React.lazy(() => import('../Manager/OneOnOne/OneOnOnePage'));

/**
 * Organizer / sender page at /one-on-one.
 * Any authenticated user with a session can schedule 1:1s.
 */
const OneOnOneRouteWrapper = () => {
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const [searchParams] = useSearchParams();

    const meetingId = searchParams.get('meetingId') || '';

    if (!user && !employee) {
        return <Navigate to="/login" replace />;
    }

    return (
        <Suspense fallback={<LoadingSpinner message="Loading one-on-one meetings..." />}>
            <ScheduleComponent focusMeetingId={meetingId} />
        </Suspense>
    );
};

export default OneOnOneRouteWrapper;
