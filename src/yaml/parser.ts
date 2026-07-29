import { normalizePricing } from '../core/index.js';
import type {
  IPricingLike,
  NormalizedPricing,
  PricingDiagnostic,
  PricingResult,
} from '../core/index.js';
import { isMap, parseDocument } from 'yaml';
import type { ParsePricingYamlOptions } from './types.js';

export function parsePricingYaml(
  source: string,
  options: ParsePricingYamlOptions = {},
): PricingResult<NormalizedPricing> {
  if (typeof source !== 'string' || !source.trim()) {
    return {
      ok: false,
      diagnostics: [
        {
          code: 'PR_YAML_EMPTY',
          severity: 'error',
          message: 'The YAML source is empty.',
          path: '$',
        },
      ],
    };
  }

  try {
    const document = parseDocument(source, {
      schema: 'core',
      customTags: [],
      prettyErrors: true,
      strict: true,
      uniqueKeys: true,
    });
    const diagnostics: PricingDiagnostic[] = [
      ...document.errors.map((error) => ({
        code: 'PR_YAML_PARSE_ERROR',
        severity: 'error' as const,
        message: error.message,
        path: '$',
      })),
      ...document.warnings.map((warning) => ({
        code: 'PR_YAML_PARSE_WARNING',
        severity: 'warning' as const,
        message: warning.message,
        path: '$',
      })),
    ];
    if (document.errors.length > 0) {
      return { ok: false, diagnostics };
    }
    if (!isMap(document.contents)) {
      return {
        ok: false,
        diagnostics: [
          ...diagnostics,
          {
            code: 'PR_YAML_ROOT_INVALID',
            severity: 'error',
            message: 'The YAML root must be a mapping.',
            path: '$',
          },
        ],
      };
    }

    const value = document.toJS({
      maxAliasCount: options.maxAliasCount ?? 50,
      mapAsMap: false,
    }) as IPricingLike;
    const normalized = normalizePricing(value);
    return {
      ...normalized,
      diagnostics: [...diagnostics, ...normalized.diagnostics],
    };
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        {
          code: 'PR_YAML_PARSE_ERROR',
          severity: 'error',
          message: error instanceof Error ? error.message : 'The YAML could not be parsed.',
          path: '$',
        },
      ],
    };
  }
}
