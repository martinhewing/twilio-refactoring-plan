# twilio-refactoring-plan

Twilio monolith refactoring plan — ConnectionSphere Ltd

**Live:** https://twilio-refactoring-plan.connectaiml.com

---

## What it is

An interactive progress tracker for the two prerequisite gates that must be completed before the Twilio monolith refactor begins. Every item is a granular, tickable sub-task. Progress persists in the browser via localStorage.

**Module 00 — Environment & Vocabulary**
Get the full stack running locally (Redis, FastAPI, ngrok, Twilio sandbox, PyCharm debugger) and establish the classification vocabulary (CAT, PAT, PRT, SOLID, CONC labels) before observing the live system. The debugger must halt on a breakpoint and curl must return 200 before proceeding.

**Module 01 — Discovery, Debugging & Characterization Tests**
Classify every violation in the monolith using guide taxonomy, observe each bug live in the PyCharm debugger, and write a characterization test suite that pins current behaviour before any refactoring begins. The sequence is fixed: Understand → Observe → Test.

---

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

---

## Deploy

Pushes to `main` trigger the GitHub Actions workflow which builds and deploys to GitHub Pages automatically.

```bash
git add src/App.jsx
git commit -m "your change"
git push origin main
```

---

## Updating the plan

All task data lives in the `MODULES` array at the top of `src/App.jsx`. Each module has sections, each section has tasks, each task has subtasks. Add, remove, or reorder subtasks there — the UI and progress tracking update automatically.

```js
{
  id: "00-A-1",
  label: "Clone the repository",
  subtasks: [
    { id: "00-A-1a", label: "git clone git@github.com:martinhewing/twilio.git" },
    { id: "00-A-1b", label: "..." },
  ],
}
```

Storage key is `twilio-module-plan-00-01-v1` — bump the version suffix if the task structure changes significantly to avoid stale state conflicts.
