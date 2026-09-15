/**
 * Light and dark color palettes for FoodGo.
 *
 * Brand red (#C1121F) is intentionally identical in both palettes — it is
 * the primary brand color and must remain consistent across themes.
 */

export interface ThemePalette {
  // Backgrounds
  background: string;
  surface: string;
  card: string;
  // Text
  text: string;
  secondaryText: string;
  muted: string;
  // Borders / dividers
  border: string;
  // Brand (static — never changes with theme)
  primary: string;
  primaryLight: string;
  // Inputs
  inputBackground: string;
  // Icons
  icon: string;
  // Overlays / skeleton
  skeleton: string;
  // Search bar tint
  searchBackground: string;
  // Category chip
  categoryChip: string;
  categoryChipActive: string;
}

export const lightPalette: ThemePalette = {
  background: '#FFF9F7',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: '#1F1010',
  secondaryText: '#666060',
  muted: '#9CA3AF',
  border: '#EEEEEE',
  primary: '#C1121F',
  primaryLight: '#FDE9E8',
  inputBackground: '#F5F5F5',
  icon: '#261818',
  skeleton: '#F3F4F6',
  searchBackground: '#F8DADA',
  categoryChip: '#F8DADA',
  categoryChipActive: '#F0B8B8',
};

export const darkPalette: ThemePalette = {
  background: '#121212',
  surface: '#1E1E1E',
  card: '#242424',
  text: '#F5F5F5',
  secondaryText: '#BBBBBB',
  muted: '#888888',
  border: '#333333',
  primary: '#C1121F',
  primaryLight: '#3A1515',
  inputBackground: '#2A2A2A',
  icon: '#F5F5F5',
  skeleton: '#2A2A2A',
  searchBackground: '#2E1A1A',
  categoryChip: '#2E1A1A',
  categoryChipActive: '#3D2020',
};
