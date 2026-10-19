// WCAG 2.1 Contrast Ratio Verification Script
// Calculates relative luminance and contrast ratio for all text & background token pairs across midnight, velvet, and indigo palettes.

function hexToRgb(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return [num >> 16, (num >> 8) & 255, num & 255];
}

function channelLuminance(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map(channelLuminance);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hex1, hex2) {
  const lum1 = relativeLuminance(hexToRgb(hex1));
  const lum2 = relativeLuminance(hexToRgb(hex2));
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

const PALETTES = {
  midnight: {
    dark: {
      surfaces: { page: '#090d14', card: '#162032', input: '#0c131e', secondary: '#0f1724' },
      text: { primary: '#f8fafc', secondary: '#94a3b8', muted: '#8fa0b5' },
      accent: '#14b8a6',
      buttonText: '#06090e',
    },
    light: {
      surfaces: { page: '#f8fafc', card: '#ffffff', input: '#ffffff', secondary: '#f1f5f9' },
      text: { primary: '#0f172a', secondary: '#334155', muted: '#475569' },
      accent: '#0f766e',
      buttonText: '#ffffff',
    }
  },
  velvet: {
    dark: {
      surfaces: { page: '#0e0a0d', card: '#221820', input: '#120d11', secondary: '#171015' },
      text: { primary: '#fff1f2', secondary: '#a89ba2', muted: '#a1939b' },
      accent: '#e11d48',
      buttonText: '#ffffff',
    },
    light: {
      surfaces: { page: '#fffbfa', card: '#ffffff', input: '#ffffff', secondary: '#fcf2f2' },
      text: { primary: '#1c1417', secondary: '#524247', muted: '#5e4f55' },
      accent: '#be123c',
      buttonText: '#ffffff',
    }
  },
  indigo: {
    dark: {
      surfaces: { page: '#090a12', card: '#181b30', input: '#0d0f1a', secondary: '#111322' },
      text: { primary: '#f8fafc', secondary: '#94a3b8', muted: '#9aa3c2' },
      accent: '#4f46e5',
      buttonText: '#ffffff',
    },
    light: {
      surfaces: { page: '#f8f9ff', card: '#ffffff', input: '#ffffff', secondary: '#eef2ff' },
      text: { primary: '#0f172a', secondary: '#334155', muted: '#475569' },
      accent: '#4338ca',
      buttonText: '#ffffff',
    }
  }
};

console.log('=== WCAG 2.1 AA Contrast Ratio Verification (Zero Amber Suite) ===\n');

let allPassed = true;

for (const [palName, palData] of Object.entries(PALETTES)) {
  for (const [theme, data] of Object.entries(palData)) {
    console.log(`[Palette: ${palName.toUpperCase()} | Theme: ${theme.toUpperCase()}]`);

    // Test surfaces against text tokens
    for (const [surfName, surfHex] of Object.entries(data.surfaces)) {
      for (const [txtRole, txtHex] of Object.entries(data.text)) {
        const ratio = contrastRatio(surfHex, txtHex);
        const pass = ratio >= 4.5; // WCAG AA for normal text is 4.5:1
        if (!pass) allPassed = false;
        console.log(`  ${surfName.padEnd(9)} (${surfHex}) vs text.${txtRole.padEnd(9)} (${txtHex}) : ${ratio.toFixed(2)}:1 [${pass ? 'PASS' : 'FAIL'}]`);
      }
    }

    // Test primary button accent vs button text
    const btnRatio = contrastRatio(data.accent, data.buttonText);
    const btnPass = btnRatio >= 4.5;
    if (!btnPass) allPassed = false;
    console.log(`  button.accent (${data.accent}) vs btnText (${data.buttonText}) : ${btnRatio.toFixed(2)}:1 [${btnPass ? 'PASS' : 'FAIL'}]\n`);
  }
}

if (allPassed) {
  console.log('ALL COLOR TOKEN PAIRS PASS WCAG 2.1 AA REQUIREMENTS!');
} else {
  console.error('FAILURES DETECTED: Some color pairs did not meet WCAG AA requirements.');
  process.exit(1);
}
