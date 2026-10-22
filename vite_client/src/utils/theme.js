// Utility to apply organization-specific branding to CSS variables.
// Defaults follow Stitch Kinetic Enterprise HRMS (DESIGN.md).

export const STITCH_THEME = {
  primary: '#0e9370',
  secondary: '#476175',
  accent: '#f59e0b',
  bg: '#ffffff',
  bgSoft: '#e8faf4',
  text: '#111c2d',
  navy: '#0e2b3d',
  primaryDeep: '#00694f',
  primaryHover: '#0b7458',
};

const DEFAULTS = STITCH_THEME;

/** Legacy defaults remapped so existing orgs pick up Stitch without a manual reset */
const LEGACY_PRIMARY = new Set(['#20c997', '#16a34a', '#22c55e', '#10b981']);
const LEGACY_SECONDARY = new Set(['#2563eb', '#3b82f6', '#1d4ed8']);
const LEGACY_ACCENT = new Set(['#f97316', '#ea580c', '#fb923c']);

const normalizeHex = (value) => String(value || '').trim().toLowerCase();

const resolveColor = (value, legacySet, fallback) => {
  const hex = normalizeHex(value);
  if (!hex) return fallback;
  if (legacySet.has(hex)) return fallback;
  return value;
};

export function applyBranding(branding) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  const primary = resolveColor(branding?.primaryColor, LEGACY_PRIMARY, DEFAULTS.primary);
  const secondary = resolveColor(branding?.secondaryColor, LEGACY_SECONDARY, DEFAULTS.secondary);
  const accent = resolveColor(branding?.accentColor, LEGACY_ACCENT, DEFAULTS.accent);

  root.style.setProperty('--color-primary', primary);
  root.style.setProperty('--color-secondary', secondary);
  root.style.setProperty('--color-accent', accent);
  root.style.setProperty('--color-bg', branding?.backgroundColor || DEFAULTS.bg);
  root.style.setProperty('--color-text', branding?.textColor || DEFAULTS.text);
  root.style.setProperty(
    '--color-bg-soft',
    branding?.backgroundSoftColor || DEFAULTS.bgSoft
  );
  root.style.setProperty('--color-navy', branding?.navyColor || DEFAULTS.navy);
  root.style.setProperty('--color-primary-deep', DEFAULTS.primaryDeep);
  root.style.setProperty('--color-primary-hover', DEFAULTS.primaryHover);
}

