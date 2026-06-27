import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { switchPortal } from '../context/Auth/authSlice';
import { canSwitchPortals } from '../utils/portalConfig';

const PortalSwitcher = ({ compact = false, lightTheme = false }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const permissionFlags = useSelector((state) => state.auth.permissionFlags) || {};
  const availablePortals = useSelector((state) => state.auth.availablePortals) || [];
  const activePortal = useSelector((state) => state.auth.activePortal);

  if (!canSwitchPortals(user, permissionFlags)) return null;
  if (availablePortals.length <= 1) return null;

  const handleSelect = (portal) => {
    if (portal.id === activePortal) return;
    dispatch(switchPortal(portal.id));
    navigate(portal.home);
  };

  return (
    <div
      className={`flex flex-wrap gap-1 ${compact ? 'px-2 py-2' : 'px-3 py-3'}`}
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
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all duration-200 ${
              isActive
                ? 'text-white shadow-md'
                : lightTheme
                  ? 'text-slate-600 hover:bg-slate-100'
                  : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
            }`}
            style={
              isActive
                ? { backgroundColor: 'var(--color-primary)' }
                : undefined
            }
          >
            {portal.label}
          </button>
        );
      })}
    </div>
  );
};

export default PortalSwitcher;
