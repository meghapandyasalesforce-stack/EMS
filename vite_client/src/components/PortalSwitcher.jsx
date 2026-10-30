import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { switchPortal, checkAuthSession } from '../context/Auth/authSlice';
import { fetchEmployeeOwnInfo } from '../context/employeeDetailsSlice';
import { canSwitchPortals, PORTAL_META } from '../utils/portalConfig';

const PortalSwitcher = ({ compact = false, lightTheme = false }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const permissionFlags = useSelector((state) => state.auth.permissionFlags) || {};
  const roleBuckets = useSelector((state) => state.auth.roleBuckets) || [];
  const availablePortals = useSelector((state) => state.auth.availablePortals) || [];
  const activePortal = useSelector((state) => state.auth.activePortal);

  if (!canSwitchPortals(user, permissionFlags, roleBuckets)) return null;
  if (availablePortals.length <= 1) return null;

  const handleSelect = (portal) => {
    if (portal.id === activePortal) return;
    dispatch(switchPortal(portal.id));
    // Older persisted portal objects may still point Me to a manager dashboard.
    navigate(portal.id === 'employee' ? PORTAL_META.employee.home : portal.home);
    if (portal.id === 'employee') {
      dispatch(checkAuthSession());
      dispatch(fetchEmployeeOwnInfo());
    }
  };

  return (
    <div
      className={`ui-portal-switcher ${lightTheme ? '' : 'ui-portal-switcher--on-dark'} ${compact ? 'px-1' : ''}`.trim()}
      role="tablist"
      aria-label="Switch portal"
    >
      {availablePortals.map((portal) => {
        const isActive = portal.id === activePortal;
        return (
          <button
            key={portal.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => handleSelect(portal)}
            className={`ui-portal-switcher__btn ${isActive ? 'is-active' : ''}`}
          >
            {portal.label}
          </button>
        );
      })}
    </div>
  );
};

export default PortalSwitcher;
