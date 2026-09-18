import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { fetchPlatformPlans, updatePlatformPlan } from '../context/platformSlice';

const PlansPage = () => {
  const dispatch = useDispatch();
  const { plans, featureLabels } = useSelector((state) => state.platform);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);

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
      next[plan.id] = {
        name: plan.name || '',
        price: plan.price ?? 0,
        maxEmployees: plan.maxEmployees ?? 10,
        trialDays: plan.trialDays ?? 14,
        featuresText: (plan.features || []).join('\n'),
        moduleFeatures: { ...(plan.moduleFeatures || {}) },
        isActive: plan.isActive !== false,
      };
    });
    setDrafts(next);
  }, [plans]);

  const setDraft = (planId, patch) => {
    setDrafts((prev) => ({ ...prev, [planId]: { ...prev[planId], ...patch } }));
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Plans & features</h1>
        <p className="mt-1 text-sm text-slate-600">
          Edit global plan defaults. Per-org overrides still live on each organization page.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map((plan) => {
          const draft = drafts[plan.id];
          if (!draft) return null;
          return (
            <div key={plan.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft(plan.id, { name: e.target.value })}
                  className="text-lg font-semibold capitalize text-slate-900 border-b border-transparent focus:border-slate-300 outline-none"
                />
                <span className="text-xs text-slate-500">{plan.orgCount || 0} orgs</span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <label className="text-xs text-slate-500">
                  Price
                  <input
                    type="number"
                    min={0}
                    value={draft.price}
                    onChange={(e) => setDraft(plan.id, { price: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-slate-500">
                  Max employees
                  <input
                    type="number"
                    min={1}
                    value={draft.maxEmployees}
                    onChange={(e) => setDraft(plan.id, { maxEmployees: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-slate-500">
                  Trial days
                  <input
                    type="number"
                    min={0}
                    value={draft.trialDays}
                    onChange={(e) => setDraft(plan.id, { trialDays: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
              </div>

              <label className="mt-4 block text-xs text-slate-500">
                Marketing bullets (one per line)
                <textarea
                  rows={5}
                  value={draft.featuresText}
                  onChange={(e) => setDraft(plan.id, { featuresText: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>

              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Modules
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {Object.keys(draft.moduleFeatures || {}).sort().map((key) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={!!draft.moduleFeatures[key]}
                        onChange={(e) =>
                          setDraft(plan.id, {
                            moduleFeatures: {
                              ...draft.moduleFeatures,
                              [key]: e.target.checked,
                            },
                          })
                        }
                      />
                      {featureLabels[key] || key}
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(e) => setDraft(plan.id, { isActive: e.target.checked })}
                  />
                  Plan active
                </label>
                <button
                  type="button"
                  disabled={savingId === plan.id}
                  onClick={() => savePlan(plan.id)}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {savingId === plan.id ? 'Saving…' : 'Save plan'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlansPage;
