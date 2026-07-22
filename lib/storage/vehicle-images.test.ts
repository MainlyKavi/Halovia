import assert from "node:assert/strict";
import test from "node:test";
import { MAX_VEHICLE_IMAGE_BYTES, validateVehicleImage } from "./vehicle-images.ts";

test("vehicle images accept only JPEG, PNG, or WebP within the size limit", () => {
  assert.equal(validateVehicleImage({ type: "image/jpeg", size: 50_000 }), null);
  assert.equal(validateVehicleImage({ type: "image/png", size: MAX_VEHICLE_IMAGE_BYTES }), null);
  assert.equal(validateVehicleImage({ type: "image/webp", size: 100_000 }), null);
  assert.equal(validateVehicleImage({ type: "image/gif", size: 100_000 }), "type");
  assert.equal(validateVehicleImage({ type: "image/jpeg", size: MAX_VEHICLE_IMAGE_BYTES + 1 }), "size");
});
