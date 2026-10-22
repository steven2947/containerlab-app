import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getUiLanguage, setUiLanguage, uiText } from "./index";
import { zhCN } from "./zh-CN";

afterEach(() => setUiLanguage("en"));

test("Chinese translates copy while preserving interpolated device names", () => {
  setUiLanguage("zh-CN");
  assert.equal(uiText("Delay"), "延迟");
  assert.equal(uiText("Actions for {0}", { 0: "Delete" }), "Delete 的操作");
});

test("English and unknown technical strings are preserved", () => {
  setUiLanguage("en");
  assert.equal(getUiLanguage(), "en");
  assert.equal(uiText("Delete"), "Delete");
  setUiLanguage("zh-CN");
  assert.equal(uiText("network-mode: none"), "network-mode: none");
  assert.equal(uiText("toString"), "toString");
  assert.equal(uiText("__proto__"), "__proto__");
  assert.equal(uiText("unmapped {0}", { 0: "$& <node>" }), "unmapped $& <node>");
});

test("significant spacing and missing placeholders survive translation", () => {
  setUiLanguage("zh-CN");
  assert.equal(uiText(" Delete "), " 删除 ");
  assert.equal(uiText("Actions for {0}"), "{0} 的操作");
});

test("every translation preserves its interpolation placeholders", () => {
  for (const [message, translation] of Object.entries(zhCN)) {
    assert.ok(translation.trim().length > 0, message);
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    assert.deepEqual(placeholders(translation), placeholders(message), message);
  }
});

test("language preference is persisted and storage failures remain optional", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const saved = new Map<string, string>();
  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: { setItem: (key: string, value: string) => saved.set(key, value) }
    });
    setUiLanguage("zh-CN");
    assert.equal(saved.get("clab-ui-language"), "zh-CN");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: () => { throw new Error("Storage disabled"); }
    });
    assert.doesNotThrow(() => setUiLanguage("en"));
    assert.equal(uiText("Delay"), "Delay");
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
