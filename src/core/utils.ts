import type { UnknownRecord } from './types.js';

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

export function entries(value: unknown): [string, unknown][] {
  return Object.entries(asRecord(value));
}

// Turns an id written in any of the usual styles into a label: camelCase, PascalCase,
// snake_case, kebab-case, dot.case and runs of digits, with acronyms kept whole (SAML_SSO ->
// "SAML SSO", maxPomodoroTimers -> "Max Pomodoro Timers", api2Key -> "Api 2 Key"). Every word is
// capitalized, so the style of the id does not change the look of the label. A word that is
// already uppercase is left alone, and an id that yields nothing is returned unchanged.
export function humanizeIdentifier(identifier: string): string {
  const words = identifier
    // lower/digit followed by upper: maxPomodoro -> max Pomodoro
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    // acronym followed by a word: SAMLSso -> SAML Sso
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    // letter/digit boundaries: api2Key -> api 2 Key
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/[-_.\s]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  if (words.length === 0) return identifier;
  return words
    .map((word) =>
      word === word.toUpperCase() ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

export function normalizeRenderMode(value: unknown): 'auto' | 'enabled' | 'disabled' {
  const normalized = typeof value === 'string' ? value.toLowerCase() : 'auto';
  if (normalized === 'enabled' || normalized === 'disabled') {
    return normalized;
  }
  return 'auto';
}

export function unwrapValue(value: unknown): unknown {
  if (isRecord(value) && 'value' in value) {
    return value.value;
  }
  return value;
}

export function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as T;
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
    ) as T;
  }
  return value;
}

const MAX_ARRAY_INDEX = 1000;
const CANONICAL_INDEX = /^(0|[1-9]\d*)$/;

function hasOwn(target: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

function pathSegments(path: string): string[] {
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
}

function ownValue(container: object, key: string): unknown {
  return hasOwn(container, key) ? (container as Record<string, unknown>)[key] : undefined;
}

export function getAtPath(source: unknown, path: string): unknown {
  let current = source;
  for (const segment of pathSegments(path)) {
    if (Array.isArray(current)) {
      if (!CANONICAL_INDEX.test(segment)) {
        return undefined;
      }
      current = ownValue(current, segment);
    } else if (isRecord(current)) {
      current = ownValue(current, segment);
    } else {
      return undefined;
    }
  }
  return current;
}

// True when writing the path would touch a prototype or build an oversized or invalid array.
function isUnsafePath(source: unknown, segments: string[]): boolean {
  let current: unknown = source;
  for (const segment of segments) {
    if (segment === '__proto__') {
      return true;
    }
    const canonical = CANONICAL_INDEX.test(segment);
    if (current === undefined) {
      // a missing container would be an array when its segment is all digits (design.md D4)
      if (/^\d+$/.test(segment) && (!canonical || Number(segment) > MAX_ARRAY_INDEX)) {
        return true;
      }
    } else if (Array.isArray(current)) {
      if (!canonical || (!hasOwn(current, segment) && Number(segment) > MAX_ARRAY_INDEX)) {
        return true;
      }
      current = ownValue(current, segment);
    } else if (isRecord(current)) {
      current = ownValue(current, segment);
    } else {
      return false;
    }
  }
  return false;
}

// Assigns an own property, so an inherited setter is never reached.
function assignOwn(container: object, key: string, value: unknown): void {
  if (hasOwn(container, key)) {
    (container as Record<string, unknown>)[key] = value;
  } else {
    Object.defineProperty(container, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
}

export function setAtPath(source: Record<string, unknown>, path: string, value: unknown): void {
  const segments = pathSegments(path);
  if (segments.length === 0 || isUnsafePath(source, segments)) {
    return;
  }

  let current: unknown = source;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]!;
    if (!Array.isArray(current) && !isRecord(current)) {
      return;
    }
    if (ownValue(current, segment) === undefined) {
      assignOwn(current, segment, CANONICAL_INDEX.test(segments[index + 1]!) ? [] : {});
    }
    current = ownValue(current, segment);
  }

  if (Array.isArray(current) || isRecord(current)) {
    assignOwn(current, segments[segments.length - 1]!, value);
  }
}

export function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length && left.every((value, index) => deepEqual(value, right[index]))
    );
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every((key) => key in right && deepEqual(left[key], right[key]))
    );
  }
  return false;
}
