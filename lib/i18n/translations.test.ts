import assert from "node:assert/strict";
import test from "node:test";
import { en } from "./locales/en.ts";
import { translations } from "./translations.ts";

const sourceKeys = Object.keys(en);

function placeholders(value: string): string[] {
  return Array.from(value.matchAll(/\{[^}]+\}/g), ([match]) => match).sort();
}

test("every supported locale resolves the complete English key set and matching placeholders", () => {
  for (const [language, catalogue] of Object.entries(translations)) {
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

test("supported script catalogues contain their expected writing systems", () => {
  assert.match(Object.values(translations.hi).join(" "), /[\u0900-\u097F]/u);
  assert.match(Object.values(translations.ur).join(" "), /[\u0600-\u06FF]/u);
  assert.match(Object.values(translations.bn).join(" "), /[\u0980-\u09FF]/u);
  assert.match(Object.values(translations.ta).join(" "), /[\u0B80-\u0BFF]/u);
  assert.match(Object.values(translations.ar).join(" "), /[\u0600-\u06FF]/u);
  assert.match(Object.values(translations.ru).join(" "), /[\u0400-\u04FF]/u);
});

test("Hindi and Arabic landing copy does not regress to prototype-era fallbacks", () => {
  assert.equal(translations.hi["landing.emergencyHeading"], "जब ज़रूरत हो, मदद पाएँ");
  assert.equal(translations.hi["landing.themeTitle"], "हर रोशनी में आरामदायक");
  assert.equal(translations.hi["landing.ctaTitle"], "हर यात्रा को थोड़ा अधिक सुरक्षित महसूस कराएँ");
  assert.equal(translations.hi["landing.footerText"], "रोज़मर्रा की यात्रा के लिए यात्रा साझा करना और सुरक्षा चेक-इन।");
  assert.equal(translations.ar["landing.emergencyHeading"], "مساعدة وقت الحاجة");
  assert.equal(translations.ar["landing.themeTitle"], "مريح في كل إضاءة");
  assert.equal(translations.ar["landing.ctaTitle"], "اجعلي كل رحلة أكثر طمأنينة");
  assert.equal(translations.ar["landing.footerText"], "مشاركة الرحلات وتسجيل الاطمئنان للتنقل اليومي.");
});
