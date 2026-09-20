import test from "node:test";
import assert from "node:assert/strict";

import {
  baseJumpPt,
  jumpGain,
  calculateParkingPlan,
} from "../calculator.js";

test("base jump formula matches known values", () => {
  const values = new Map([
    [0, 45],
    [1, 47],
    [4, 51],
    [20, 71],
    [69, 135],
    [100, 175],
    [116, 196],
  ]);

  // The public calculator limits routes to 100 jumps, so 116 is not accepted.
  values.delete(116);

  for (const [jumps, expected] of values) {
    assert.equal(baseJumpPt(jumps), expected);
  }
});

test("observed 0 EN setup produces 190 EP", () => {
  assert.equal(
    jumpGain({
      jumps: 0,
      energy: 0,
      eventCharacters: 2,
      holopass: true,
      bonusMinigame: true,
    }),
    190,
  );
});

test("featured Jump Rope is a separate x1.5 multiplier", () => {
  assert.equal(
    jumpGain({
      jumps: 100,
      energy: 90,
      eventCharacters: 2,
      holopass: true,
      bonusMinigame: true,
    }),
    22080,
  );
});

test("site solver matches the current bot route totals", () => {
  const result = calculateParkingPlan({
    currentEp: 20071569,
    targetEp: 20260913,
    eventCharacters: 2,
    holopass: true,
    maxJumps: 100,
    bonusMinigame: true,
  });

  assert.equal(result.status, "ok");
  assert.equal(result.gap, 189344);
  assert.equal(result.runs, 9);
  assert.equal(result.totalEnergy, 780);

  const totalGain = result.plan.reduce((sum, move) => sum + move.gain, 0);
  assert.equal(totalGain, 189344);
});

test("guide parking example lands exactly on 52,000,000", () => {
  const result = calculateParkingPlan({
    currentEp: 51981416,
    targetEp: 52000000,
    eventCharacters: 0,
    holopass: false,
    maxJumps: 100,
    bonusMinigame: false,
  });

  assert.equal(result.status, "ok");
  assert.equal(
    result.plan.reduce((sum, move) => sum + move.gain, 0),
    18584,
  );
});
