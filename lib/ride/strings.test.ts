import assert from "node:assert/strict";
import test from "node:test";
import { rideStrings, translateRide } from "./strings.ts";

const placeholders = (value: string) => Array.from(value.matchAll(/\{[^}]+\}/gu), ([match]) => match).sort();

test("Hindi and Spanish ride strings cover every English key with the same placeholders", () => {
  const sourceKeys = Object.keys(rideStrings.en);
  for (const language of ["hi", "es"] as const) {
    assert.deepEqual(Object.keys(rideStrings[language]).sort(), [...sourceKeys].sort(), `${language} keys differ from English`);
    for (const key of sourceKeys as Array<keyof typeof rideStrings.en>) {
      assert.ok(rideStrings[language][key].trim(), `${language}:${key} is empty`);
      assert.deepEqual(placeholders(rideStrings[language][key]), placeholders(rideStrings.en[key]), `${language}:${key} placeholders`);
    }
  }
  assert.match(Object.values(rideStrings.hi).join(" "), /[ऀ-ॿ]/u);
});

test("translateRide fills placeholders", () => {
  assert.equal(translateRide("en", "track.sharingWith", { count: 3 }), "Sharing with 3 people");
  assert.equal(translateRide("es", "home.greeting", { name: "Ana" }), "Hola, Ana");
});
