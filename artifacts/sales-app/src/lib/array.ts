export function toArray<T>(value: T[] | null | undefined): T[];
export function toArray<T>(value: unknown): T[];
export function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
