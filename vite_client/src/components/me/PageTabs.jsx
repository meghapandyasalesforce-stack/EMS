import React, { useCallback, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';

/**
 * Presentational sticky segmented tabs for Me portal hubs.
 * Syncs active tab via ?tab= (default) or nested path segments — no business logic.
 *
 * @param {Array<{ id: string, label: string, path?: string }>} tabs
 * @param {string} [paramKey='tab'] search param key when using query mode
 * @param {'query'|'path'} [mode='query']
 * @param {string} [activeId] controlled active id (optional)
 * @param {(id: string) => void} [onChange] optional callback after navigation
 * @param {string} [className]
 * @param {string} [ariaLabel='Section tabs']
 */
const PageTabs = ({
  tabs = [],
  paramKey = 'tab',
  mode = 'query',
  activeId,
  onChange,
  className = '',
  ariaLabel = 'Section tabs',
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const resolvedActive = useMemo(() => {
    if (activeId) return activeId;
    if (!tabs.length) return '';
    if (mode === 'path') {
      const match = tabs.find(
        (t) =>
          t.path &&
          (location.pathname === t.path || location.pathname.startsWith(`${t.path}/`))
      );
      return match?.id || tabs[0].id;
    }
    const fromQuery = searchParams.get(paramKey);
    if (fromQuery && tabs.some((t) => t.id === fromQuery)) return fromQuery;
    return tabs[0].id;
  }, [activeId, tabs, mode, location.pathname, searchParams, paramKey]);

  const selectTab = useCallback(
    (tab) => {
      if (mode === 'path' && tab.path) {
        navigate(tab.path);
      } else {
        const next = new URLSearchParams(searchParams);
        next.set(paramKey, tab.id);
        navigate({ pathname: location.pathname, search: `?${next.toString()}` }, { replace: false });
      }
      if (onChange) onChange(tab.id);
    },
    [mode, navigate, searchParams, paramKey, location.pathname, onChange]
  );

  if (!tabs.length) return null;

  return (
    <div className={`me-page-tabs ${className}`.trim()} role="navigation" aria-label={ariaLabel}>
      <div className="me-page-tabs__scroller" role="tablist">
        {tabs.map((tab) => {
          const selected = tab.id === resolvedActive;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`me-page-tabs__tab${selected ? ' is-active' : ''}`}
              onClick={() => selectTab(tab)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PageTabs;
