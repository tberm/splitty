export const Colors = {
  // Semantic colors from design tokens
  positive: '#4a7c59',
  positiveOnDark: '#6fcf97',
  negative: '#c0392b',
  negativeOnDark: '#eb5757',
  neutral: '#9ca3af',

  // Hero header
  heroBg: '#1a1a1a',
  heroCardBg: 'rgba(255,255,255,0.07)',
  heroCardBorder: 'rgba(255,255,255,0.15)',
  heroText: '#ffffff',
  heroMuted: 'rgba(255,255,255,0.6)',

  // General UI
  background: '#f9fafb',
  surface: '#ffffff',
  border: '#e5e7eb',
  borderStrong: '#d1d5db',
  text: '#111827',
  textMuted: '#6b7280',
  textLight: '#9ca3af',
  primary: '#1a1a1a',
  primaryText: '#ffffff',
  tabActive: '#111827',
  tabInactive: '#9ca3af',
  chipSelected: '#1a1a1a',
  chipSelectedText: '#ffffff',
  chipUnselected: '#f3f4f6',
  chipUnselectedText: '#374151',
  inputBg: '#f9fafb',
  sectionHeader: '#6b7280',
  fab: '#1a1a1a',
  fabText: '#ffffff',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#10b981',
};

// Avatar palette — pick by userId hash
export const AVATAR_PALETTE = [
  { bg: '#d4e8d0', fg: '#2d5a3d' },
  { bg: '#d0dff5', fg: '#1e3a6e' },
  { bg: '#f5d0d0', fg: '#6e1e1e' },
  { bg: '#f5e8d0', fg: '#6e4a1e' },
  { bg: '#e8d0f5', fg: '#4a1e6e' },
];

export function avatarColors(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
