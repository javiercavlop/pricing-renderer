import { describe, expect, it } from 'vitest';
import {
  createPricingViewModel,
  isSafeLink,
  normalizePricing,
  type PricingCta,
} from '../../src/core/index.js';
import { expandCtaHref, planCtaView } from '../../src/element/cta.js';

describe('expandCtaHref in one pass', () => {
  // [utest->req~cta-href-template~1]
  it('does not expand a placeholder that the encoded plan id produces', () => {
    expect(expandCtaHref('/c/{planId}', '{planId}')).toBe('/c/%7BplanId%7D');
    expect(expandCtaHref('/c/{planId}/{planId}', 'a{planId}')).toBe(
      '/c/a%7BplanId%7D/a%7BplanId%7D',
    );
  });
});

describe('planCtaView with a link to another host', () => {
  const header = { syntaxVersion: '3.1', version: '1', createdAt: '2026-01-01', currency: 'EUR' };
  const pricing = normalizePricing({
    ...header,
    saasName: 'Slash',
    plans: { 'pro plus/x': { price: 5 } },
  } as never).value!;

  function viewOf(href: string): ReturnType<typeof planCtaView> {
    const ctas = [{ id: 'go', label: 'Go', planId: 'pro plus/x', href }] as unknown as PricingCta[];
    const viewModel = createPricingViewModel(pricing, undefined, {
      locale: 'en-US',
      presentation: { ctas },
    });
    return planCtaView(viewModel, viewModel.plans[0]!, {});
  }

  // [utest->req~cta-href-template-unsafe~1]
  it('renders it as a button and keeps the raw value for the event', () => {
    const view = viewOf('//evil.example/{planId}');
    expect(view.href).toBeUndefined();
    expect(view.eventHref).toBe('//evil.example/pro%20plus%2Fx');
  });

  // [utest->req~cta-href-template-unsafe~1]
  it('keeps the href of a single-slash path', () => {
    expect(viewOf('/checkout/{planId}').href).toBe('/checkout/pro%20plus%2Fx');
  });
});

describe('isSafeLink as docs/events.md describes it', () => {
  // [utest->req~cta-href-template-unsafe~1]
  it('accepts http, https, mailto, a single leading slash, ./, ../ and #', () => {
    for (const href of [
      'http://example.com',
      'https://example.com/signup',
      'mailto:sales@example.com',
      '/checkout/growth',
      '  /checkout/growth',
      '/checkout//x',
      '/a\\b',
      './checkout',
      '../checkout',
      '#plans',
    ]) {
      expect(isSafeLink(href), href).toBe(true);
    }
  });

  // [utest->req~cta-href-template-unsafe~1]
  it('rejects values that browsers read as another host', () => {
    for (const href of [
      '//evil.example',
      '//evil.example/path',
      '/\\evil.example',
      '\\/evil.example',
      '\\\\evil.example',
      '/\t/evil.example',
      '/\n/evil.example',
      '/\r\\evil.example',
      '  //evil.example',
      '\t//evil.example',
      '\n//evil.example',
      '/\t\t/evil.example',
    ]) {
      expect(isSafeLink(href), JSON.stringify(href)).toBe(false);
    }
  });

  // [utest->req~cta-href-template-unsafe~1]
  it('rejects a relative path, a query only, script schemes and nothing', () => {
    for (const href of [
      'checkout/growth',
      '?plan=x',
      'javascript:alert(1)',
      ' JavaScript:alert(1)',
      'jav\tascript:alert(1)',
      '\x01javascript:alert(1)',
      '\x01//evil.example',
      'data:text/html,x',
      '',
      undefined,
    ]) {
      expect(isSafeLink(href), String(href)).toBe(false);
    }
  });
});
