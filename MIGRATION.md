# Worksheet Platform — Multi-Module Migration

This patch converts the repo from "Module 01's worksheet" to **"the worksheet platform that contains Module 01, Module 02, and future modules."** Total time: ~5 minutes.

---

## What changes

| Path | Status | Notes |
|---|---|---|
| `src/main.jsx` | **edited** (2 lines) | Import `Router` instead of `App`. |
| `src/App.jsx` | **moved** | Becomes `src/modules/Module01.jsx`. Preserved via `git mv` so history follows. |
| `src/modules/Module01.jsx` | **new** | The contents of your old `src/App.jsx`, plus an `onHome` prop and a "← All worksheets" button in the sidebar. Otherwise byte-identical. |
| `src/modules/Module02.jsx` | **new** | The Parking Lot OOD worksheet. |
| `src/Router.jsx` | **new** | 55-line hash-based router. |
| `src/ModulePicker.jsx` | **new** | The landing page with the grid of available worksheets. |

### Routing

- `/` (no hash) → ModulePicker (the new landing page)
- `#/module/1` → Module 01 (WhatsApp Webhook Monster)
- `#/module/2` → Module 02 (Parking Lot OOD)

Hash-based routing means **no nginx changes, no `react-router-dom` dependency, no backend changes**. The existing SPA catch-all in `server.py` and the existing nginx config keep working unchanged.

### Backend

**No changes.** Module 02 reuses the exact same `/api/assess`, `/api/speak`, `/api/transcribe` endpoints that already serve Module 01. The `EXAMINER_PROMPT` in `server.py` is fully generic — it operates on whatever `model_answer` arrives in the request, so Module 02's 21 oral defenses assess correctly without any backend mods.

### Storage

Each module's progress is isolated:
- Module 01 → `localStorage["module01_checks"]`
- Module 02 → `localStorage["module02_checks"]`

A candidate doing Module 02 will not see Module 01 verdicts in their counter, and vice versa. **Your existing Module 01 progress data is preserved.** — the key name hasn't changed.

---

## Apply the migration

All commands run from the repo root: `~/PycharmProjects/twilio-refactoring-plan`.

The patch is assumed to be at `~/Downloads/worksheet-platform-patch/`.

### Step 1 — Checkpoint

```bash
cd ~/PycharmProjects/twilio-refactoring-plan
git status                  # must be clean
git add -A && git commit -m "checkpoint before multi-worksheet migration"
```

### Step 2 — Move Module 01 (preserves git history)

```bash
mkdir -p src/modules
git mv src/App.jsx src/modules/Module01.jsx
```

Verify with `git status` — it should report:
```
renamed:    src/App.jsx -> src/modules/Module01.jsx
```

If it reports `deleted:` + `new file:` instead, git did not detect the rename. Recover with `git reset HEAD` and try again.

### Step 3 — Drop in the new files

```bash
cp ~/Downloads/worksheet-platform-patch/src/Router.jsx           src/Router.jsx
cp ~/Downloads/worksheet-platform-patch/src/ModulePicker.jsx     src/ModulePicker.jsx
cp ~/Downloads/worksheet-platform-patch/src/modules/Module02.jsx src/modules/Module02.jsx
```

### Step 4 — Overwrite Module 01 with the `onHome`-wired version

```bash
cp ~/Downloads/worksheet-platform-patch/src/modules/Module01.jsx src/modules/Module01.jsx
```

This adds the `{ onHome }` prop and the "← All worksheets" button in the sidebar. Git will track this as a modification on top of the rename from step 2, so history is preserved.

If you want to skip the back button entirely, skip this step. Module 01 will work — users navigate back via the browser back button or by editing the URL hash.

### Step 5 — Edit `src/main.jsx`

Two lines change. Open `src/main.jsx` and:

**Replace:**
```jsx
import App from "./App.jsx";
```
**With:**
```jsx
import Router from "./Router.jsx";
```

**Replace:**
```jsx
<App />
```
**With:**
```jsx
<Router />
```

Everything else in `main.jsx` (the React/ReactDOM imports, the `createRoot` call, any CSS imports you may have added) stays as-is.

### Step 6 — Optional: copy migration notes into the repo

```bash
cp ~/Downloads/worksheet-platform-patch/MIGRATION.md ./MIGRATION.md
```

### Step 7 — Dev server smoke test

```bash
npm run dev
```

Open `http://localhost:5173/`.

### Step 8 — Commit

```bash
git status   # verify the staged renames + adds + edit look right
git add -A
git commit -m "feat: multi-worksheet platform with Module 02 (Parking Lot OOD)"
```

### Step 9 — Production build smoke test

```bash
npm run build
```

Expected: `~33 modules transformed`, bundle around 360KB (≈ 105KB gzipped), build time ~2-3s.

### Step 10 — Production deploy (when ready)

On the server:
```bash
git pull
npm run build
# then restart whatever runs Uvicorn — e.g. `sudo systemctl restart uvicorn-twilio`
```

No nginx changes. No `server.py` changes. No DNS changes.

---

## Verification checklist

After step 7 (dev server):

- [ ] `npm run dev` starts cleanly with no errors
- [ ] `http://localhost:5173/` shows the ModulePicker (two cards)
- [ ] Clicking Module 01 navigates to `#/module/1` and renders your existing worksheet
- [ ] Module 01's progress (any prior verdicts/checks) is intact — same `module01_checks` localStorage key
- [ ] Module 01's sidebar shows a new "← All worksheets" button above the "Reset progress" button
- [ ] Clicking Module 02 navigates to `#/module/2` and renders the parking lot worksheet
- [ ] Submitting an answer in Module 02 successfully calls `/api/assess` (check Network tab)
- [ ] The play button on an oral defence plays audio via `/api/speak`
- [ ] The "● REC" button captures audio and posts to `/api/transcribe`
- [ ] Browser back/forward navigates between the picker and worksheets
- [ ] Reload at `#/module/2` lands you back on Module 02

---

## Adding Module 03 later

When Module 03 is ready:

1. Drop `src/modules/Module03.jsx` into the modules directory
2. Add an import in `src/Router.jsx`:
   ```jsx
   import Module03 from "./modules/Module03.jsx";
   ```
3. Add a route case in `Router.jsx`:
   ```jsx
   if (route.id === 3) return <Module03 onHome={() => navigate("/")} />;
   ```
4. Add a card to the `MODULES` array in `src/ModulePicker.jsx`

The shared theme, the API client pattern, the localStorage convention all carry forward. When the module count gets unwieldy (~10+), the `MODULES` array moves to a `/api/modules` backend endpoint — a 15-minute change at that point, not before.

---

## Architecture notes (for future you)

**Why hash routing, not `react-router-dom`?** (1) Zero new dependencies. (2) No nginx config needed for client-side routes — hash routing never hits the server. (3) Trivially testable: `window.location.hash = "#/module/2"` and observe.

**Why no shared component library?** Module 01 is in production. The shared-library extraction is correct *eventually* but introduces regression risk now. Each module is self-contained, duplicating ~600 lines of utility components — a deliberate tradeoff: ~10% file size cost for 100% safety on Module 01. When 3+ modules ship and the duplication is genuinely painful, extract into `src/shared/components.jsx`.

**Why no `/api/modules` catalog endpoint?** With 2 modules, the catalog is one screen of code. With 10+ modules, it becomes data and belongs in a manifest. Adding the endpoint now is premature abstraction.

---

## Rollback

If anything goes wrong before you commit (step 8):

```bash
git reset --hard HEAD     # discards all uncommitted changes including the rename
# Then remove the new untracked files:
rm -rf src/Router.jsx src/ModulePicker.jsx src/modules/Module02.jsx
# If src/modules is now empty, remove it too:
rmdir src/modules 2>/dev/null
```

If you've already committed (step 8) and want to roll back:

```bash
git reset --hard HEAD~1   # discards the migration commit
```

No backend rollback needed. No database changes to revert. No infrastructure to redeploy. The migration is purely additive on the frontend.
