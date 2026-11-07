// A whitespace separated attribute and an array property, both narrowed to a fixed set of part
// names. Shared by the sections of <pricing-renderer> and the parts of <pricing-change-review>.

export interface SectionsConverter<T extends string> {
  fromAttribute(value: string | null): T[] | undefined;
}

// Whitespace separated; only tokens that exactly match a name are kept, in order.
export function sectionsConverter<T extends string>(names: readonly T[]): SectionsConverter<T> {
  return {
    fromAttribute(value: string | null): T[] | undefined {
      if (value === null) return undefined;
      return value
        .split(/[\t\n\f\r ]+/)
        .filter((token): token is T => (names as readonly string[]).includes(token));
    },
  };
}

// A value that is not an array hides nothing, and neither does an item that is not a name.
export function hiddenNamesOf<T extends string>(
  names: readonly T[],
  value: unknown,
): ReadonlySet<T> {
  const hidden = new Set<T>();
  if (!Array.isArray(value)) return hidden;
  for (const item of value) {
    if ((names as readonly unknown[]).includes(item)) hidden.add(item as T);
  }
  return hidden;
}
