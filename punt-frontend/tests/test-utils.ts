import { JSDOM } from "jsdom";

export function setupDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const { window } = dom;
  const typedWindow = window as unknown as Window & typeof globalThis & {
    HTMLElement: typeof globalThis.HTMLElement;
    MutationObserver: typeof globalThis.MutationObserver;
  };
  globalThis.window = typedWindow;
  globalThis.document = typedWindow.document;
  globalThis.navigator = typedWindow.navigator;
  globalThis.HTMLElement = typedWindow.HTMLElement;
  globalThis.MutationObserver = typedWindow.MutationObserver;
  return () => {
    dom.window.close();
    delete (globalThis as Partial<typeof globalThis>).window;
    delete (globalThis as Partial<typeof globalThis>).document;
    delete (globalThis as Partial<typeof globalThis>).navigator;
    delete (globalThis as Partial<typeof globalThis>).HTMLElement;
    delete (globalThis as Partial<typeof globalThis>).MutationObserver;
  };
}
