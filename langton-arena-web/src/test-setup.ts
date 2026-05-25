// src/test-setup.ts
// Полифил localStorage для jsdom-окружения vitest.
// jsdom реализует Storage, но некоторые среды не экспортируют .clear() корректно.

const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem:    (key: string) => store[key] ?? null,
    setItem:    (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear:      () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key:        (i: number) => Object.keys(store)[i] ?? null,
  };
};

Object.defineProperty(globalThis, 'localStorage', {
  value: createLocalStorageMock(),
  writable: true,
});
