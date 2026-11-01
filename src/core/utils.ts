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

export function humanizeIdentifier(identifier: string): string {
  const spaced = identifier
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : identifier;
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

export function getAtPath(source: unknown, path: string): unknown {
  const segments = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  let current = source;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      if (!hasOwn(current, segment)) {
        return undefined;
      }
      current = (current as unknown as Record<string, unknown>)[segment];
    } else if (isRecord(current)) {
      if (!hasOwn(current, segment)) {
        return undefined;
      }
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_ARRAY_INDEX = 1000;

function hasOwn(target: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

// True when writing the path would touch a prototype or build an oversized sparse array.
function isUnsafePath(source: unknown, segments: string[]): boolean {
  if (segments.some((segment) => FORBIDDEN_SEGMENTS.has(segment))) {
    return true;
  }
  // a missing container is created as an array exactly when its segment is numeric
  let current: unknown = source;
  for (const segment of segments) {
    const numeric = /^\d+$/.test(segment);
    const isArray = current === undefined ? numeric : Array.isArray(current);
    if (isArray && numeric && Number(segment) > MAX_ARRAY_INDEX) {
      return true;
    }
    if (current !== undefined && typeof current === 'object' && current !== null) {
      const key = Array.isArray(current) ? Number(segment) : segment;
      current = hasOwn(current, key) ? (current as Record<PropertyKey, unknown>)[key] : undefined;
    } else {
      current = undefined;
    }
  }
  return false;
}

export function setAtPath(source: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  if (segments.length === 0 || isUnsafePath(source, segments)) {
    return;
  }

  let current: unknown = source;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]!;
    const next = segments[index + 1]!;
    if (Array.isArray(current)) {
      const numericIndex = Number(segment);
      if (!hasOwn(current, numericIndex) || current[numericIndex] === undefined) {
        current[numericIndex] = /^\d+$/.test(next) ? [] : {};
      }
      current = current[numericIndex];
    } else if (isRecord(current)) {
      if (!hasOwn(current, segment) || current[segment] === undefined) {
        current[segment] = /^\d+$/.test(next) ? [] : {};
      }
      current = current[segment];
    }
  }

  const finalSegment = segments[segments.length - 1]!;
  if (Array.isArray(current)) {
    current[Number(finalSegment)] = value;
  } else if (isRecord(current)) {
    current[finalSegment] = value;
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
