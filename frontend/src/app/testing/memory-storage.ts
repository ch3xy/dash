/**
 * In-memory `Storage` for unit tests. Node 26 has its own global `localStorage`, which is undefined
 * without `--localstorage-file` and hides the one from jsdom; stub it with `vi.stubGlobal`.
 */
export function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length(): number {
      return values.size;
    },
    clear(): void {
      values.clear();
    },
    getItem(key: string): string | null {
      return values.get(key) ?? null;
    },
    key(index: number): string | null {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string): void {
      values.delete(key);
    },
    setItem(key: string, value: string): void {
      values.set(key, value);
    },
  };
}
