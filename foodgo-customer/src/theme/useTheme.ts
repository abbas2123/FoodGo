import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { lightPalette, darkPalette, ThemePalette } from './colorPalette';

export interface UseThemeResult {
  theme: ThemePalette;
  isDark: boolean;
}

/**
 * Returns the active theme palette and a convenience `isDark` boolean.
 *
 * Usage:
 *   const { theme, isDark } = useTheme();
 *   <View style={[styles.container, { backgroundColor: theme.background }]}>
 */
export function useTheme(): UseThemeResult {
  const mode = useSelector((state: RootState) => state.theme.mode);
  const isDark = mode === 'dark';
  const theme = isDark ? darkPalette : lightPalette;
  return { theme, isDark };
}
