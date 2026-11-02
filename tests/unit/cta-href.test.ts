import { describe, expect, it } from 'vitest';
import { isSafeLink } from '../../src/core/index.js';
import { expandCtaHref } from '../../src/element/cta.js';

describe('expandCtaHref in one pass', () => {
  // [utest->req~cta-href-template~1]
  it('does not expand a placeholder that the encoded plan id produces', () => {
    expect(expandCtaHref('/c/{planId}', '{planId}')).toBe('/c/%7BplanId%7D');
    expect(expandCtaHref('/c/{planId}/{planId}', 'a{planId}')).toBe(
      '/c/a%7BplanId%7D/a%7BplanId%7D',
    );
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
      'data:text/html,x',
      '',
      undefined,
    ]) {
      expect(isSafeLink(href), String(href)).toBe(false);
    }
  });
});
