## Task Benchmarks (Cypress timings)

This directory documents how to run end‑to‑end benchmarks for Levante core tasks from the `levante-performance` repo. Benchmarks execute Cypress specs in `core-tasks/task-launcher` and write timing results locally in this repo for analysis.

### Layout

- `task-benchmarks/`
  - `run_all_and_record.js`: runs one or all Cypress specs and records timings
  - `backfill_times.js`: backfills display fields for existing records
  - `cypress/timing/`
    - `runs.json`: human‑readable JSON array of all runs
    - `runs.ndjson`: line‑delimited JSON (append‑only), resilient to partial runs

### Prerequisites

- `levante-performance` and `core-tasks` are siblings:
  - `/home/djc/levante/levante-performance`
  - `/home/djc/levante/core-tasks`
- `core-tasks/task-launcher` dev server reachable at `http://localhost:8080` (we’ll start it separately or keep it running)
- `core-tasks/task-launcher` has dependencies installed (`npm install` run previously)

### Environment variables

- `PROJECT_ROOT` (recommended): absolute path to `core-tasks/task-launcher`
  - Example: `/home/djc/levante/core-tasks/task-launcher`
- `PROVIDER` (optional): annotate network/provider for the run (e.g., `Starlink`, `Comcast`)

### NPM scripts

From `levante-performance/task-benchmarks`:

```bash
# Run all specs
PROVIDER=Starlink npm run timings:all

# Run a single spec (substring filter on spec path)
npm run timings:one -- theory_of_mind
# examples: vocab_test, matrix_reasoning, memory, etc.

# Backfill display fields on existing records
npm run timings:backfill
```

Notes:
- Scripts default `PROJECT_ROOT=../core-tasks/task-launcher`. If your layout differs, run with an absolute `PROJECT_ROOT`:
  ```bash
  PROVIDER=Starlink PROJECT_ROOT=/home/djc/levante/core-tasks/task-launcher npm run timings:all
  ```
- You do not need to install Cypress in `levante-performance`. The runner loads Cypress from `PROJECT_ROOT`.

### Direct node usage (advanced)

```bash
# All specs
PROVIDER=Starlink PROJECT_ROOT=/home/djc/levante/core-tasks/task-launcher node run_all_and_record.js

# Single spec filter
PROJECT_ROOT=/home/djc/levante/core-tasks/task-launcher node run_all_and_record.js vocab_test
```

### Output files

- `cypress/timing/runs.json`
  - Pretty JSON array. Each run is appended after it finishes.
- `cypress/timing/runs.ndjson`
  - Line‑delimited JSON; written immediately per run to minimize loss if a run crashes mid‑suite.

### Record schema (fields may expand over time)

```json
{
  "task": "theory-of-mind",
  "spec": "cypress/e2e/theory_of_mind.cy.js",
  "provider": "Starlink",
  "timestamp": "2025-10-24T04:46:22Z",
  "finishedAt": "2025-10-24T04:58:42Z",
  "startPT": "21:46 PT",
  "finishPT": "21:58 PT",
  "status": "passed|failed|error",
  "real": "12m19.976s",
  "realSeconds": 739.976,
  "cypressDurationMs": 721000,
  "totals": { "tests": 1, "passes": 1, "failures": 0, "pending": 0, "skipped": 0 },
  "error": "(optional short message on error)"
}
```

### Running with the dev server

Ensure the app is served on 8080:

```bash
cd /home/djc/levante/core-tasks/task-launcher
npx webpack serve --mode development --env dbmode=development --port 8080
# keep this running in a terminal; run timings from another terminal
```

### Troubleshooting

- If you see auth/network errors, confirm you’re running against real Firebase (no emulators) or adjust app test settings.
- If Cypress complains about missing system libraries on Linux/WSL2, ensure the GTK/libnss deps are installed.
- Use absolute `PROJECT_ROOT` if the runner cannot auto‑locate `task-launcher`.


