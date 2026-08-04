import assert from "node:assert/strict";
import test from "node:test";
import {
  bindWeChatVisualViewportBottom,
  isWeChatBrowser,
  visualViewportBottomInset,
} from "../src/client/wechat-visual-viewport.mjs";

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }

  count(type) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

function fakeStyle(initial = {}) {
  const values = new Map(Object.entries(initial));
  const priorities = new Map();
  return {
    getPropertyValue(name) {
      return values.get(name) ?? "";
    },
    getPropertyPriority(name) {
      return priorities.get(name) ?? "";
    },
    setProperty(name, value, priority = "") {
      values.set(name, String(value));
      priorities.set(name, priority);
    },
    removeProperty(name) {
      const previous = values.get(name) ?? "";
      values.delete(name);
      priorities.delete(name);
      return previous;
    },
  };
}

function fakeWindow({ userAgent = "MicroMessenger", position = "fixed" } = {}) {
  const windowTarget = new FakeEventTarget();
  const visualViewport = new FakeEventTarget();
  visualViewport.height = 620;
  visualViewport.offsetTop = 40;
  return Object.assign(windowTarget, {
    innerHeight: 800,
    navigator: { userAgent },
    visualViewport,
    currentPosition: position,
    getComputedStyle() {
      return { position: this.currentPosition };
    },
  });
}

test("visual viewport inset measures the hidden layout-viewport bottom", () => {
  const windowRef = fakeWindow();
  assert.equal(isWeChatBrowser(windowRef), true);
  assert.equal(visualViewportBottomInset(windowRef), 140);

  windowRef.visualViewport.height = 900;
  windowRef.visualViewport.offsetTop = 0;
  assert.equal(visualViewportBottomInset(windowRef), 0);
});

test("WeChat bottom navigation follows visual viewport resize and scroll", () => {
  const windowRef = fakeWindow();
  const element = { style: fakeStyle({ bottom: "3px" }) };
  const unbind = bindWeChatVisualViewportBottom(element, windowRef);

  assert.equal(element.style.getPropertyValue("bottom"), "140px");
  assert.equal(windowRef.visualViewport.count("resize"), 1);
  assert.equal(windowRef.visualViewport.count("scroll"), 1);
  assert.equal(windowRef.count("resize"), 1);

  windowRef.visualViewport.height = 680;
  windowRef.visualViewport.offsetTop = 20;
  windowRef.visualViewport.dispatch("resize");
  assert.equal(element.style.getPropertyValue("bottom"), "100px");

  windowRef.currentPosition = "sticky";
  windowRef.dispatch("resize");
  assert.equal(element.style.getPropertyValue("bottom"), "");

  unbind();
  assert.equal(element.style.getPropertyValue("bottom"), "3px");
  assert.equal(windowRef.visualViewport.count("resize"), 0);
  assert.equal(windowRef.visualViewport.count("scroll"), 0);
  assert.equal(windowRef.count("resize"), 0);
});

test("non-WeChat browsers retain the existing CSS positioning", () => {
  const windowRef = fakeWindow({ userAgent: "Chrome/140" });
  const element = { style: fakeStyle({ bottom: "7px" }) };
  const unbind = bindWeChatVisualViewportBottom(element, windowRef);

  assert.equal(isWeChatBrowser(windowRef), false);
  assert.equal(element.style.getPropertyValue("bottom"), "7px");
  assert.equal(windowRef.visualViewport.count("resize"), 0);
  unbind();
});
