import test from "node:test";
import assert from "node:assert/strict";
import {
  PROPERTIES,
  SOLUTION,
  currentRent,
  isCorrectWord,
  validateOrientations,
  validateReceiptChain,
  validateRentAssignments,
  validateScan,
} from "../src/game/p01.ts";

test("current rents combine deed table, building state, and mortgage rule", () => {
  const rents = Object.fromEntries(PROPERTIES.map((property) => [property.id, currentRent(property)]));
  assert.deepEqual(rents, { camellia: 30, clock: 22, harbor: 7, cloud: 42, bank: 18, relay: 12 });
});

test("receipt tears form one unique start-to-gate chain", () => {
  assert.equal(validateReceiptChain(SOLUTION), true);
  const swapped = SOLUTION.map((slot) => ({ ...slot }));
  [swapped[1], swapped[2]] = [swapped[2], swapped[1]];
  assert.equal(validateReceiptChain(swapped), false);
});

test("receipt amounts map to unique current-rent properties", () => {
  assert.equal(validateRentAssignments(SOLUTION), true);
  const wrongProperty = SOLUTION.map((slot) => ({ ...slot }));
  wrongProperty[0].propertyId = "relay";
  assert.equal(validateRentAssignments(wrongProperty), false);
});

test("entry-notch orientations must match incoming roads", () => {
  assert.equal(validateOrientations(SOLUTION), true);
  const wrongRotation = SOLUTION.map((slot) => ({ ...slot }));
  wrongRotation[3].rotation = 270;
  assert.equal(validateOrientations(wrongRotation), false);
});

test("scan only solves when all three independent conditions hold", () => {
  assert.deepEqual(validateScan(SOLUTION), { solved: true, chain: true, rents: true, orientations: true });
});

test("word lock accepts normalized Korean answer and rejects thematic guesses", () => {
  assert.equal(isCorrectWord(" 무 소 유 "), true);
  assert.equal(isCorrectWord("파산"), false);
  assert.equal(isCorrectWord("탈출"), false);
});
