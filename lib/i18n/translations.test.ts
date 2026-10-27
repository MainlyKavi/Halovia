import assert from "node:assert/strict";
import test from "node:test";
import { ar } from "./locales/ar.ts";
import { en } from "./locales/en.ts";
import { es } from "./locales/es.ts";
import { fr } from "./locales/fr.ts";
import { hi } from "./locales/hi.ts";
import { ru } from "./locales/ru.ts";

const catalogues = { hi, es, fr, ru, ar };
const sourceKeys = Object.keys(en);

function placeholders(value: string): string[] {
  return Array.from(value.matchAll(/\{[^}]+\}/g), ([match]) => match).sort();
}

test("every locale contains the complete English key set and matching placeholders", () => {
  for (const [language, catalogue] of Object.entries(catalogues)) {
    assert.deepEqual(Object.keys(catalogue), sourceKeys, `${language} keys differ from English`);
    for (const key of sourceKeys) {
      assert.deepEqual(
        placeholders(catalogue[key as keyof typeof catalogue]),
        placeholders(en[key as keyof typeof en]),
        `${language}:${key} has mismatched placeholders`,
      );
    }
  }
});

test("new script catalogues contain their expected writing systems", () => {
  assert.match(Object.values(hi).join(" "), /[\u0900-\u097F]/);
  assert.match(Object.values(ru).join(" "), /[\u0400-\u04FF]/);
  assert.match(Object.values(ar).join(" "), /[\u0600-\u06FF]/);
});
