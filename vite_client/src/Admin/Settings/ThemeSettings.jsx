import React, { useEffect, useState } from 'react';
import axios from '../../utils/axios';
import { applyBranding } from '../../utils/theme';

const DEFAULT_PRIMARY = '#0e9370';
const DEFAULT_SECONDARY = '#476175';
const DEFAULT_ACCENT = '#f59e0b';

const ThemeSettings = () => {
  const [branding, setBranding] = useState({
    primaryColor: DEFAULT_PRIMARY,
    secondaryColor: DEFAULT_SECONDARY,
    accentColor: DEFAULT_ACCENT,
  });
  const [themePresets, setThemePresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [presetName, setPresetName] = useState('');

  const loadBranding = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/v1/admin/organization/branding');
      const data = res.data?.data || res.data;
      if (data?.branding) {
        setBranding({
          primaryColor: data.branding.primaryColor || DEFAULT_PRIMARY,
          secondaryColor: data.branding.secondaryColor || DEFAULT_SECONDARY,
          accentColor: data.branding.accentColor || DEFAULT_ACCENT,
        });
        applyBranding(data.branding);
      }
      if (Array.isArray(data?.themePresets)) {
        setThemePresets(data.themePresets);
      }
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load theme settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranding();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await axios.put('/v1/admin/organization/branding', branding);
      const data = res.data?.data || res.data;
      if (data?.branding) {
        applyBranding(data.branding);
      }
      if (Array.isArray(data?.themePresets)) {
        setThemePresets(data.themePresets);
      }
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to save theme settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsPreset = async () => {
    const name = presetName.trim();
    if (!name) {
      setError('Please enter a name for the preset');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const res = await axios.put('/v1/admin/organization/branding', {
        ...branding,
        savePreset: name,
      });
      const data = res.data?.data || res.data;
      if (Array.isArray(data?.themePresets)) {
        setThemePresets(data.themePresets);
        setPresetName('');
      }
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to save preset');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyPreset = async (index) => {
    try {
      setSaving(true);
      setError(null);
      const res = await axios.put('/v1/admin/organization/branding', {
        applyPreset: index,
      });
      const data = res.data?.data || res.data;
      if (data?.branding) {
        setBranding({
          primaryColor: data.branding.primaryColor || DEFAULT_PRIMARY,
          secondaryColor: data.branding.secondaryColor || DEFAULT_SECONDARY,
          accentColor: data.branding.accentColor || DEFAULT_ACCENT,
        });
        applyBranding(data.branding);
      }
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to apply preset');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-5 md:p-6">
      <div>
        <h2 className="mb-2 text-xl font-bold text-[var(--color-text)] sm:text-2xl">
          Theme &amp; Branding
        </h2>
        <p className="text-sm text-[var(--color-text)] opacity-80">
          Customize primary, secondary and accent colors. Save themes as presets to switch back anytime.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-[var(--color-text)] opacity-70">Loading theme settings...</div>
      ) : (
        <>
          {error && (
            <div className="px-3 py-2 rounded bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 md:gap-6">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                Primary color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.primaryColor}
                  onChange={(e) =>
                    setBranding((prev) => ({ ...prev, primaryColor: e.target.value }))
                  }
                  className="w-12 h-10 p-0 border border-gray-300 rounded cursor-pointer"
                />
                <span className="text-xs text-[var(--color-text)] opacity-70 font-mono">
                  {branding.primaryColor}
                </span>
              </div>
              <p className="text-xs text-[var(--color-text)] opacity-60 mt-1">
                Main buttons, active menu, key highlights.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                Secondary color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.secondaryColor}
                  onChange={(e) =>
                    setBranding((prev) => ({ ...prev, secondaryColor: e.target.value }))
                  }
                  className="w-12 h-10 p-0 border border-gray-300 rounded cursor-pointer"
                />
                <span className="text-xs text-[var(--color-text)] opacity-70 font-mono">
                  {branding.secondaryColor}
                </span>
              </div>
              <p className="text-xs text-[var(--color-text)] opacity-60 mt-1">
                Secondary actions, links, hover.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                Accent color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.accentColor}
                  onChange={(e) =>
                    setBranding((prev) => ({ ...prev, accentColor: e.target.value }))
                  }
                  className="w-12 h-10 p-0 border border-gray-300 rounded cursor-pointer"
                />
                <span className="text-xs text-[var(--color-text)] opacity-70 font-mono">
                  {branding.accentColor}
                </span>
              </div>
              <p className="text-xs text-[var(--color-text)] opacity-60 mt-1">
                Badges, pills, accents.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 sm:w-auto"
            >
              {saving ? 'Saving...' : 'Save Theme'}
            </button>
          </div>

          {/* Save current as preset */}
          <div className="border-t border-gray-200 pt-5 sm:pt-6">
            <h3 className="mb-3 text-base font-semibold text-[var(--color-text)] sm:text-lg">
              Save current theme as preset
            </h3>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="e.g. Summer Green"
                className="w-full min-w-0 rounded-lg border border-gray-300 bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)] sm:w-auto sm:min-w-[180px]"
              />
              <button
                type="button"
                onClick={handleSaveAsPreset}
                disabled={saving || !presetName.trim()}
                className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--color-secondary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 sm:w-auto"
              >
                Save preset
              </button>
            </div>
          </div>

          {/* Saved themes - choose previous theme */}
          {themePresets.length > 0 && (
            <div className="border-t border-gray-200 pt-5 sm:pt-6">
              <h3 className="mb-3 text-base font-semibold text-[var(--color-text)] sm:text-lg">
                Saved themes
              </h3>
              <p className="mb-3 text-sm text-[var(--color-text)] opacity-70">
                Click Apply to use a previously saved theme.
              </p>
              <ul className="space-y-2">
                {themePresets.map((preset, index) => (
                  <li
                    key={index}
                    className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-[var(--color-bg-soft)] p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="font-medium text-[var(--color-text)]">{preset.name}</span>
                      <span className="flex gap-1">
                        {[preset.primaryColor, preset.secondaryColor, preset.accentColor]
                          .filter(Boolean)
                          .map((hex, i) => (
                            <span
                              key={i}
                              className="h-5 w-5 rounded-full border border-gray-300"
                              style={{ backgroundColor: hex }}
                              title={hex}
                            />
                          ))}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(index)}
                      disabled={saving}
                      className="w-full rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 sm:w-auto"
                    >
                      Apply
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ThemeSettings;
