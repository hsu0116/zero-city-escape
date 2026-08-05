import test from "node:test";
import assert from "node:assert/strict";
import {
  CORRECT_RECEIPT_ORDER,
  CORRECT_ROUTE,
  GATE_STEPS,
  canExtendRoute,
  isCorrectReceiptOrder,
  isCorrectRoute,
  relativeTurn,
  requiredMapRotation,
} from "../src/game/p01.ts";

test("receipt order is chronological around the 23:00 bell", () => {
  assert.equal(isCorrectReceiptOrder(CORRECT_RECEIPT_ORDER), true);
  assert.equal(isCorrectReceiptOrder([...CORRECT_RECEIPT_ORDER].reverse()), false);
});

test("route can only extend along open adjacent roads", () => {
  assert.equal(canExtendRoute(["impound"], "camellia"), true);
  assert.equal(canExtendRoute(["impound"], "tax"), false);
  assert.equal(isCorrectRoute(CORRECT_ROUTE), true);
});

test("all five gate turns match the authored relative sequence", () => {
  assert.deepEqual(GATE_STEPS.map((step) => relativeTurn(step.incoming, step.outgoing)), [
    "left", "straight", "right", "left", "right",
  ]);
});

test("map rotations align each incoming direction with north", () => {
  assert.deepEqual(GATE_STEPS.map((step) => requiredMapRotation(step.incoming)), [0, 90, 90, 0, 90]);
});
