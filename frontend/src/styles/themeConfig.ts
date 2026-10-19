// Palette Configuration & Switching Helper (Zero-amber / Teal Default)
export type PaletteType = 'midnight' | 'velvet' | 'indigo';

export const PALETTES: Record<PaletteType, { name: string; description: string; primary: string; secondary: string }> = {
  midnight: {
    name: 'Midnight Teal',
    description: 'Deep oceanic night surfaces with refined petrol teal primary and ice-blue secondary. Clean nocturnal cinema aesthetic.',
    primary: '#14b8a6',
    secondary: '#38bdf8',
  },
  velvet: {
    name: 'Velvet Wine',
    description: 'Deep ink-black with rich burgundy/wine primary and soft rose silver details. Classic theatre velvet.',
    primary: '#e11d48',
    secondary: '#fda4af',
  },
  indigo: {
    name: 'Indigo Ink',
    description: 'Deep nocturnal ink surfaces with vibrant violet-indigo primary and metallic silver secondary. Late-night screening.',
    primary: '#6366f1',
    secondary: '#94a3b8',
  },
};

export const DEFAULT_PALETTE: PaletteType = 'midnight';

export function getActivePalette(): PaletteType {
  if (typeof window === 'undefined') return DEFAULT_PALETTE;
  const stored = localStorage.getItem('cinesense_palette') as PaletteType;
  return (stored && PALETTES[stored]) ? stored : DEFAULT_PALETTE;
}

export function setActivePalette(palette: PaletteType): void {
  if (typeof window === 'undefined') return;
  document.documentElement.setAttribute('data-palette', palette);
  localStorage.setItem('cinesense_palette', palette);
  window.dispatchEvent(new Event('palettechange'));
}
