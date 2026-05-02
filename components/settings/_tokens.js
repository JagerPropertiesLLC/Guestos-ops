// components/settings/_tokens.js
// Royal blue + gold brand tokens for /settings/*.
// Older pages (/team, /contacts, etc.) still use the green palette — they get
// rebranded in a separate session. When that happens, promote these to a global
// theme module and delete this file.

export const tokens = {
  // Primary: royal blue
  primary:         '#1e40af',  // blue-800
  primaryHover:    '#1e3a8a',  // blue-900
  primaryText:     '#1e3a8a',  // blue-900 text
  primaryBgTint:   '#dbeafe',  // blue-100, badge / selected bg
  primaryRowHover: '#eff6ff',  // blue-50, subtle row hover

  // Accent: gold
  accent:          '#ca8a04',  // yellow-600
  accentHover:     '#a16207',  // yellow-700
  accentBgTint:    '#fef3c7',  // yellow-100, badge bg
  accentText:      '#854d0e',  // yellow-800, badge text

  // Neutrals (intentionally not blue-tinted)
  textPrimary:     '#111827',  // gray-900
  textSecondary:   '#6b7280',  // gray-500
  textTertiary:    '#9ca3af',  // gray-400
  border:          '#e5e7eb',  // gray-200
  borderHover:     '#d1d5db',  // gray-300
  surfaceMuted:    '#f3f4f6',  // gray-100
  surface:         '#ffffff',

  // Semantic — kept red, not brand
  errorBg:         '#fee2e2',
  errorText:       '#991b1b',
};
