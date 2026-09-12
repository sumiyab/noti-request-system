import '@testing-library/jest-dom';

// Radix primitives (RadioGroup etc.) and sonner expect these browser APIs, which jsdom lacks.
global.ResizeObserver = class {
  observe = () => {};
  unobserve = () => {};
  disconnect = () => {};
};

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

beforeEach(() => {
  global.fetch = jest.fn();
});
