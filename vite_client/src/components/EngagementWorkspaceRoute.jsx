import React from 'react';
import { Navigate } from 'react-router-dom';
import useEngagementWorkspace from '../Hooks/useEngagementWorkspace';

export default function EngagementWorkspaceRoute({ access = 'workspace', children }) {
    const { canAccessWorkspace, canManageSurveys } = useEngagementWorkspace();
    if (!(access === 'manage' ? canManageSurveys : canAccessWorkspace)) {
        return <Navigate to="/employee/engagement" replace />;
    }
    return children;
}
