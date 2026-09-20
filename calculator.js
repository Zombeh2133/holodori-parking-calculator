export const ENERGY_MULTIPLIERS = Object.freeze({
  0: 1,
  15: 6,
  30: 12,
  45: 17,
  60: 22,
  75: 26,
  90: 30,
});

const MIN_MATCH_RUN_COST = 45.0;
const CLOSE_TAIL_RUNS = 4;
const solverCache = new Map();

export function baseJumpPt(jumps) {
  const value = Number(jumps);
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new RangeError("Jumps must be a whole number from 0 to 100.");
  }

  // Exact integer form of ROUNDUP(45 + 1.3 * jumps, 0).
  return Math.floor((450 + 13 * value + 9) / 10);
}

export function jumpGain({
  jumps,
  energy,
  eventCharacters,
  holopass,
  bonusMinigame,
}) {
  const energyValue = Number(energy);
  const characters = Number(eventCharacters);

  if (!(energyValue in ENERGY_MULTIPLIERS)) {
    throw new RangeError("Unsupported energy value.");
  }
  if (!Number.isInteger(characters) || characters < 0 || characters > 5) {
    throw new RangeError("Event characters must be from 0 to 5.");
  }

  const base = baseJumpPt(jumps);

  // Confirmed reward order used by the Discord calculator:
  // base
  // -> event-character multiplier (+20% each)
  // -> featured Jump Rope multiplier (x1.5 when active)
  // -> ceil once
  // -> HoloPass x2 when owned
  // -> energy multiplier
  //
  // Integer form:
  // characters multiplier = (5 + characters) / 5
  // featured multiplier = 3 / 2 (or 1 = 2 / 2)
  const boostedNumerator =
    base *
    (5 + characters) *
    (bonusMinigame ? 3 : 2);

  let boosted = Math.floor((boostedNumerator + 9) / 10);

  if (holopass) {
    boosted *= 2;
  }

  return boosted * ENERGY_MULTIPLIERS[energyValue];
}

function moveCost(jumps, energy, maxJumps) {
  let cost = MIN_MATCH_RUN_COST + Number(energy);

  if (energy > 0 && maxJumps > 0) {
    const utilization = Number(jumps) / Number(maxJumps);
    if (utilization < 0.25) {
      cost += (0.25 - utilization) * Number(energy) * 1.5;
    }
  }

  return cost;
}

function makeMove({
  jumps,
  energy,
  eventCharacters,
  holopass,
  maxJumps,
  bonusMinigame,
}) {
  return {
    gain: jumpGain({
      jumps,
      energy,
      eventCharacters,
      holopass,
      bonusMinigame,
    }),
    energy: Number(energy),
    jumps: Number(jumps),
    cost: moveCost(jumps, energy, maxJumps),
  };
}

function gcd(a, b) {
  let x = Math.abs(Number(a));
  let y = Math.abs(Number(b));

  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }

  return x;
}

function solverTables({
  eventCharacters,
  holopass,
  maxJumps,
  bonusMinigame,
}) {
  const cacheKey = [
    eventCharacters,
    holopass ? 1 : 0,
    maxJumps,
    bonusMinigame ? 1 : 0,
  ].join(":");

  if (solverCache.has(cacheKey)) {
    return solverCache.get(cacheKey);
  }

  const bestByGain = new Map();

  for (const energyText of Object.keys(ENERGY_MULTIPLIERS)) {
    const energy = Number(energyText);

    for (let jumps = 0; jumps <= maxJumps; jumps += 1) {
      const move = makeMove({
        jumps,
        energy,
        eventCharacters,
        holopass,
        maxJumps,
        bonusMinigame,
      });

      const previous = bestByGain.get(move.gain);
      const moveTuple = [move.cost, move.energy, -move.jumps];
      const previousTuple = previous
        ? [previous.cost, previous.energy, -previous.jumps]
        : null;

      if (
        !previous ||
        compareTuples(moveTuple, previousTuple) < 0
      ) {
        bestByGain.set(move.gain, move);
      }
    }
  }

  const moves = [...bestByGain.values()].sort((a, b) => {
    if (a.gain !== b.gain) return a.gain - b.gain;
    return a.cost - b.cost;
  });

  const single = new Map(moves.map((move) => [move.gain, move]));
  const pair = new Map();

  for (let index = 0; index < moves.length; index += 1) {
    const first = moves[index];

    for (let secondIndex = index; secondIndex < moves.length; secondIndex += 1) {
      const second = moves[secondIndex];
      const gain = first.gain + second.gain;
      const cost = first.cost + second.cost;
      const previous = pair.get(gain);

      if (!previous || cost < previous.cost) {
        pair.set(gain, {
          cost,
          moves: [first, second],
        });
      }
    }
  }

  let gcdValue = 0;
  for (const gain of single.keys()) {
    gcdValue = gcd(gcdValue, gain);
  }

  const maxGain = single.size
    ? Math.max(...single.keys())
    : 0;

  const tables = {
    moves,
    single,
    pair,
    gcdValue,
    maxGain,
  };

  solverCache.set(cacheKey, tables);
  return tables;
}

function compareTuples(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return a.length - b.length;
}

function planKey(plan) {
  const cost = Math.round(
    plan.reduce((sum, move) => sum + move.cost, 0) * 1_000_000,
  ) / 1_000_000;

  const energy = plan.reduce((sum, move) => sum + move.energy, 0);
  const jumps = plan.reduce((sum, move) => sum + move.jumps, 0);

  return [
    cost,
    plan.length,
    energy,
    -jumps,
  ];
}

function bestTailPlan(remaining, moves, single, pair) {
  if (remaining === 0) {
    return [];
  }

  const candidates = [];

  const direct = single.get(remaining);
  if (direct) {
    candidates.push([direct]);
  }

  const pairHit = pair.get(remaining);
  if (pairHit) {
    candidates.push([...pairHit.moves]);
  }

  // 3 runs = one move + a precomputed pair.
  for (const move of moves) {
    const rest = remaining - move.gain;
    if (rest <= 0) continue;

    const hit = pair.get(rest);
    if (hit) {
      candidates.push([move, ...hit.moves]);
    }
  }

  // 4 runs = pair + pair.
  for (const [gain, firstPair] of pair.entries()) {
    const rest = remaining - gain;

    // Avoid testing the same two pair sums twice.
    if (rest < gain) continue;

    const secondPair = pair.get(rest);
    if (secondPair) {
      candidates.push([
        ...firstPair.moves,
        ...secondPair.moves,
      ]);
    }
  }

  if (!candidates.length) {
    return null;
  }

  let best = candidates[0];
  let bestKey = planKey(best);

  for (let index = 1; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const key = planKey(candidate);

    if (compareTuples(key, bestKey) < 0) {
      best = candidate;
      bestKey = key;
    }
  }

  return best;
}

export function calculateParkingPlan({
  currentEp,
  targetEp,
  eventCharacters,
  holopass,
  maxJumps = 100,
  bonusMinigame = false,
}) {
  const current = Number(currentEp);
  const target = Number(targetEp);
  const characters = Number(eventCharacters);
  const max = Number(maxJumps);

  if (!Number.isSafeInteger(current) || current < 0) {
    throw new RangeError("Current EP must be a whole non-negative number.");
  }
  if (!Number.isSafeInteger(target) || target < 0) {
    throw new RangeError("Target EP must be a whole non-negative number.");
  }
  if (!Number.isInteger(characters) || characters < 0 || characters > 5) {
    throw new RangeError("Event characters must be from 0 to 5.");
  }
  if (!Number.isInteger(max) || max < 0 || max > 100) {
    throw new RangeError("Max jumps must be a whole number from 0 to 100.");
  }

  const gap = target - current;

  if (gap < 0) {
    return {
      status: "past",
      gap,
    };
  }

  if (gap === 0) {
    return {
      status: "already",
      gap: 0,
      plan: [],
      runs: 0,
      totalEnergy: 0,
    };
  }

  const {
    moves,
    single,
    pair,
    gcdValue,
    maxGain,
  } = solverTables({
    eventCharacters: characters,
    holopass: Boolean(holopass),
    maxJumps: max,
    bonusMinigame: Boolean(bonusMinigame),
  });

  if (!moves.length || maxGain <= 0) {
    return {
      status: "none",
      gap,
      gcd: gcdValue,
    };
  }

  if (gcdValue > 1 && gap % gcdValue !== 0) {
    return {
      status: "gcd",
      gap,
      gcd: gcdValue,
      remainder: gap % gcdValue,
    };
  }

  let bestPlan = null;

  const consider = (plan) => {
    if (!plan) return;

    const gain = plan.reduce((sum, move) => sum + move.gain, 0);
    if (gain !== gap) return;

    if (
      !bestPlan ||
      compareTuples(planKey(plan), planKey(bestPlan)) < 0
    ) {
      bestPlan = [...plan];
    }
  };

  const tailLimit = CLOSE_TAIL_RUNS * maxGain;

  if (gap <= tailLimit) {
    consider(bestTailPlan(
      gap,
      moves,
      single,
      pair,
    ));
  }

  // For large gaps, use a full-jump bulk run to get close, then solve
  // the exact tail in <=4 runs. This is the same strategy as the bot.
  for (const energy of [15, 30, 45, 60, 75, 90]) {
    const bulk = makeMove({
      jumps: max,
      energy,
      eventCharacters: characters,
      holopass: Boolean(holopass),
      maxJumps: max,
      bonusMinigame: Boolean(bonusMinigame),
    });

    if (bulk.gain <= 0) continue;

    const maximumCount = Math.floor(gap / bulk.gain);
    const minimumCount = Math.max(
      0,
      Math.ceil(Math.max(0, gap - tailLimit) / bulk.gain),
    );

    for (let count = minimumCount; count <= maximumCount; count += 1) {
      const remaining = gap - count * bulk.gain;
      const tail = bestTailPlan(
        remaining,
        moves,
        single,
        pair,
      );

      if (!tail) continue;

      const plan = [];
      for (let index = 0; index < count; index += 1) {
        plan.push(bulk);
      }
      plan.push(...tail);
      consider(plan);
    }
  }

  if (!bestPlan) {
    return {
      status: "none",
      gap,
      gcd: gcdValue,
      minGain: single.size ? Math.min(...single.keys()) : 0,
    };
  }

  // Larger / higher-energy runs first; correction runs at the end.
  bestPlan.sort((a, b) => {
    if (a.gain !== b.gain) return b.gain - a.gain;
    if (a.energy !== b.energy) return b.energy - a.energy;
    return b.jumps - a.jumps;
  });

  return {
    status: "ok",
    gap,
    plan: bestPlan,
    gcd: gcdValue,
    totalEnergy: bestPlan.reduce((sum, move) => sum + move.energy, 0),
    runs: bestPlan.length,
  };
}

export function compressPlan(plan) {
  const grouped = [];

  for (const move of plan) {
    const previous = grouped.at(-1);

    if (
      previous &&
      previous.move.energy === move.energy &&
      previous.move.jumps === move.jumps &&
      previous.move.gain === move.gain
    ) {
      previous.count += 1;
    } else {
      grouped.push({
        move,
        count: 1,
      });
    }
  }

  return grouped;
}
