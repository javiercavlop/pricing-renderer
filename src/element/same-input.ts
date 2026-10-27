// Structural compare for the loading inputs of the element (pricing, request, normalizeOptions).
// Arrays and plain objects are compared by content. Everything else (primitives, functions, Headers,
// AbortSignal, Date and other class instances) is compared with Object.is, because the content of
// those cannot be read by key. The exported `deepEqual` of the core is not used: it treats two
// Headers objects as equal.

// A deeper structure, or a cycle, is reported as different, so the compare stays finite without
// tracking visited objects.
const MAX_DEPTH = 64;

const hasOwn = Object.prototype.hasOwnProperty;

function isPlain(value: object): boolean {
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function same(left: unknown, right: unknown, depth: number): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== 'object' || typeof right !== 'object' || left === null || right === null) {
    return false;
  }
  if (depth >= MAX_DEPTH) return false;

  if (Array.isArray(left)) {
    if (!Array.isArray(right) || left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (!same(left[index], right[index], depth + 1)) return false;
    }
    return true;
  }
  if (Array.isArray(right) || !isPlain(left) || !isPlain(right)) return false;

  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  let count = 0;
  for (const key in a) {
    if (!hasOwn.call(a, key)) continue;
    if (!hasOwn.call(b, key) || !same(a[key], b[key], depth + 1)) return false;
    count += 1;
  }
  for (const key in b) {
    if (hasOwn.call(b, key)) count -= 1;
  }
  return count === 0;
}

// [impl->req~element-input-structural-compare~1]
export function sameInput(left: unknown, right: unknown): boolean {
  return same(left, right, 0);
}

// The `hasChanged` of the Lit properties that start a load.
export function inputChanged(value: unknown, previous: unknown): boolean {
  return !same(value, previous, 0);
}
