import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { FiCheck, FiEdit2, FiLayers, FiRefreshCw } from 'react-icons/fi';
import { fetchPlatformPlans, updatePlatformPlan } from '../context/platformSlice';
import '../styles/platformPlans.css';

const formatPrice = (price) => {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return 'Free';
  return `$${n.toLocaleString()}`;
};

const PlansPage = () => {
  const dispatch = useDispatch();
  const { plans, featureLabels, loading } = useSelector((state) => state.platform);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [filter, setFilter] = useState('active');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    dispatch(fetchPlatformPlans())
      .unwrap()
      .catch((err) => {
        const message = typeof err === 'string' ? err : 'Failed to load plans';
        if (!/session expired|log in again/i.test(message)) toast.error(message);
      });
  }, [dispatch]);

  useEffect(() => {
    const next = {};
    plans.forEach((plan) => {
      const modules = { ...(plan.moduleFeatures || {}) };
      Object.keys(featureLabels || {}).forEach((key) => {
        if (typeof modules[key] !== 'boolean') modules[key] = false;
      });
      next[plan.id] = {
        name: plan.name || '',
        price: plan.price ?? 0,
        maxEmployees: plan.maxEmployees ?? 10,
        trialDays: plan.trialDays ?? 14,
        featuresText: (plan.features || []).join('\n'),
        moduleFeatures: modules,
        isActive: plan.isActive !== false,
        sortOrder: plan.sortOrder ?? 0,
      };
    });
    setDrafts(next);
  }, [plans, featureLabels]);

  useEffect(() => {
    if (!plans.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev && plans.some((p) => p.id === prev)) return prev;
      const preferred = plans.find((p) => p.isActive !== false) || plans[0];
      return preferred?.id || null;
    });
  }, [plans]);

  const activePlans = useMemo(
    () => plans.filter((p) => p.isActive !== false),
    [plans]
  );
  const inactivePlans = useMemo(
    () => plans.filter((p) => p.isActive === false),
    [plans]
  );
  const visiblePlans = filter === 'active' ? activePlans : inactivePlans;

  const kpi = useMemo(() => {
    const totalOrgs = plans.reduce((sum, p) => sum + (Number(p.orgCount) || 0), 0);
    const priced = [...plans].sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    const top = priced[0];
    const avgSeats =
      plans.length > 0
        ? Math.round(
            plans.reduce((sum, p) => sum + (Number(p.maxEmployees) || 0), 0) / plans.length
          )
        : 0;
    return {
      activeCount: activePlans.length,
      totalOrgs,
      avgSeats,
      topPlan: top,
    };
  }, [plans, activePlans.length]);

  const setDraft = (planId, patch) => {
    setDrafts((prev) => ({ ...prev, [planId]: { ...prev[planId], ...patch } }));
  };

  const selectedDraft = selectedId ? drafts[selectedId] : null;
  const selectedPlan = plans.find((p) => p.id === selectedId);

  const resetSelected = () => {
    if (!selectedPlan) return;
    const modules = { ...(selectedPlan.moduleFeatures || {}) };
    Object.keys(featureLabels || {}).forEach((key) => {
      if (typeof modules[key] !== 'boolean') modules[key] = false;
    });
    setDraft(selectedPlan.id, {
      name: selectedPlan.name || '',
      price: selectedPlan.price ?? 0,
      maxEmployees: selectedPlan.maxEmployees ?? 10,
      trialDays: selectedPlan.trialDays ?? 14,
      featuresText: (selectedPlan.features || []).join('\n'),
      moduleFeatures: modules,
      isActive: selectedPlan.isActive !== false,
      sortOrder: selectedPlan.sortOrder ?? 0,
    });
  };

  const savePlan = async (planId) => {
    const draft = drafts[planId];
    if (!draft) return;
    setSavingId(planId);
    try {
      await dispatch(
        updatePlatformPlan({
          planId,
          payload: {
            name: draft.name,
            price: Number(draft.price),
            maxEmployees: Number(draft.maxEmployees),
            trialDays: Number(draft.trialDays),
            features: draft.featuresText
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean),
            moduleFeatures: draft.moduleFeatures,
            isActive: draft.isActive,
            sortOrder: Number(draft.sortOrder) || 0,
          },
        })
      ).unwrap();
      toast.success(`${draft.name || planId} saved`);
      await dispatch(fetchPlatformPlans());
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Failed to save plan');
    } finally {
      setSavingId(null);
    }
  };

  const moduleKeys = useMemo(() => {
    if (!selectedDraft) return [];
    const keys = new Set([
      ...Object.keys(selectedDraft.moduleFeatures || {}),
      ...Object.keys(featureLabels || {}),
    ]);
    return [...keys].sort();
  }, [selectedDraft, featureLabels]);

  if (loading && !plans.length) {
    return (
      <div className="platform-plans">
        <div className="pp-empty">Loading plans…</div>
      </div>
    );
  }

  return (
    <div className="platform-plans">
      <div className="pp-header">
        <div>
          <h1 className="pp-title">Subscription Plans & Tiers</h1>
          <p className="pp-sub">
            Edit global commercial packaging, seat ceilings, and module entitlements. Per-org
            overrides still live on each organization page.
          </p>
        </div>
        <button
          type="button"
          className="pp-btn pp-btn-secondary"
          onClick={() =>
            dispatch(fetchPlatformPlans())
              .unwrap()
              .then(() => toast.success('Plans refreshed'))
              .catch((err) => {
                const message = typeof err === 'string' ? err : 'Failed to refresh';
                if (!/session expired|log in again/i.test(message)) toast.error(message);
              })
          }
        >
          <FiRefreshCw className="h-4 w-4" aria-hidden />
          Refresh
        </button>
      </div>

      <div className="pp-kpi-grid">
        <div className="pp-kpi">
          <div className="pp-kpi-label">Total active plans</div>
          <div className="pp-kpi-value">{kpi.activeCount} Active</div>
          <div className="pp-kpi-meta">
            <span className="pp-pill pp-pill-ok">Live catalog</span>
          </div>
        </div>
        <div className="pp-kpi">
          <div className="pp-kpi-label">Subscribed orgs</div>
          <div className="pp-kpi-value">{kpi.totalOrgs.toLocaleString()} tenants</div>
          <div className="pp-kpi-meta">Across all plans</div>
        </div>
        <div className="pp-kpi">
          <div className="pp-kpi-label">Avg seat ceiling</div>
          <div className="pp-kpi-value">{kpi.avgSeats.toLocaleString()}</div>
          <div className="pp-kpi-meta">Employees per plan (avg)</div>
        </div>
        <div className="pp-kpi">
          <div className="pp-kpi-label">Highest priced plan</div>
          <div className="pp-kpi-value">
            {kpi.topPlan ? formatPrice(kpi.topPlan.price) : '—'}
            {kpi.topPlan && Number(kpi.topPlan.price) > 0 ? (
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#5a7a70' }}>/mo</span>
            ) : null}
          </div>
          <div className="pp-kpi-meta" style={{ textTransform: 'capitalize' }}>
            {kpi.topPlan?.name || '—'}
          </div>
        </div>
      </div>

      <div className="pp-tabs">
        <button
          type="button"
          className={`pp-tab ${filter === 'active' ? 'is-active' : ''}`}
          onClick={() => setFilter('active')}
        >
          Active packaging ({activePlans.length})
        </button>
        <button
          type="button"
          className={`pp-tab ${filter === 'inactive' ? 'is-active' : ''}`}
          onClick={() => setFilter('inactive')}
        >
          Inactive / sunset ({inactivePlans.length})
        </button>
        <span className="pp-hint">Select a card to edit below</span>
      </div>

      {visiblePlans.length === 0 ? (
        <div className="pp-empty">
          {filter === 'active' ? 'No active plans' : 'No inactive plans'}
        </div>
      ) : (
        <div className="pp-plan-grid">
          {visiblePlans.map((plan) => {
            const draft = drafts[plan.id];
            if (!draft) return null;
            const selected = selectedId === plan.id;
            const bullets = (draft.featuresText || '')
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean)
              .slice(0, 4);
            const enabledMods = Object.entries(draft.moduleFeatures || {})
              .filter(([, on]) => on)
              .map(([key]) => featureLabels[key] || key)
              .slice(0, 3);
            const list = bullets.length ? bullets : enabledMods;
            return (
              <article
                key={plan.id}
                className={`pp-plan-card ${selected ? 'is-selected' : ''} ${
                  draft.isActive ? '' : 'is-inactive'
                }`}
              >
                <div className="pp-plan-top">
                  <h2 className="pp-plan-name">{draft.name || plan.id}</h2>
                  {selected ? (
                    <span className="pp-pill pp-pill-ok">Editing</span>
                  ) : draft.isActive ? (
                    <span className="pp-pill pp-pill-muted">Active</span>
                  ) : (
                    <span className="pp-pill pp-pill-warn">Inactive</span>
                  )}
                </div>
                <div className="pp-plan-price">
                  {formatPrice(draft.price)}
                  {Number(draft.price) > 0 && <span> / month</span>}
                </div>

                <div className="pp-plan-metrics" aria-label="Tenants and seat cap">
                  <div className="pp-plan-metric">
                    <div className="pp-plan-metric-label">Tenants</div>
                    <div className="pp-plan-metric-value">
                      {(plan.orgCount || 0).toLocaleString()} orgs
                    </div>
                  </div>
                  <div className="pp-plan-metric">
                    <div className="pp-plan-metric-label">Seat cap</div>
                    <div className="pp-plan-metric-value">
                      {Number(draft.maxEmployees).toLocaleString()} seats
                    </div>
                  </div>
                </div>

                <ul className="pp-entitlements">
                  {list.length ? (
                    list.map((item) => (
                      <li key={item}>
                        <FiCheck className="h-3.5 w-3.5" aria-hidden />
                        {item}
                      </li>
                    ))
                  ) : (
                    <li style={{ color: '#788882' }}>No marketing bullets yet</li>
                  )}
                </ul>

                <div className="pp-plan-foot">
                  <span className="pp-plan-trial">
                    {Number(draft.trialDays) > 0
                      ? `${draft.trialDays}-Day Free Trial`
                      : 'No trial'}
                  </span>
                  <button
                    type="button"
                    className={`pp-btn pp-btn-sm ${
                      selected ? 'pp-btn-primary' : 'pp-btn-secondary'
                    }`}
                    onClick={() => setSelectedId(plan.id)}
                  >
                    <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
                    {selected ? 'Editing' : 'Edit plan'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selectedDraft && selectedPlan && (
        <section className="pp-editor" aria-label="Edit selected plan">
          <div className="pp-editor-head">
            <div>
              <h2 className="pp-editor-title">
                Edit plan: <span style={{ textTransform: 'capitalize' }}>{selectedDraft.name}</span>
              </h2>
              <p className="pp-editor-sub">
                Internal slug <code>{selectedPlan.id}</code> · Changes apply to new and existing
                entitlements for this tier
              </p>
            </div>
          </div>

          <div className="pp-editor-body">
            <div>
              <h3 className="pp-section-title">General commercial packaging</h3>
              <div className="pp-form-grid pp-form-3">
                <div>
                  <label className="pp-label" htmlFor="pp-name">
                    Plan display name
                  </label>
                  <input
                    id="pp-name"
                    className="pp-input"
                    value={selectedDraft.name}
                    onChange={(e) => setDraft(selectedId, { name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="pp-label" htmlFor="pp-slug">
                    Internal API slug
                  </label>
                  <input id="pp-slug" className="pp-input" value={selectedPlan.id} disabled />
                </div>
                <div>
                  <label className="pp-label" htmlFor="pp-price">
                    Base monthly price
                  </label>
                  <input
                    id="pp-price"
                    type="number"
                    min={0}
                    className="pp-input"
                    value={selectedDraft.price}
                    onChange={(e) => setDraft(selectedId, { price: e.target.value })}
                  />
                </div>
                <div>
                  <label className="pp-label" htmlFor="pp-seats">
                    Included employee seats
                  </label>
                  <input
                    id="pp-seats"
                    type="number"
                    min={1}
                    className="pp-input"
                    value={selectedDraft.maxEmployees}
                    onChange={(e) => setDraft(selectedId, { maxEmployees: e.target.value })}
                  />
                </div>
                <div>
                  <label className="pp-label" htmlFor="pp-trial">
                    Trial duration (days)
                  </label>
                  <input
                    id="pp-trial"
                    type="number"
                    min={0}
                    className="pp-input"
                    value={selectedDraft.trialDays}
                    onChange={(e) => setDraft(selectedId, { trialDays: e.target.value })}
                  />
                </div>
                <div>
                  <label className="pp-label" htmlFor="pp-sort">
                    Sort order priority
                  </label>
                  <input
                    id="pp-sort"
                    type="number"
                    className="pp-input"
                    value={selectedDraft.sortOrder}
                    onChange={(e) => setDraft(selectedId, { sortOrder: e.target.value })}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="pp-label" htmlFor="pp-bullets">
                    Marketing bullets (one per line)
                  </label>
                  <textarea
                    id="pp-bullets"
                    className="pp-textarea"
                    rows={4}
                    value={selectedDraft.featuresText}
                    onChange={(e) => setDraft(selectedId, { featuresText: e.target.value })}
                    placeholder="Core HR&#10;Attendance & leave&#10;Basic reporting"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="pp-section-title">Feature flag entitlements</h3>
              <div className="pp-feat-grid">
                {moduleKeys.map((key) => (
                  <div key={key} className="pp-feat">
                    <div>
                      <div className="pp-feat-name">{featureLabels[key] || key}</div>
                      <div className="pp-feat-key">{key}</div>
                    </div>
                    <label className="pp-switch">
                      <input
                        type="checkbox"
                        checked={!!selectedDraft.moduleFeatures[key]}
                        onChange={(e) =>
                          setDraft(selectedId, {
                            moduleFeatures: {
                              ...selectedDraft.moduleFeatures,
                              [key]: e.target.checked,
                            },
                          })
                        }
                      />
                      <span />
                    </label>
                  </div>
                ))}
                {!moduleKeys.length && (
                  <div className="pp-empty" style={{ gridColumn: '1 / -1' }}>
                    No module features on this plan
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="pp-section-title">Catalog rules</h3>
              <div className="pp-toggle-row">
                <span>
                  <FiLayers className="inline h-4 w-4 mr-1" style={{ color: '#2A6B52' }} />
                  Plan active in catalog
                </span>
                <label className="pp-switch">
                  <input
                    type="checkbox"
                    checked={selectedDraft.isActive}
                    onChange={(e) => setDraft(selectedId, { isActive: e.target.checked })}
                  />
                  <span />
                </label>
              </div>
            </div>
          </div>

          <div className="pp-editor-foot">
            <button type="button" className="pp-btn pp-btn-secondary" onClick={resetSelected}>
              Cancel
            </button>
            <button
              type="button"
              disabled={savingId === selectedId}
              onClick={() => savePlan(selectedId)}
              className="pp-btn pp-btn-primary"
            >
              {savingId === selectedId ? 'Saving…' : 'Save plan changes'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default PlansPage;
