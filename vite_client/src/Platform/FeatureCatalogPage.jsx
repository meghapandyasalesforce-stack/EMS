import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { FiChevronDown, FiDownload, FiLayers, FiRefreshCw, FiSearch } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { fetchFeatureCatalog, fetchPlatformPlans } from '../context/platformSlice';
import '../styles/platformFeatureCatalog.css';

const FeatureCatalogPage = () => {
  const dispatch = useDispatch();
  const { featureCatalog, featureLabels, plans, loading } = useSelector((state) => state.platform);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [openCategories, setOpenCategories] = useState({});

  useEffect(() => {
    dispatch(fetchPlatformPlans());
    dispatch(fetchFeatureCatalog())
      .unwrap()
      .catch((err) => {
        const message = typeof err === 'string' ? err : 'Failed to load catalog';
        if (!/session expired|log in again/i.test(message)) toast.error(message);
      });
  }, [dispatch]);

  useEffect(() => {
    if (!featureCatalog?.length) return;
    setOpenCategories((prev) => {
      const next = { ...prev };
      featureCatalog.forEach((cat, idx) => {
        if (next[cat.category] === undefined) next[cat.category] = idx < 2;
      });
      return next;
    });
  }, [featureCatalog]);

  const allItems = useMemo(() => {
    const rows = [];
    (featureCatalog || []).forEach((cat) => {
      (cat.items || []).forEach((item) => {
        rows.push({ ...item, category: cat.category });
      });
    });
    return rows;
  }, [featureCatalog]);

  const plansForKey = (featureKey) =>
    (plans || [])
      .filter((p) => p.moduleFeatures && p.moduleFeatures[featureKey])
      .map((p) => p.name || p.id);

  const kpi = useMemo(() => {
    const moduleCount = allItems.length;
    const submoduleCount = allItems.reduce(
      (sum, item) => sum + (item.submodules?.length || 0),
      0
    );
    const categoryCount = featureCatalog?.length || 0;
    const coveredByPlans = allItems.filter((item) => plansForKey(item.featureKey).length > 0)
      .length;
    return { moduleCount, submoduleCount, categoryCount, coveredByPlans };
  }, [allItems, featureCatalog, plans]);

  const categories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (featureCatalog || [])
      .filter((cat) => categoryFilter === 'all' || cat.category === categoryFilter)
      .map((cat) => {
        const items = (cat.items || []).filter((item) => {
          if (!q) return true;
          const label = (item.label || featureLabels[item.featureKey] || '').toLowerCase();
          const key = String(item.featureKey || '').toLowerCase();
          const desc = String(item.description || '').toLowerCase();
          const subs = (item.submodules || []).join(' ').toLowerCase();
          return (
            label.includes(q) ||
            key.includes(q) ||
            desc.includes(q) ||
            subs.includes(q) ||
            cat.category.toLowerCase().includes(q)
          );
        });
        return { ...cat, items };
      })
      .filter((cat) => cat.items.length > 0);
  }, [featureCatalog, categoryFilter, search, featureLabels]);

  const toggleCategory = (name) => {
    setOpenCategories((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const expandAll = () => {
    const next = {};
    (featureCatalog || []).forEach((cat) => {
      next[cat.category] = true;
    });
    setOpenCategories(next);
  };

  const collapseAll = () => {
    const next = {};
    (featureCatalog || []).forEach((cat) => {
      next[cat.category] = false;
    });
    setOpenCategories(next);
  };

  const exportExcel = () => {
    try {
      const rows = [];
      (featureCatalog || []).forEach((cat) => {
        (cat.items || []).forEach((item) => {
          const planNames = plansForKey(item.featureKey);
          rows.push({
            Category: cat.category || '',
            Module: item.label || featureLabels[item.featureKey] || item.featureKey || '',
            Key: item.featureKey || '',
            Description: item.description || '',
            Capabilities: (item.submodules || []).join(', '),
            Plans: planNames.length ? planNames.join(', ') : 'None',
          });
        });
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 18 },
        { wch: 28 },
        { wch: 28 },
        { wch: 40 },
        { wch: 36 },
        { wch: 28 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Feature Catalog');
      XLSX.writeFile(wb, 'feature-catalog.xlsx');
      toast.success('Excel downloaded');
    } catch {
      toast.error('Export failed');
    }
  };

  const refresh = () => {
    Promise.all([
      dispatch(fetchFeatureCatalog()).unwrap(),
      dispatch(fetchPlatformPlans()).unwrap(),
    ])
      .then(() => toast.success('Catalog refreshed'))
      .catch((err) => {
        const message = typeof err === 'string' ? err : 'Failed to refresh';
        if (!/session expired|log in again/i.test(message)) toast.error(message);
      });
  };

  if (loading && !featureCatalog?.length) {
    return (
      <div className="platform-feat-catalog">
        <div className="fc-empty">Loading feature catalog…</div>
      </div>
    );
  }

  return (
    <div className="platform-feat-catalog">
      <div className="fc-header">
        <div>
          <h1 className="fc-title">Platform Feature Catalog</h1>
          <p className="fc-sub">
            Global registry of modules and entitlement keys across subscription tiers. Plan matrices
            and org overrides gate these keys.
          </p>
        </div>
        <div className="fc-actions">
          <button type="button" className="fc-btn fc-btn-secondary" onClick={refresh}>
            <FiRefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </button>
          <button type="button" className="fc-btn fc-btn-primary" onClick={exportExcel}>
            <FiDownload className="h-4 w-4" aria-hidden />
            Export Excel
          </button>
        </div>
      </div>

      <div className="fc-kpi-grid">
        <div className="fc-kpi">
          <div className="fc-kpi-label">Registered modules</div>
          <div className="fc-kpi-value">{kpi.moduleCount}</div>
          <div className="fc-kpi-meta">
            <span className="fc-pill fc-pill-ok">{kpi.categoryCount} categories</span>
          </div>
        </div>
        <div className="fc-kpi">
          <div className="fc-kpi-label">Capabilities</div>
          <div className="fc-kpi-value">{kpi.submoduleCount}</div>
          <div className="fc-kpi-meta">Listed submodules</div>
        </div>
        <div className="fc-kpi">
          <div className="fc-kpi-label">Plan coverage</div>
          <div className="fc-kpi-value">{kpi.coveredByPlans}</div>
          <div className="fc-kpi-meta">Modules enabled on ≥1 plan</div>
        </div>
        <div className="fc-kpi">
          <div className="fc-kpi-label">Catalog plans</div>
          <div className="fc-kpi-value">{plans?.length || 0}</div>
          <div className="fc-kpi-meta">
            <span className="fc-pill fc-pill-muted">Live matrix</span>
          </div>
        </div>
      </div>

      <div className="fc-toolbar">
        <div className="fc-search">
          <FiSearch className="fc-search-icon h-4 w-4" aria-hidden />
          <input
            className="fc-input"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search modules, keys, capabilities…"
            aria-label="Search feature catalog"
          />
        </div>
        <div className="fc-toolbar-row">
          <div className="fc-chips" role="toolbar" aria-label="Filter by category">
            <button
              type="button"
              className={`fc-chip ${categoryFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => setCategoryFilter('all')}
            >
              All modules
            </button>
            {(featureCatalog || []).map((cat) => (
              <button
                key={cat.category}
                type="button"
                className={`fc-chip ${categoryFilter === cat.category ? 'is-active' : ''}`}
                onClick={() => setCategoryFilter(cat.category)}
              >
                {cat.category}
              </button>
            ))}
          </div>
          <div className="fc-chips-actions">
            <button type="button" className="fc-link-btn" onClick={expandAll}>
              Expand all
            </button>
            <button type="button" className="fc-link-btn" onClick={collapseAll}>
              Collapse all
            </button>
          </div>
        </div>
      </div>

      {!categories.length ? (
        <div className="fc-empty">No modules match your filters.</div>
      ) : (
        categories.map((cat) => {
          const isOpen = !!openCategories[cat.category];
          return (
            <section
              key={cat.category}
              className={`fc-category ${isOpen ? 'is-open' : ''}`}
            >
              <button
                type="button"
                className="fc-category-toggle"
                onClick={() => toggleCategory(cat.category)}
                aria-expanded={isOpen}
              >
                <div>
                  <h2 className="fc-category-title">{cat.category}</h2>
                  <div className="fc-category-meta">
                    {cat.items.length} module{cat.items.length === 1 ? '' : 's'}
                  </div>
                </div>
                <FiChevronDown className="fc-chevron h-5 w-5" aria-hidden />
              </button>

              <div className="fc-category-body">
                {cat.items.map((item) => {
                  const label =
                    item.label || featureLabels[item.featureKey] || item.featureKey;
                  const onPlans = plansForKey(item.featureKey);
                  const subs = item.submodules || [];
                  return (
                    <article key={item.featureKey} className="fc-module">
                      <div className="fc-module-head">
                        <div>
                          <h3 className="fc-module-name">
                            <FiLayers
                              className="inline h-4 w-4 mr-1"
                              style={{ color: '#2A6B52' }}
                              aria-hidden
                            />
                            {label}
                          </h3>
                          <div className="fc-module-key">{item.featureKey}</div>
                        </div>
                        <span className="fc-pill fc-pill-ok">GA</span>
                      </div>
                      {item.description && (
                        <p className="fc-module-desc">{item.description}</p>
                      )}

                      {subs.length > 0 ? (
                        <div className="fc-sub-grid">
                          {subs.map((sub) => (
                            <div key={sub} className="fc-sub-card">
                              <div className="fc-sub-top">
                                <span className="fc-pill fc-pill-muted">Capability</span>
                              </div>
                              <div className="fc-sub-name">{sub}</div>
                              <div className="fc-plans">
                                {onPlans.length ? (
                                  onPlans.map((name) => (
                                    <span key={name} className="fc-plan-tag">
                                      {name}
                                    </span>
                                  ))
                                ) : (
                                  <span className="fc-plan-tag is-off">No plan yet</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="fc-plans">
                          {onPlans.length ? (
                            onPlans.map((name) => (
                              <span key={name} className="fc-plan-tag">
                                {name}
                              </span>
                            ))
                          ) : (
                            <span className="fc-plan-tag is-off">Not enabled on any plan</span>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
};

export default FeatureCatalogPage;
