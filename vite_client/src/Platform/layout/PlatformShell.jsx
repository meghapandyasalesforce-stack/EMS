import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
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
  FiSearch,
  FiShield,
  FiMenu,
  FiX,
} from 'react-icons/fi';
import '../../styles/platformShell.css';

const PlatformShell = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector((state) => state.platform.user);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchPlatformPlans());
  }, [dispatch]);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

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
    `platform-shell__link${isActive ? ' is-active' : ''}`;

  const initials = (() => {
    const name = user?.name || user?.email || 'P';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return String(name).slice(0, 2).toUpperCase();
  })();

  return (
    <div className={`platform-shell${navOpen ? ' is-nav-open' : ''}`}>
      <button
        type="button"
        className="platform-shell__backdrop"
        aria-label="Close navigation"
        onClick={() => setNavOpen(false)}
      />

      <aside className="platform-shell__aside" aria-label="Platform navigation">
        <div>
          <Link to="/platform" className="platform-shell__brand" onClick={() => setNavOpen(false)}>
            <span className="platform-shell__brand-mark" aria-hidden>
              <FiShield />
            </span>
            <span>
              <div className="platform-shell__brand-title">Paarsiv EMS</div>
              <div className="platform-shell__brand-sub">Admin Control</div>
            </span>
          </Link>

          <nav className="platform-shell__nav" aria-label="Platform">
            <NavLink to="/platform" end className={navClass}>
              <FiHome /> Dashboard
            </NavLink>
            <NavLink to="/platform/organizations" className={navClass}>
              <FiGrid /> Organizations
            </NavLink>
            <NavLink to="/platform/organizations/new" className={navClass}>
              <FiPlus /> Create org
            </NavLink>
            <NavLink to="/platform/plans" className={navClass}>
              <FiLayers /> Plans
            </NavLink>
            <NavLink to="/platform/feature-catalog" className={navClass}>
              <FiBookOpen /> Feature Catalog
            </NavLink>
            <NavLink to="/platform/operators" className={navClass}>
              <FiUsers /> Operators
              <span className="platform-shell__badge">Super Admin</span>
            </NavLink>
            <NavLink to="/platform/audit-logs" className={navClass}>
              <FiClipboard /> Audit Logs
            </NavLink>
          </nav>
        </div>

        <div className="platform-shell__footer">
          <div className="platform-shell__status">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#fff' }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 9999,
                  background: '#1CCA9B',
                  display: 'inline-block',
                }}
              />
              Operational
            </span>
            <span style={{ color: 'rgba(168,213,197,0.7)' }}>Control panel</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(168,213,197,0.85)', wordBreak: 'break-all' }}>
            {user?.email}
          </div>
          <button type="button" onClick={handleLogout} className="platform-shell__link">
            <FiLogOut /> Sign out
          </button>
        </div>
      </aside>

      <div className="platform-shell__main">
        <header className="platform-shell__topbar">
          <button
            type="button"
            className="platform-shell__menu-btn"
            aria-label={navOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={navOpen}
            onClick={() => setNavOpen((o) => !o)}
          >
            {navOpen ? <FiX className="h-5 w-5" /> : <FiMenu className="h-5 w-5" />}
          </button>

          <div className="platform-shell__search">
            <FiSearch className="platform-shell__search-icon h-4 w-4" aria-hidden />
            <input
              type="search"
              placeholder="Search organizations…"
              aria-label="Platform search"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const q = e.currentTarget.value.trim();
                  if (q) navigate(`/platform/organizations?search=${encodeURIComponent(q)}`);
                }
              }}
            />
          </div>
          <div className="platform-shell__top-meta">
            <span className="platform-shell__uptime">
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 9999,
                  background: '#1CCA9B',
                  display: 'inline-block',
                }}
              />
              Platform secure · Encrypted session
            </span>
            <div className="platform-shell__user">
              <div className="platform-shell__avatar" aria-hidden>
                {initials}
              </div>
              <div className="platform-shell__user-text">
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>
                  {user?.name || 'Operator'}
                </div>
                <div style={{ fontSize: 11, color: '#5A7A70' }}>Platform Super Admin</div>
              </div>
            </div>
          </div>
        </header>

        <div className="platform-shell__content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default PlatformShell;
