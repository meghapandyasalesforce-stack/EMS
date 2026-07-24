import React from 'react';
import { Suspense } from 'react';
import ProtectedRoute from './ProtectedRoute';
import LoadingSpinner from './LoadingSpinner';

const AddProject = React.lazy(() => import('../Admin/project/AddProject'));

const AddProjectProtected = () => {
    return (
        <ProtectedRoute
            allowedRoles={['admin', 'manager', 'project_manager', 'hr', 'executive']}
            requiredPermissions={[
                'project.admin.view',
                'employee.view.all',
            ]}
        >
            <Suspense fallback={<LoadingSpinner message="Loading project form..." />}>
                <AddProject />
            </Suspense>
        </ProtectedRoute>
    );
};

export default AddProjectProtected;

