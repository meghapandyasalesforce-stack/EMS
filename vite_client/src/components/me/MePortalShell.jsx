import React, { useEffect, useMemo } from 'react';
import {
  FaBell,
  FaBriefcase,
  FaFolderOpen,
  FaHome,
  FaMoneyBill,
  FaSeedling,
  FaSignOutAlt,
  FaTimes,
  FaBars,
  FaClock,
} from 'react-icons/fa';
import { FiHeadphones } from 'react-icons/fi';
import { VscProject } from 'react-icons/vsc';
import NotificationDropdown from '../NotificationDropdown';
import PortalSwitcher from '../PortalSwitcher';
import ProfileDropdown from '../ProfileDropdown';
import SidebarNavList from '../SidebarNavList';
import ProfilePicture from '../../Shared/ProfilePicture';
import MeWordmark from './MeWordmark';

const BOTTOM_DEFS = [
  { path: '/dashboard-employee', name: 'Home', icon: <FaHome /> },
  { path: '/employee/leave-attendance', name: 'Time', icon: <FaClock /> },
  { path: '/employee-payroll', name: 'Pay', icon: <FaMoneyBill /> },
  { path: '/employee/documents-id', name: 'Docs', icon: <FaFolderOpen /> },
];

/**
 * Me-portal-only chrome: phone bottom bar, tablet icon rail, desktop sidebar.
 * Reuses existing navigate / logout / profile handlers — no auth logic.
 */
const MePortalShell = ({
  viewport,
  navItems = [],
  desktopNavItems = [],
  isActive,
  onNavigate,
  profile,
  profileDropdownOpen,
  setProfileDropdownOpen,
  profileDropdownRef,
  onOpenLogout,
  onViewProfile,
  drawerOpen,
  setDrawerOpen,
  moreOpen,
  setMoreOpen,
}) => {
  const isPhone = viewport === 'phone';
  const isTablet = viewport === 'tablet';
  const isDesktop = viewport === 'desktop';

  const bottomItems = useMemo(
    () => BOTTOM_DEFS.filter((def) => navItems.some((n) => n.path === def.path)),
    [navItems]
  );

  const moreNavItems = useMemo(() => {
    const items = desktopNavItems.length ? desktopNavItems : navItems;
    return items.filter((item) => !BOTTOM_DEFS.some((def) => def.path === item.path));
  }, [desktopNavItems, navItems]);

  useEffect(() => {
    if (!(drawerOpen || moreOpen)) return undefined;
    if (!isPhone && !isTablet) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen, moreOpen, isPhone, isTablet]);

  useEffect(() => {
    if (!drawerOpen || (!isPhone && !isTablet)) return undefined;
    const previousFocus = document.activeElement;
    document.querySelector('#me-navigation-drawer button[aria-label="Close menu"]')?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [drawerOpen, isPhone, isTablet, setDrawerOpen]);

  const go = (path) => {
    setMoreOpen(false);
    setDrawerOpen(false);
    onNavigate(path);
  };

  const TopActions = ({ showHamburger = false }) => (
    <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
      {showHamburger ? (
        <button
          type="button"
          aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setDrawerOpen((v) => !v)}
          className="me-touch-target me-focus-ring inline-flex items-center justify-center rounded-full p-2 text-[var(--me-secondary)] hover:bg-[var(--me-tertiary)]"
        >
          {drawerOpen ? <FaTimes className="text-xl" /> : <FaBars className="text-xl" />}
        </button>
      ) : null}
      <NotificationDropdown />
      <button
        type="button"
        className="me-topbar-help"
        aria-label="Helpdesk"
        title="Helpdesk"
        onClick={() => go('/helpdesk')}
      >
        <FiHeadphones aria-hidden />
      </button>
      <div className="relative" ref={profileDropdownRef}>
        <button
          type="button"
          onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
          className="relative shrink-0 rounded-full p-1 transition-all duration-200 me-focus-ring"
          aria-label="Profile menu"
        >
          <ProfilePicture user={profile} size="header" />
        </button>
        {profileDropdownOpen ? (
          <ProfileDropdown
            isOpen
            onClose={() => setProfileDropdownOpen(false)}
            onLogout={onOpenLogout}
            onViewProfile={onViewProfile}
          />
        ) : null}
      </div>
    </div>
  );

  const Drawer = ({ items }) =>
    drawerOpen ? (
      <>
        <button
          type="button"
          aria-label="Close menu overlay"
          className="fixed inset-0 z-[10045] bg-black/40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
        <div
          className="fixed inset-0 z-[10050] flex flex-col overflow-hidden bg-white text-gray-800 md:inset-y-0 md:left-[var(--me-rail-width)] md:right-auto md:w-[min(20rem,calc(100vw-var(--me-rail-width)))] md:border-r md:border-gray-200 md:shadow-xl"
          style={{
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
          id="me-navigation-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
            <MeWordmark />
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
              className="me-touch-target me-focus-ring rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            >
              <FaTimes className="text-xl" />
            </button>
          </div>
          <div className="shrink-0 px-2 py-2">
            <PortalSwitcher compact lightTheme />
          </div>
          <nav className="me-employee-navigation min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-2 py-2 pb-4" data-hrms-sidebar-nav>
            <SidebarNavList flat items={items} isActive={isActive} onNavigate={go} lightTheme />
          </nav>
        </div>
      </>
    ) : null;

  return (
    <>
      {/* Phone top bar */}
      {isPhone ? (
        <header className="me-phone-topbar safe-area-top relative z-30 w-full shrink-0 border-b border-white/10 bg-[#0e2b3d] text-white shadow-sm">
          <div className="flex min-h-20 min-w-0 items-center justify-between gap-2 px-3 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={drawerOpen}
                aria-controls="me-navigation-drawer"
                onClick={() => {
                  setMoreOpen(false);
                  setDrawerOpen((open) => !open);
                }}
                className="me-touch-target me-focus-ring inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/10"
              >
                {drawerOpen ? <FaTimes className="text-xl" aria-hidden="true" /> : <FaBars className="text-xl" aria-hidden="true" />}
              </button>
            </div>
            <TopActions />
          </div>
        </header>
      ) : null}

      {isPhone ? <Drawer items={desktopNavItems.length ? desktopNavItems : navItems} /> : null}

      {/* Tablet icon rail */}
      {isTablet ? (
        <>
          <div
            data-hrms-sidebar
            className="me-portal-sidebar me-portal-sidebar--rail ui-shell-sidebar ui-shell-sidebar--light fixed top-0 left-0 z-[10050] flex h-dvh flex-col overflow-hidden border-r text-gray-700"
          >
            <div className="flex flex-shrink-0 items-center justify-center border-b border-gray-200 bg-white py-4">
              <span className="me-wordmark-p text-xl font-extrabold" aria-hidden>
                p
              </span>
              <span className="sr-only">paarsiv</span>
            </div>
            <nav
              data-hrms-sidebar-nav
              className="me-employee-navigation scrollbar-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1 py-2"
            >
              <SidebarNavList
                items={desktopNavItems}
                isActive={isActive}
                onNavigate={onNavigate}
                lightTheme
                flat
              />
            </nav>
            <div className="flex justify-center border-t border-gray-200 p-2">
              <button
                type="button"
                aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
                onClick={() => setDrawerOpen((v) => !v)}
                className="me-touch-target me-focus-ring rounded-lg p-2 text-gray-600 hover:bg-gray-100"
              >
                {drawerOpen ? <FaTimes /> : <FaBars />}
              </button>
            </div>
          </div>
          <div className="ui-shell-topbar">
            <PortalSwitcher lightTheme />
            <div className="ui-shell-topbar__actions">
              <TopActions />
            </div>
          </div>
          <Drawer items={desktopNavItems} />
        </>
      ) : null}

      {/* Desktop sidebar */}
      {isDesktop ? (
        <>
          <div
            data-hrms-sidebar
            className="me-portal-sidebar ui-shell-sidebar ui-shell-sidebar--light fixed top-0 left-0 z-[10050] flex h-dvh flex-col overflow-hidden border-r text-gray-700"
          >
            <div className="flex flex-shrink-0 items-center justify-center border-b border-gray-200 bg-white p-6">
              <MeWordmark className="text-3xl" />
            </div>
            <nav
              data-hrms-sidebar-nav
              className="me-employee-navigation scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-2"
            >
              <SidebarNavList
                items={desktopNavItems}
                isActive={isActive}
                onNavigate={onNavigate}
                lightTheme
                flat
              />
            </nav>
          </div>
          <div className="ui-shell-topbar">
            <PortalSwitcher lightTheme />
            <div className="ui-shell-topbar__actions">
              <NotificationDropdown />
              <button
                type="button"
                className="me-topbar-help"
                aria-label="Helpdesk"
                title="Helpdesk"
                onClick={() => onNavigate('/helpdesk')}
              >
                <FiHeadphones aria-hidden />
              </button>
              <div className="relative" ref={profileDropdownRef}>
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="relative shrink-0 rounded-full p-0.5 me-focus-ring"
                  aria-label="Profile menu"
                >
                  <ProfilePicture user={profile} size="header" />
                </button>
                {profileDropdownOpen ? (
                  <ProfileDropdown
                    isOpen
                    onClose={() => setProfileDropdownOpen(false)}
                    onLogout={onOpenLogout}
                    onViewProfile={onViewProfile}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* Phone floating bottom bar */}
      {isPhone ? (
        <nav className="me-bottom-nav" aria-label="Primary">
          {bottomItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                type="button"
                className={`me-bottom-nav__item${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => go(item.path)}
              >
                <span aria-hidden>{item.icon}</span>
                {item.name}
              </button>
            );
          })}
          <button
            type="button"
            className={`me-bottom-nav__item${moreOpen || moreNavItems.some((item) => isActive(item.path)) ? ' is-active' : ''}`}
            aria-expanded={moreOpen}
            aria-label="More"
            onClick={() => setMoreOpen(true)}
          >
            <span aria-hidden>
              <FaBriefcase />
            </span>
            More
          </button>
        </nav>
      ) : null}

      {/* More full-screen sheet (phone) */}
      {isPhone && moreOpen ? (
        <>
          <button
            type="button"
            className="me-more-sheet-backdrop"
            aria-label="Close more menu"
            onClick={() => setMoreOpen(false)}
          />
          <div className="me-more-sheet" role="dialog" aria-modal="true" aria-label="More">
            <div className="me-more-sheet__header">
              <MeWordmark />
              <button
                type="button"
                aria-label="Close"
                className="me-touch-target me-focus-ring rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                onClick={() => setMoreOpen(false)}
              >
                <FaTimes className="text-xl" />
              </button>
            </div>
            <ul className="me-more-sheet__list">
              {moreNavItems.map((item) => (
                <li key={item.path}>
                  <button type="button" className={`me-more-sheet__item${isActive(item.path) ? ' is-active' : ''}`} aria-current={isActive(item.path) ? 'page' : undefined} onClick={() => go(item.path)}>
                    <span className="me-more-sheet__icon" aria-hidden>
                      {item.icon || <FaSeedling />}
                    </span>
                    {item.name}
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="me-more-sheet__item" onClick={() => go('/notifications')}>
                  <span className="me-more-sheet__icon" aria-hidden>
                    <FaBell />
                  </span>
                  Notifications
                </button>
              </li>
              <li>
                <button type="button" className="me-more-sheet__item" onClick={() => go('/helpdesk')}>
                  <span className="me-more-sheet__icon" aria-hidden>
                    <FiHeadphones />
                  </span>
                  Helpdesk
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="me-more-sheet__item me-more-sheet__item--danger"
                  onClick={() => {
                    setMoreOpen(false);
                    onOpenLogout();
                  }}
                >
                  <span className="me-more-sheet__icon" aria-hidden>
                    <FaSignOutAlt />
                  </span>
                  Logout
                </button>
              </li>
            </ul>
          </div>
        </>
      ) : null}
    </>
  );
};

export default MePortalShell;
