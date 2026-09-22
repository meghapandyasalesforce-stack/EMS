import React, { useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { fetchPlatformPlans, platformLogout } from '../../context/platformSlice';
import {
  FiGrid,
  FiLogOut,
  FiLayers,
  FiHome,
  FiUsers,
  FiPlus,
  FiBookOpen,
  FiClipboard,
} from 'react-icons/fi';

const PlatformShell = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.platform.user);

  useEffect(() => {
    dispatch(fetchPlatformPlans());
  }, [dispatch]);

  const handleLogout = async () => {
    try {
      await dispatch(platformLogout()).unwrap();
      toast.success('Logged out');
      navigate('/platform/login', { replace: true });
    } catch {
      navigate('/platform/login', { replace: true });
    }
  };

  const navClass = ({ isActive }) =>
    `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
      isActive
        ? 'bg-slate-800 text-white'
        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
    }`;

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <aside className="flex w-64 flex-col border-r border-slate-800 bg-slate-950 text-white">
        <div className="border-b border-slate-800 px-5 py-5">
          <Link to="/platform" className="block">
            <div className="text-xs uppercase tracking-widest text-slate-400">Paarsiv EMS</div>
            <div className="mt-1 text-lg font-semibold">Control Panel</div>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <NavLink to="/platform" end className={navClass}>
            <FiHome /> Dashboard
          </NavLink>
          <NavLink to="/platform/organizations" className={navClass}>
            <FiGrid /> Organizations
          </NavLink>
          <NavLink to="/platform/organizations/new" className={navClass}>
            <FiPlus /> Create org
          </NavLink>
          <div className="px-3 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Catalog
          </div>
          <NavLink to="/platform/plans" className={navClass}>
            <FiLayers /> Plans
          </NavLink>
          <NavLink to="/platform/feature-catalog" className={navClass}>
            <FiBookOpen /> Feature catalog
          </NavLink>
          <div className="px-3 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Security
          </div>
          <NavLink to="/platform/operators" className={navClass}>
            <FiUsers /> Operators
          </NavLink>
          <NavLink to="/platform/audit-logs" className={navClass}>
            <FiClipboard /> Audit logs
          </NavLink>
        </nav>
        <div className="border-t border-slate-800 p-4">
          <div className="mb-1 truncate text-sm text-slate-300">{user?.email}</div>
          {!!user?.roles?.length && (
            <div className="mb-3 truncate text-xs text-slate-500">{user.roles.join(', ')}</div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
          >
            <FiLogOut /> Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default PlatformShell;
