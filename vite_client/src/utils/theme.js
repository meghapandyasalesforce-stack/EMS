// Utility to apply organization-specific branding to CSS variables.
// This lets the admin change colors once and have the whole app theme update.

const DEFAULTS = {
  primary: '#20C997',
  secondary: '#2563eb',
  accent: '#f97316',
  bg: '#ffffff',
  bgSoft: '#f3f4f6',
  text: '#111827',
};

export function applyBranding(branding) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // Always set all three main colors so secondary/accent are never "missing"
  root.style.setProperty('--color-primary', branding?.primaryColor || DEFAULTS.primary);
  root.style.setProperty('--color-secondary', branding?.secondaryColor || DEFAULTS.secondary);
  root.style.setProperty('--color-accent', branding?.accentColor || DEFAULTS.accent);

  if (branding?.backgroundColor) {
    root.style.setProperty('--color-bg', branding.backgroundColor);
  }
  if (branding?.textColor) {
    root.style.setProperty('--color-text', branding.textColor);
  }
  // Optional: allow overriding bg-soft from branding later
  if (branding?.backgroundSoftColor) {
    root.style.setProperty('--color-bg-soft', branding.backgroundSoftColor);
  }
}

