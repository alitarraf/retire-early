---
name: verify
description: Drive the running app headlessly to verify UI changes — dev-server + puppeteer-core recipe for this repo.
---

# Verifying retire-early UI changes headlessly

**Launch:** `npm run dev` (background, port 5173; poll `curl localhost:5173` until 200).
WSL2 note: after source edits Vite polling picks changes up, but if the page looks
stale, restart the server and hard-reload.

**Browser:** no system Chrome. `npm i puppeteer-core` in the scratchpad and use the
cached binary at `~/.cache/puppeteer/chrome/linux-<latest>/chrome-linux64/chrome`.
Flags: `--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage`;
`waitUntil: "domcontentloaded"` (never networkidle0 — the app is fine but SSE-style
chat keeps sockets open); wait ~2.5s after goto for the engine's first render.

**localStorage keys** (seed via `page.evaluateOnNewDocument`):
- `retire-early.quickStartDismissed = "1"` — suppress the onboarding overlay.
- `retire-early.inputs = JSON.stringify({ data, updatedAt })` — **NOT merged with
  DEFAULTS**: a partial `data` object gives NaN/undefined all over the sidebar.
  Prefer driving the real UI (click profile rows, sidebar fields) over seeding.

**Driving the onboarding wizard:**
- Fresh localStorage → overlay opens on an intro step ("Build my plan →") that has
  NO "Step N of N" marker — don't key detection on it.
- The sidebar behind the modal has duplicate button labels ("Still working"), so
  always click the LAST matching button in DOM order (overlay renders last).
- Step 1's Continue is disabled until a life-stage card is clicked.
- Loop: click last-match of /Build my plan|Continue|See my/ until the target step
  text appears (the Allocate step is "How should your money be invested?").

**Element shots:** find the card by its title text (e.g. "Portfolio over time"),
then walk `parentElement` up until the node contains the chart `svg` — the direct
`closest("div")` grabs only the header row. `scrollIntoView()` before screenshot;
viewport shots miss below-the-fold cards.

**Chart hover:** move the mouse over the card's bounding box (full-height
transparent hit rects per column); legend items are `<svg><g><text>` — dispatch a
bubbling click on the text's parentElement.
