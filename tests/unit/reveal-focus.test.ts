// The element is loaded in the node environment, so the focus step is called on a stand-in target.
// The real focus ring in each engine is covered by tests/browser/reveal-focus.spec.ts.
import { describe, expect, it } from 'vitest';

type FocusCall = unknown[];

interface Target {
  attributes: Map<string, string>;
  focusCalls: FocusCall[];
  hasAttribute(name: string): boolean;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  addEventListener(type: string, listener: () => void): void;
  focus(...args: unknown[]): void;
}

function fakeTarget(): Target {
  const attributes = new Map<string, string>();
  const focusCalls: FocusCall[] = [];
  return {
    attributes,
    focusCalls,
    hasAttribute: (name) => attributes.has(name),
    setAttribute: (name, value) => void attributes.set(name, value),
    removeAttribute: (name) => void attributes.delete(name),
    addEventListener: () => undefined,
    focus: (...args) => void focusCalls.push(args),
  };
}

async function focusRevealed(target: Target, byKeyboard: boolean): Promise<void> {
  const loaded: unknown = await import('../../src/element/pricing-renderer-element.js');
  const Element = (
    loaded as { PricingRendererElement: new () => Record<string, (...args: unknown[]) => void> }
  ).PricingRendererElement;
  const element = new Element();
  element._focusRevealed!.call(element, target, byKeyboard);
}

// [utest->req~reveal-focus-visible~1]
describe('focus after Show more', () => {
  it('asks for :focus-visible when the button was activated from the keyboard', async () => {
    const target = fakeTarget();
    await focusRevealed(target, true);
    expect(target.focusCalls).toEqual([[{ focusVisible: true }]]);
    expect(target.attributes.get('tabindex')).toBe('-1');
  });

  it('uses a plain focus() when the button was activated by a pointer', async () => {
    const target = fakeTarget();
    await focusRevealed(target, false);
    expect(target.focusCalls).toEqual([[]]);
    expect(target.attributes.get('tabindex')).toBe('-1');
  });
});
