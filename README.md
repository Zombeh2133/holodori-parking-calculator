# Holodori Parking Calculator

A standalone, static web version of the Holodori Discord bot's Event PT
Jump Rope parking calculator.

## What it does

Users enter:

- Current Event PT
- Target / parking Event PT
- Number of event characters (0–5, +20% each)
- Whether HoloPass is active
- Whether Jump Rope is the featured +50% event minigame
- Maximum jumps per run

The calculator returns an exact route when one exists, including energy,
jump count, repetitions, total energy, total runs, EP gained, and running EP.

## Reward formula

```text
Base = ROUNDUP(45 + 1.3 × Jumps)

EP =
ROUNDUP(
  Base
  × Event Character Multiplier
  × Jump Rope Multiplier
)
× HoloPass
× Energy Multiplier
```

- Event character multiplier: +20% per event character
- Featured Jump Rope multiplier: ×1.5
- HoloPass: ×2
- Energy multipliers:
  - 0 EN → ×1
  - 15 EN → ×6
  - 30 EN → ×12
  - 45 EN → ×17
  - 60 EN → ×22
  - 75 EN → ×26
  - 90 EN → ×30

The featured Jump Rope multiplier is separate from the event-character
multiplier. An observed setup with 0 jumps, two event characters (+40%),
featured Jump Rope, HoloPass, and 0 EN produces 190 EP:

```text
45 × 1.4 × 1.5 = 94.5
ROUNDUP = 95
95 × 2 = 190
```

## Run locally

No install is required for normal use. Serve the directory with any static
HTTP server.

For example:

```powershell
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Tests

Node.js 18+ is enough; there are no npm dependencies.

```powershell
npm test
```

## Deploy on GitHub Pages

1. Create a new repository, for example `holodori-parking-calculator`.
2. Put the files from this folder in the repository root.
3. Push to GitHub.
4. Open **Settings → Pages**.
5. Under **Build and deployment**, select **Deploy from a branch**.
6. Select your main branch and `/ (root)`.
7. Save.

Because the calculator is fully static, there is no database, API key,
Railway service, or server process to maintain.

## Credit

Jump-rope parking data and formula research by
[mouisaac](https://home.gamer.com.tw/mouisaac).

Original Bahamut Gamer guide:
https://forum.gamer.com.tw/C.php?bsn=84454&snA=600

This project is an unofficial community calculator and is not affiliated with
COVER Corp., hololive production, or QualiArts.
