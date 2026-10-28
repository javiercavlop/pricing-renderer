import { configurePricingRenderer } from 'pricing-renderer';
import type { PricingRendererElement } from 'pricing-renderer/element';
import 'pricing-renderer/styles.css';
import pricingYaml from '../../../tests/fixtures/acme-pricing.yml?raw';

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
  '.tb label { display: grid; gap: 0.3rem; font-size: 0.85rem; font-weight: 600; }',
  '.tb label.tb-check { display: flex; align-items: center; gap: 0.5rem; }',
  '.tb input[type="color"] { width: 100%; height: 2.2rem; padding: 0; }',
  '.tb-presets { display: flex; flex-wrap: wrap; gap: 0.5rem; }',
  '.tb textarea { min-height: 9rem; font: 0.8rem ui-monospace, monospace; }',
  '.tb-preview { min-width: 0; background: #fff; border-radius: 12px; overflow: hidden; }',
  '@media (max-width: 56rem) { .tb { grid-template-columns: 1fr; } }',
].join('\n');

const FONTS: ReadonlyArray<readonly [string, string]> = [
  ['Default', ''],
  ['System UI', 'system-ui, sans-serif'],
  ['Serif', 'Georgia, "Times New Roman", serif'],
  ['Monospace', 'ui-monospace, "Cascadia Mono", Menlo, monospace'],
];

const COLOR_PROPS = {
  accent: ['--pr-color-accent'],
  surface: ['--pr-color-surface', '--pr-color-surface-raised'],
  text: ['--pr-color-text'],
} as const;
const RADIUS_PROPS: ReadonlyArray<readonly [string, number]> = [
  ['--pr-radius-sm', 0.6],
  ['--pr-radius-md', 1],
  ['--pr-radius-lg', 1.5],
];
const FONT_PROP = '--pr-font-family';
const SHADOW_PROPS = ['--pr-shadow-sm', '--pr-shadow-accent'];
const ALL_PROPS: string[] = [
  ...Object.values(COLOR_PROPS).flat(),
  ...RADIUS_PROPS.map(([name]) => name),
  ...SHADOW_PROPS,
  FONT_PROP,
];

type ColorKey = keyof typeof COLOR_PROPS;
type Preset = { colors: Partial<Record<ColorKey, string>>; radius?: number; flat?: boolean };

const PRESETS: ReadonlyArray<readonly [string, Preset]> = [
  ['Default', { colors: {} }],
  ['Flat', { colors: {}, flat: true }],
  [
    'shadcn-like',
    { colors: { accent: '#18181b', surface: '#ffffff', text: '#09090b' }, radius: 8 },
  ],
];

const DEFAULT_COLORS: Record<ColorKey, string> = {
  accent: '#6558e8',
  surface: '#ffffff',
  text: '#171723',
};
const DEFAULT_RADIUS = 14;

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

const style = el('style', PAGE_CSS);
document.head.append(style);

const renderer = document.createElement('pricing-renderer') as PricingRendererElement;
const output = el('textarea', undefined, {
  readonly: '',
  rows: '8',
  'aria-label': 'Generated CSS',
});
const message = el('p', undefined, { role: 'status' });

const overrides = new Map<string, string>();
const colorInputs = new Map<ColorKey, HTMLInputElement>();
const radius = el('input', undefined, { type: 'range', min: '0', max: '32', step: '1' });
const font = el('select');
const dark = el('input', undefined, { type: 'checkbox' });

function render(): void {
  for (const prop of ALL_PROPS) renderer.style.removeProperty(prop);
  const lines: string[] = [];
  for (const [prop, value] of overrides) {
    renderer.style.setProperty(prop, value);
    lines.push(`  ${prop}: ${value};`);
  }
  output.value = `pricing-renderer {\n${lines.join('\n')}\n}`;
}

function setColor(key: ColorKey, value: string): void {
  for (const prop of COLOR_PROPS[key]) overrides.set(prop, value);
}

function setRadius(px: number): void {
  for (const [prop, factor] of RADIUS_PROPS) {
    overrides.set(prop, `${Math.round(px * factor * 10) / 10}px`);
  }
}

function applyPreset(preset: Preset): void {
  overrides.clear();
  font.value = '';
  radius.value = String(DEFAULT_RADIUS);
  for (const [key, input] of colorInputs) {
    const color = preset.colors[key];
    input.value = color ?? DEFAULT_COLORS[key];
    if (color) setColor(key, color);
  }
  if (preset.radius !== undefined) {
    radius.value = String(preset.radius);
    setRadius(preset.radius);
  }
  if (preset.flat) for (const prop of SHADOW_PROPS) overrides.set(prop, 'none');
  render();
}

const colorFields = (
  [
    ['accent', 'Accent colour'],
    ['surface', 'Surface colour'],
    ['text', 'Text colour'],
  ] as const
).map(([key, label]) => {
  const input = el('input', undefined, { type: 'color', value: DEFAULT_COLORS[key] });
  input.addEventListener('input', () => {
    setColor(key, input.value);
    render();
  });
  colorInputs.set(key, input);
  return field(label, input);
});

radius.value = String(DEFAULT_RADIUS);
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
});

const presets = el('div', undefined, { class: 'tb-presets' });
for (const [name, preset] of PRESETS) {
  const button = el('button', name, { type: 'button' });
  button.addEventListener('click', () => applyPreset(preset));
  presets.append(button);
}

const copy = el('button', 'Copy CSS', { type: 'button' });
copy.addEventListener('click', () => {
  const fallback = (): void => {
    output.select();
    message.textContent = 'Press Ctrl+C (or Cmd+C) to copy the selected CSS.';
  };
  if (!navigator.clipboard) return fallback();
  navigator.clipboard.writeText(output.value).then(() => {
    message.textContent = 'CSS copied to the clipboard.';
  }, fallback);
});

const darkField = field('Dark mode', dark);
darkField.classList.add('tb-check');

const panel = el('section', undefined, { class: 'tb-panel', 'aria-label': 'Theme controls' });
panel.append(
  el('h1', 'Theme builder'),
  presets,
  ...colorFields,
  field('Border radius', radius),
  field('Font family', font),
  darkField,
  output,
  copy,
  message,
);

const preview = el('div', undefined, { class: 'tb-preview' });
preview.append(renderer);

const app = document.querySelector<HTMLElement>('#app')!;
app.className = 'tb';
app.append(panel, preview);

void import('pricing-renderer/define').then(() => {
  renderer.yaml = pricingYaml;
  renderer.theme = 'light';
  renderer.setAttribute('theme', 'light');
});

render();
