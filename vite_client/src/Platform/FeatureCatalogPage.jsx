import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { fetchFeatureCatalog } from '../context/platformSlice';

const FeatureCatalogPage = () => {
  const dispatch = useDispatch();
  const { featureCatalog, featureLabels } = useSelector((state) => state.platform);

  useEffect(() => {
    dispatch(fetchFeatureCatalog())
      .unwrap()
      .catch((err) => {
        const message = typeof err === 'string' ? err : 'Failed to load catalog';
        if (!/session expired|log in again/i.test(message)) toast.error(message);
      });
  }, [dispatch]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Feature Catalog</h1>
        <p className="mt-1 text-sm text-slate-600">
          Commercial product modules. Plan matrices and org overrides gate these keys — not every HRMS screen.
        </p>
      </div>

      {(featureCatalog || []).map((category) => (
        <section key={category.category} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{category.category}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(category.items || []).map((item) => (
              <div key={item.featureKey} className="rounded-lg border border-slate-200 p-4">
                <div className="font-medium text-slate-900">
                  {item.label || featureLabels[item.featureKey] || item.featureKey}
                </div>
                <div className="mt-1 text-xs font-mono text-slate-400">{item.featureKey}</div>
                <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                {!!item.submodules?.length && (
                  <ul className="mt-3 list-inside list-disc text-xs text-slate-500">
                    {item.submodules.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {!featureCatalog?.length && (
        <p className="text-sm text-slate-500">No catalog entries loaded.</p>
      )}
    </div>
  );
};

export default FeatureCatalogPage;
