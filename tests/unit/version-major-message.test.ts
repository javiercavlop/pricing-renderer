import { describe, expect, it } from 'vitest';
import { normalizePricing } from '../../src/core/index.js';

function unsupportedMajor(syntaxVersion: string) {
  const result = normalizePricing({ syntaxVersion, saasName: 'Old', plans: {} });
  expect(result.ok).toBe(false);
  const found = result.diagnostics.filter((item) => item.code === 'PR_VERSION_UNSUPPORTED_MAJOR');
  expect(found).toHaveLength(1);
  return found[0]!;
}

// [utest->req~version-major-upgrade-hint~1]
describe('unsupported major version message', () => {
  it.each(['2.1', '1.0'])('names the server-side upgrade for %s', (version) => {
    const item = unsupportedMajor(version);
    const major = version.split('.')[0];
    expect(item.severity).toBe('error');
    expect(item.path).toBe('syntaxVersion');
    expect(item.message).toBe(
      `Pricing2Yaml major version ${major} is not supported. Upgrade the pricing to 3.x on the server, for example with retrievePricingFromText from pricing4ts/server.`,
    );
    expect(item.message).toContain('retrievePricingFromText');
    expect(item.message).toContain('pricing4ts/server');
  });

  it('says a newer major is not supported yet, without naming pricing4ts', () => {
    const item = unsupportedMajor('4.0');
    expect(item.severity).toBe('error');
    expect(item.path).toBe('syntaxVersion');
    expect(item.message).toBe('Pricing2Yaml major version 4 is not supported yet.');
    expect(item.message).not.toContain('pricing4ts');
  });
});
