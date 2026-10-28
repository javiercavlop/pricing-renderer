import { configurePricingRenderer } from 'pricing-renderer';
import type { PricingRendererElement } from 'pricing-renderer/element';
import 'pricing-renderer/base.css';
import themeCss from 'pricing-renderer/theme.css?inline';
import shadcnCss from 'pricing-renderer/tokens-shadcn.css?inline';
import minimalCss from 'pricing-renderer/theme-minimal.css?inline';
import pricingYaml from '../../../tests/fixtures/acme-pricing.yml?raw';

// [impl->req~theme-builder-page~1]

configurePricingRenderer({
  locale: 'en-US',
  pricingPath: '/pricing',
  selectionEnabled: true,
  ctaEnabled: true,
  variablesEnabled: true,
});

const PAGE_CSS = [
  'body { margin: 0; font-family: system-ui, sans-serif; background: #f4f4f6; color: #1c1c24; }',
  '.tb { display: grid; grid-template-columns: 22rem 1fr; gap: 1.5rem; padding: 1.5rem; }',
  '.tb-panel { display: grid; gap: 0.9rem; align-content: start; padding: 1rem; }',
  '.tb-panel { background: #fff; border: 1px solid #d8d8e0; border-radius: 12px; }',
  '.tb-panel h1 { margin: 0; font-size: 1.15rem; }',
  '.tb-panel button { min-height: 2.75rem; }',
  '.tb label { display: grid; gap: 0.3rem; font-size: 0.85rem; font-weight: 600; }',
  '.tb label.tb-check { display: flex; align-items: center; gap: 0.5rem; }',
  '.tb input[type="color"] { width: 100%; height: 2.2rem; padding: 0; }',
  '.tb textarea { min-height: 9rem; font: 0.8rem ui-monospace, monospace; }',
  '.tb-preview { min-width: 0; background: #fff; border-radius: 12px; }',
  '.tb-preview { overflow: clip; overflow-clip-margin: 0.5rem; }',
  '@media (max-width: 56rem) { .tb { grid-template-columns: 1fr; } }',
].join('\n');

const FONTS: ReadonlyArray<readonly [string, string]> = [
  ['Default', ''],
  ['System UI', 'system-ui, sans-serif'],
  ['Serif', 'Georgia, "Times New Roman", serif'],
  ['Monospace', 'ui-monospace, "Cascadia Mono", Menlo, monospace'],
];

// Each colour control edits one token (`data-token`); the surface also feeds the raised surface.
const COLOR_TOKENS = {
  '--pr-color-accent': ['--pr-color-accent'],
  '--pr-color-surface': ['--pr-color-surface', '--pr-color-surface-raised'],
  '--pr-color-text': ['--pr-color-text'],
} as const;
type ColorToken = keyof typeof COLOR_TOKENS;

const RADIUS_TOKEN = '--pr-radius-md';
const RADIUS_PROPS: ReadonlyArray<readonly [string, number]> = [
  ['--pr-radius-sm', 0.6],
  ['--pr-radius-md', 1],
  ['--pr-radius-lg', 1.5],
];
const FONT_PROP = '--pr-font-family';
const ALL_PROPS: string[] = [
  ...Object.values(COLOR_TOKENS).flat(),
  ...RADIUS_PROPS.map(([name]) => name),
  FONT_PROP,
];

type PresetName = 'default' | 'shadcn' | 'minimal';
const PRESETS: ReadonlyArray<readonly [PresetName, string]> = [
  ['default', 'Default'],
  ['shadcn', 'shadcn'],
  ['minimal', 'Minimal'],
];

const PRESET_COLORS: Record<PresetName, Record<ColorToken, string>> = {
  default: {
    '--pr-color-accent': '#6558e8',
    '--pr-color-surface': '#ffffff',
    '--pr-color-text': '#171723',
  },
  shadcn: {
    '--pr-color-accent': '#18181b',
    '--pr-color-surface': '#ffffff',
    '--pr-color-text': '#09090b',
  },
  minimal: {
    '--pr-color-accent': '#111111',
    '--pr-color-surface': '#ffffff',
    '--pr-color-text': '#111111',
  },
};
const DEFAULT_RADIUS = 14;

// Sample shadcn v4 variables, set on <html> while the shadcn preset is active.
const SHADCN_LIGHT: Record<string, string> = {
  '--primary': '#18181b',
  '--primary-foreground': '#fafafa',
  '--foreground': '#09090b',
  '--muted-foreground': '#71717a',
  '--card': '#ffffff',
  '--popover': '#ffffff',
  '--muted': '#f4f4f5',
  '--border': '#e4e4e7',
  '--input': '#e4e4e7',
  '--ring': '#a1a1aa',
  '--radius': '0.5rem',
};
const SHADCN_DARK: Record<string, string> = {
  ...SHADCN_LIGHT,
  '--primary': '#fafafa',
  '--primary-foreground': '#18181b',
  '--foreground': '#fafafa',
  '--muted-foreground': '#a1a1aa',
  '--card': '#09090b',
  '--popover': '#18181b',
  '--muted': '#27272a',
  '--border': '#27272a',
  '--input': '#3f3f46',
  '--ring': '#71717a',
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}

function field(label: string, control: HTMLElement): HTMLLabelElement {
  const wrapper = el('label');
  wrapper.append(el('span', label), control);
  return wrapper;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

const style = el('style', PAGE_CSS);
const themeStyle = el('style', themeCss, { 'data-theme-file': 'theme' });
const overlayStyle = el('style', '', { 'data-theme-file': 'tokens-shadcn' });
document.head.append(style, themeStyle, overlayStyle);

const renderer = document.createElement('pricing-renderer') as PricingRendererElement;
renderer.presentation = { ctas: [{ id: 'start-starter', label: 'Start', planId: 'starter' }] };
const output = el('textarea', undefined, {
  id: 'theme-export',
  readonly: '',
  rows: '8',
  'aria-label': 'Generated CSS',
});
const message = el('p', undefined, { role: 'status' });
const contrast = el('p', undefined, { role: 'status' });

const overrides = new Map<string, string>();
const colorInputs = new Map<ColorToken, HTMLInputElement>();
const radius = el('input', undefined, {
  id: 'theme-radius',
  type: 'range',
  min: '0',
  max: '32',
  step: '1',
  'data-token': RADIUS_TOKEN,
});
const radiusValue = el('output', undefined, { for: 'theme-radius' });
const font = el('select', undefined, { 'data-token': FONT_PROP });
const dark = el('input', undefined, { type: 'checkbox' });
const presetSelect = el('select', undefined, { id: 'theme-preset' });
let preset: PresetName = 'default';

// Clears the live region first and sets the text in the next task, so a repeated message is
// announced again.
function announce(text: string): void {
  message.textContent = '';
  setTimeout(() => {
    message.textContent = text;
  }, 0);
}

function render(): void {
  for (const prop of ALL_PROPS) renderer.style.removeProperty(prop);
  const lines: string[] = [];
  for (const [prop, value] of overrides) {
    renderer.style.setProperty(prop, value);
    lines.push(`  ${prop}: ${value};`);
  }
  const body = lines.length ? `${lines.join('\n')}\n` : '';
  output.value = `pricing-renderer[data-pr-root] {\n${body}}`;
}

function showContrast(): void {
  const text = colorInputs.get('--pr-color-text')!.value;
  const surface = colorInputs.get('--pr-color-surface')!.value;
  const ratio = contrastRatio(text, surface);
  const verdict = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : 'fails AA';
  contrast.textContent = `Text on surface contrast: ${ratio.toFixed(2)}:1 (${verdict}).`;
}

function setColor(token: ColorToken, value: string): void {
  for (const prop of COLOR_TOKENS[token]) overrides.set(prop, value);
}

function setRadius(px: number): void {
  radiusValue.textContent = `${px}px`;
  for (const [prop, factor] of RADIUS_PROPS) {
    overrides.set(prop, `${Math.round(px * factor * 10) / 10}px`);
  }
}

function setShadcnVariables(): void {
  const root = document.documentElement;
  for (const name of Object.keys(SHADCN_LIGHT)) root.style.removeProperty(name);
  if (preset !== 'shadcn') return;
  const values = dark.checked ? SHADCN_DARK : SHADCN_LIGHT;
  for (const [name, value] of Object.entries(values)) root.style.setProperty(name, value);
}

function applyPreset(name: PresetName, announceIt: boolean): void {
  preset = name;
  overrides.clear();
  themeStyle.textContent = name === 'minimal' ? minimalCss : themeCss;
  overlayStyle.textContent = name === 'shadcn' ? shadcnCss : '';
  setShadcnVariables();
  font.value = '';
  radius.value = String(DEFAULT_RADIUS);
  radiusValue.textContent = `${DEFAULT_RADIUS}px`;
  for (const [token, input] of colorInputs) input.value = PRESET_COLORS[name][token];
  showContrast();
  render();
  if (announceIt) {
    const label = PRESETS.find(([value]) => value === name)![1];
    announce(`Preset ${label} applied.`);
  }
}

const colorFields = (
  [
    ['--pr-color-accent', 'Accent colour'],
    ['--pr-color-surface', 'Surface colour'],
    ['--pr-color-text', 'Text colour'],
  ] as const
).map(([token, label]) => {
  const input = el('input', undefined, {
    type: 'color',
    value: PRESET_COLORS.default[token],
    'data-token': token,
  });
  input.addEventListener('input', () => {
    setColor(token, input.value);
    showContrast();
    render();
  });
  colorInputs.set(token, input);
  return field(label, input);
});

radius.value = String(DEFAULT_RADIUS);
radiusValue.textContent = `${DEFAULT_RADIUS}px`;
radius.addEventListener('input', () => {
  setRadius(Number(radius.value));
  render();
});

for (const [name, stack] of FONTS) font.append(el('option', name, { value: stack }));
font.addEventListener('change', () => {
  if (font.value) overrides.set(FONT_PROP, font.value);
  else overrides.delete(FONT_PROP);
  render();
});

dark.addEventListener('change', () => {
  renderer.setAttribute('theme', dark.checked ? 'dark' : 'light');
  document.documentElement.classList.toggle('dark', dark.checked);
  setShadcnVariables();
});

for (const [name, label] of PRESETS) presetSelect.append(el('option', label, { value: name }));
presetSelect.addEventListener('change', () => applyPreset(presetSelect.value as PresetName, true));

const copy = el('button', 'Copy CSS', { type: 'button' });
copy.addEventListener('click', () => {
  const fallback = (): void => {
    output.select();
    announce('Press Ctrl+C (or Cmd+C) to copy the selected CSS.');
  };
  if (!navigator.clipboard) return fallback();
  navigator.clipboard.writeText(output.value).then(() => {
    announce('CSS copied to the clipboard.');
  }, fallback);
});

const darkField = field('Dark mode', dark);
darkField.classList.add('tb-check');

const radiusField = field('Border radius', radius);
radiusField.append(radiusValue);

const panel = el('section', undefined, { class: 'tb-panel', 'aria-label': 'Theme controls' });
panel.append(
  el('h1', 'Theme builder'),
  field('Preset', presetSelect),
  ...colorFields,
  radiusField,
  field('Font family', font),
  darkField,
  output,
  copy,
  message,
  contrast,
);

const preview = el('main', undefined, { class: 'tb-preview', 'aria-label': 'Preview' });
preview.append(renderer);

const app = document.querySelector<HTMLElement>('#app')!;
app.className = 'tb';
app.append(panel, preview);

void import('pricing-renderer/define').then(() => {
  renderer.yaml = pricingYaml;
  renderer.theme = 'light';
  renderer.setAttribute('theme', 'light');
});

applyPreset('default', false);
