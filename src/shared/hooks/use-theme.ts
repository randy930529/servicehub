/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/shared/constants/theme';
import { useResolvedColorScheme } from '@/shared/hooks/use-resolved-color-scheme';

export function useTheme() {
  const scheme = useResolvedColorScheme();

  return Colors[scheme];
}
