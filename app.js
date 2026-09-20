import {
  calculateParkingPlan,
  compressPlan,
  ENERGY_MULTIPLIERS,
  baseJumpPt,
} from "./calculator.js";

const form = document.querySelector("#parking-form");
const currentEp = document.querySelector("#current-ep");
const targetEp = document.querySelector("#target-ep");
const eventCharacters = document.querySelector("#event-characters");
const holopass = document.querySelector("#holopass");
const bonusMinigame = document.querySelector("#bonus-minigame");
const maxJumps = document.querySelector("#max-jumps");
const results = document.querySelector("#results");
const resultBody = document.querySelector("#result-body");
const copyRouteButton = document.querySelector("#copy-route");
const copyLinkButton = document.querySelector("#copy-link");
const loadExampleButton = document.querySelector("#load-example");
const calculateButton = document.querySelector("#calculate-button");

const integerFormat = new Intl.NumberFormat("en-US");
let latestCopyText = "";

function parseEp(value, label) {
  const cleaned = String(value ?? "")
    .replaceAll(",", "")
    .replaceAll("_", "")
    .replaceAll(" ", "")
    .trim();

  if (!/^\d+$/.test(cleaned)) {
    throw new Error(`${label} must be a whole non-negative number.`);
  }

  const parsed = Number(cleaned);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${label} is too large.`);
  }

  return parsed;
}

function format(value) {
  return integerFormat.format(value);
}

function setBusy(busy) {
  calculateButton.disabled = busy;
  calculateButton.textContent = busy
    ? "Calculating…"
    : "Calculate exact route";
}

function renderError(message) {
  latestCopyText = "";
  results.hidden = false;
  resultBody.innerHTML = `
    <div class="notice notice-error">
      <strong>Couldn’t calculate that route.</strong>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
  copyRouteButton.hidden = true;
}

function renderResult(input, result) {
  results.hidden = false;
  copyRouteButton.hidden = result.status !== "ok";

  const characterPercent = input.eventCharacters * 20;
  const eventMultiplier = 1 + input.eventCharacters * 0.2;
  const minigameMultiplier = input.bonusMinigame ? 1.5 : 1;
  const combinedMultiplier = eventMultiplier * minigameMultiplier;

  const setupHtml = `
    <div class="summary-grid">
      <div class="summary-item">
        <span>Current EP</span>
        <strong>${format(input.currentEp)}</strong>
      </div>
      <div class="summary-item">
        <span>Target EP</span>
        <strong>${format(input.targetEp)}</strong>
      </div>
      <div class="summary-item">
        <span>Event characters</span>
        <strong>${input.eventCharacters} (+${characterPercent}%)</strong>
      </div>
      <div class="summary-item">
        <span>Jump Rope bonus</span>
        <strong>${input.bonusMinigame ? "×1.5" : "Off"}</strong>
      </div>
      <div class="summary-item">
        <span>HoloPass</span>
        <strong>${input.holopass ? "×2" : "Off"}</strong>
      </div>
      <div class="summary-item">
        <span>Max jumps</span>
        <strong>${input.maxJumps}</strong>
      </div>
    </div>
  `;

  if (result.status === "past") {
    latestCopyText = "";
    resultBody.innerHTML = `
      ${setupHtml}
      <div class="notice notice-error">
        <strong>The target is already below your current EP.</strong>
        <p>You are ${format(Math.abs(result.gap))} EP past that target.</p>
      </div>
    `;
    return;
  }

  if (result.status === "already") {
    latestCopyText = "";
    resultBody.innerHTML = `
      ${setupHtml}
      <div class="notice notice-success">
        <strong>You are already parked exactly on the target.</strong>
        <p>No runs are needed.</p>
      </div>
    `;
    return;
  }

  if (result.status === "gcd") {
    latestCopyText = "";
    resultBody.innerHTML = `
      ${setupHtml}
      <div class="notice notice-warning">
        <strong>No exact jump-rope-only route exists with this setup.</strong>
        <p>
          The remaining gap is ${format(result.gap)} EP, while every available
          result is a multiple of ${format(result.gcd)}. Change your EP slightly
          with another activity, then calculate again.
        </p>
      </div>
    `;
    return;
  }

  if (result.status !== "ok") {
    latestCopyText = "";
    const minimum = result.minGain
      ? ` The smallest available jump-rope gain is ${format(result.minGain)} EP.`
      : "";

    resultBody.innerHTML = `
      ${setupHtml}
      <div class="notice notice-warning">
        <strong>No exact route was found under this jump limit.</strong>
        <p>Try getting closer to the target or raising Max Jumps.${minimum}</p>
      </div>
    `;
    return;
  }

  const grouped = compressPlan(result.plan);
  let running = input.currentEp;

  const routeRows = grouped.map(({ move, count }, index) => {
    const totalGain = move.gain * count;
    running += totalGain;

    return `
      <tr>
        <td><span class="step-badge">${index + 1}</span></td>
        <td><strong>${move.energy} EN</strong></td>
        <td><strong>${move.jumps}</strong></td>
        <td>${count > 1 ? `<strong>×${count}</strong>` : "×1"}</td>
        <td>+${format(totalGain)}</td>
        <td>${format(running)}</td>
      </tr>
    `;
  }).join("");

  const routeLines = grouped.map(({ move, count }, index) => (
    `Step ${index + 1}: ${move.energy} EN · stop at ${move.jumps} jumps` +
    `${count > 1 ? ` · repeat ${count}×` : ""}` +
    ` → +${format(move.gain * count)} EP`
  ));

  latestCopyText = [
    `Holodori Parking Route`,
    `Current EP: ${format(input.currentEp)}`,
    `Target EP: ${format(input.targetEp)}`,
    `Event characters: ${input.eventCharacters} (+${characterPercent}%)`,
    `Jump Rope bonus: ${input.bonusMinigame ? "Yes (×1.5)" : "No"}`,
    `HoloPass: ${input.holopass ? "Yes (×2)" : "No"}`,
    `Max jumps: ${input.maxJumps}`,
    "",
    ...routeLines,
    "",
    `Runs: ${result.runs}`,
    `Energy used: ${result.totalEnergy}`,
    `EP gained: +${format(result.gap)}`,
    `Final EP: ${format(input.targetEp)}`,
  ].join("\n");

  resultBody.innerHTML = `
    ${setupHtml}

    <div class="result-heading">
      <div>
        <p class="eyebrow">Exact route found</p>
        <h3>Follow these steps from top to bottom</h3>
      </div>
      <div class="target-pill">+${format(result.gap)} EP</div>
    </div>

    <div class="table-wrap">
      <table class="route-table">
        <thead>
          <tr>
            <th>Step</th>
            <th>Energy</th>
            <th>Stop at</th>
            <th>Repeat</th>
            <th>EP gained</th>
            <th>EP after step</th>
          </tr>
        </thead>
        <tbody>${routeRows}</tbody>
      </table>
    </div>

    <div class="totals">
      <div><span>Runs</span><strong>${format(result.runs)}</strong></div>
      <div><span>Energy used</span><strong>${format(result.totalEnergy)}</strong></div>
      <div><span>EP gained</span><strong>+${format(result.gap)}</strong></div>
      <div><span>Final EP</span><strong>${format(input.targetEp)} ✓</strong></div>
    </div>

    <details class="math-details">
      <summary>Show calculation details</summary>
      <div class="math-content">
        <code>Base = ROUNDUP(45 + 1.3 × Jumps)</code>
        <code>
          EP = ROUNDUP(Base × Event Character Multiplier × Jump Rope Multiplier)
          × HoloPass × Energy Multiplier
        </code>
        <p>
          Event-character multiplier: ×${eventMultiplier.toFixed(2)}.
          Jump Rope multiplier: ×${minigameMultiplier.toFixed(2)}.
          Combined before HoloPass: ×${combinedMultiplier.toFixed(2)}.
        </p>
      </div>
    </details>
  `;
}

function collectInput() {
  return {
    currentEp: parseEp(currentEp.value, "Current EP"),
    targetEp: parseEp(targetEp.value, "Target EP"),
    eventCharacters: Number(eventCharacters.value),
    holopass: holopass.checked,
    bonusMinigame: bonusMinigame.checked,
    maxJumps: Number(maxJumps.value),
  };
}

function writeQuery(input) {
  const params = new URLSearchParams();
  params.set("current", input.currentEp);
  params.set("target", input.targetEp);
  params.set("chars", input.eventCharacters);
  params.set("pass", input.holopass ? "1" : "0");
  params.set("bonus", input.bonusMinigame ? "1" : "0");
  params.set("jumps", input.maxJumps);

  const nextUrl = `${location.pathname}?${params.toString()}`;
  history.replaceState(null, "", nextUrl);
}

function readQuery() {
  const params = new URLSearchParams(location.search);
  if (!params.has("current") || !params.has("target")) return;

  currentEp.value = params.get("current") ?? "";
  targetEp.value = params.get("target") ?? "";
  eventCharacters.value = params.get("chars") ?? "0";
  holopass.checked = params.get("pass") === "1";
  bonusMinigame.checked = params.get("bonus") === "1";
  maxJumps.value = params.get("jumps") ?? "100";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(true);

  try {
    const input = collectInput();

    // Yield once so the button state paints before the synchronous solver runs.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const result = calculateParkingPlan(input);
    writeQuery(input);
    renderResult(input, result);
    results.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  } catch (error) {
    renderError(error instanceof Error ? error.message : String(error));
  } finally {
    setBusy(false);
  }
});

copyRouteButton.addEventListener("click", async () => {
  if (!latestCopyText) return;
  await navigator.clipboard.writeText(latestCopyText);
  flashButton(copyRouteButton, "Copied route ✓");
});

copyLinkButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(location.href);
  flashButton(copyLinkButton, "Copied link ✓");
});

loadExampleButton.addEventListener("click", () => {
  currentEp.value = "20071569";
  targetEp.value = "20260913";
  eventCharacters.value = "2";
  holopass.checked = true;
  bonusMinigame.checked = true;
  maxJumps.value = "100";
  form.requestSubmit();
});

function flashButton(button, text) {
  const original = button.textContent;
  button.textContent = text;
  button.disabled = true;

  window.setTimeout(() => {
    button.textContent = original;
    button.disabled = false;
  }, 1400);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildEnergyTable() {
  const container = document.querySelector("#energy-table");
  container.innerHTML = Object.entries(ENERGY_MULTIPLIERS)
    .map(([energy, multiplier]) => `
      <div>
        <span>${energy} EN</span>
        <strong>×${multiplier}</strong>
      </div>
    `)
    .join("");
}

function buildJumpExamples() {
  const container = document.querySelector("#jump-examples");
  container.innerHTML = [0, 1, 20, 69, 100]
    .map((jumps) => `
      <div>
        <span>${jumps} jumps</span>
        <strong>${baseJumpPt(jumps)} base</strong>
      </div>
    `)
    .join("");
}

buildEnergyTable();
buildJumpExamples();
readQuery();
