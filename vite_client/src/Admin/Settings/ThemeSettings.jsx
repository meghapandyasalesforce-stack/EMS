import React, { useEffect, useState } from 'react';
import axios from '../../utils/axios';
import { applyBranding } from '../../utils/theme';

const DEFAULT_PRIMARY = '#16a34a';
const DEFAULT_SECONDARY = '#2563eb';
const DEFAULT_ACCENT = '#f97316';

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
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-text)] mb-2">
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
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
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Theme'}
            </button>
          </div>

          {/* Save current as preset */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-3">
              Save current theme as preset
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="e.g. Summer Green"
                className="px-3 py-2 border border-gray-300 rounded-lg text-[var(--color-text)] bg-[var(--color-bg)] min-w-[180px]"
              />
              <button
                type="button"
                onClick={handleSaveAsPreset}
                disabled={saving || !presetName.trim()}
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-secondary)] hover:opacity-90 disabled:opacity-60"
              >
                Save preset
              </button>
            </div>
          </div>

          {/* Saved themes - choose previous theme */}
          {themePresets.length > 0 && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-[var(--color-text)] mb-3">
                Saved themes
              </h3>
              <p className="text-sm text-[var(--color-text)] opacity-70 mb-3">
                Click Apply to use a previously saved theme.
              </p>
              <ul className="space-y-2">
                {themePresets.map((preset, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between gap-4 p-3 rounded-lg bg-[var(--color-bg-soft)] border border-gray-200"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--color-text)]">{preset.name}</span>
                      <span className="flex gap-1">
                        {[preset.primaryColor, preset.secondaryColor, preset.accentColor]
                          .filter(Boolean)
                          .map((hex, i) => (
                            <span
                              key={i}
                              className="w-5 h-5 rounded-full border border-gray-300"
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
                      className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-60"
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
