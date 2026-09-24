import React, { Suspense } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useSearchParams } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';

// Module-level lazy — creating React.lazy inside render remounts Suspense forever.
const ReceiveComponent = React.lazy(() => import('../Employee/OneOnOne/EmployeeOneOnOnePage'));

/**
 * Personal / receiver page at /1-on-1 — My 1:1 Meetings UI.
 * Scheduling lives on /one-on-one (organizer page) only.
 */
const MyOneOnOneRoute = () => {
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const [searchParams] = useSearchParams();

    if (!user && !employee) {
        return <Navigate to="/login" replace />;
    }

    const meetingId = searchParams.get('meetingId') || '';

    return (
        <Suspense fallback={<LoadingSpinner message="Loading your 1:1 meetings..." />}>
            <ReceiveComponent focusMeetingId={meetingId} />
        </Suspense>
    );
};

export default MyOneOnOneRoute;
