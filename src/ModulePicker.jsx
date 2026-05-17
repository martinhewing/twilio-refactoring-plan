import { useState, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════
// ModulePicker.jsx — Landing page with the grid of available worksheets.
//
// Reads progress from each module's localStorage key — no backend needed.
// Each card links to #/module/<n> via the parent's onSelect callback.
// ═══════════════════════════════════════════════════════════════════

const T = {
  paper: "#FAF9F6", surface_1: "#F5F2EC", surface_2: "#EBE6DB",
  border_soft: "#E8E4DB", border_med: "#D9D4C7",
  ink_1: "#2B2826", ink_2: "#5A5550", ink_3: "#7A7368", ink_ghost: "#C0BAB0",
  acc_fill: "#F5E8DF", acc_border: "#C96E4A", acc_ink: "#8A3D1F",
  sage: "#7A8E6B", sage_fill: "#ECEFE7",
};

const FONT_SERIF = "'Iowan Old Style', 'Palatino', 'Georgia', serif";
const FONT_SANS  = "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif";
const FONT_MONO  = "'Menlo', 'Consolas', 'Courier New', monospace";

// ─── MODULE CATALOG ─────────────────────────────────────────────────
// Hardcoded list. When the worksheet count grows past ~10, this moves
// to a `/api/modules` backend endpoint. For now: data is code.

const MODULES = [
  {
    id: 1,
    title: "WhatsApp Webhook Monster",
    subtitle: "Discovery, debugging & characterization testing",
    description: "A live production codebase with multiple architectural pathologies. Learn to classify CAT-x categories, identify SOLID violations, and characterize behaviour through the debugger before refactoring.",
    estimated_minutes: 150,
    difficulty: "Intermediate",
    storage_key: "module01_checks",
    total_checkpoints: 42,
    available: true,
    tags: ["FastAPI", "Redis", "asyncio", "characterization tests"],
  },
  {
    id: 2,
    title: "Parking Lot OOD",
    subtitle: "Outside-In TDD & system design defense",
    description: "Classic MAANG-style OOD interview problem. Build a parking lot from first principles using Outside-In TDD. Defend every design choice — taxonomy, Protocol vs ABC, composition over inheritance — under live interview pressure.",
    estimated_minutes: 45,
    difficulty: "Intermediate",
    storage_key: "module02_checks",
    total_checkpoints: 21,
    available: true,
    tags: ["Python", "OOD", "TDD", "Protocols", "interview defense"],
  },
];

// ─── PROGRESS CALCULATOR ────────────────────────────────────────────
// Reads localStorage for each module's stored checks. Counts CONFIRMED
// verdicts (the meaningful unit of progress) plus any explicit checkbox
// completions. Falls back to 0 silently if the storage key is missing.

function getProgress(storageKey, totalCheckpoints) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { done: 0, total: totalCheckpoints };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { done: 0, total: totalCheckpoints };

    // Count CONFIRMED verdicts (one per oral defense / examine question)
    const confirmed = Object.keys(parsed).filter(
      (k) => k.startsWith("verdict_") && parsed[k] === "CONFIRMED"
    ).length;

    // Count explicit boolean checkboxes (setup steps, completion markers)
    const checkboxes = Object.keys(parsed).filter(
      (k) =>
        !k.startsWith("answer_") &&
        !k.startsWith("verdict_") &&
        !k.startsWith("feedback_") &&
        !k.startsWith("probe_") &&
        !k.startsWith("partial_count_") &&
        parsed[k] === true
    ).length;

    return { done: confirmed + checkboxes, total: totalCheckpoints };
  } catch {
    return { done: 0, total: totalCheckpoints };
  }
}

// ─── PROGRESS RING ──────────────────────────────────────────────────

function ProgressRing({ total, done, size = 44 }) {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const center = size / 2;
  const color = pct >= 100 ? T.sage : T.acc_border;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={r} fill="none" stroke={T.border_soft} strokeWidth="3" />
        <circle
          cx={center} cy={center} r={r}
          fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100}
          strokeLinecap="round" transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: "stroke-dashoffset 0.5s" }}
        />
      </svg>
      <div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: pct >= 100 ? T.sage : T.ink_2, fontWeight: 700 }}>
          {done}/{total}
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: T.ink_3, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 2 }}>
          {pct >= 100 ? "complete" : "in progress"}
        </div>
      </div>
    </div>
  );
}

// ─── MODULE CARD ────────────────────────────────────────────────────

function ModuleCard({ module: m, onSelect }) {
  const [hover, setHover] = useState(false);
  const progress = getProgress(m.storage_key, m.total_checkpoints);
  const started = progress.done > 0;

  return (
    <button
      onClick={() => m.available && onSelect(m.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={!m.available}
      style={{
        background: T.paper,
        border: `1px solid ${hover && m.available ? T.acc_border : T.border_soft}`,
        borderRadius: 8,
        padding: "26px 28px 24px",
        textAlign: "left",
        cursor: m.available ? "pointer" : "not-allowed",
        opacity: m.available ? 1 : 0.55,
        transition: "border-color 0.15s, transform 0.15s, box-shadow 0.15s",
        transform: hover && m.available ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hover && m.available ? `0 4px 12px rgba(43,40,38,0.06)` : `0 1px 0 ${T.border_soft}`,
        fontFamily: FONT_SANS,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        minHeight: 320,
      }}
    >
      {/* Header: number + title + progress */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{
          fontFamily: FONT_SERIF,
          fontSize: 44,
          fontWeight: 700,
          color: started ? T.acc_border : T.ink_ghost,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          opacity: started ? 0.85 : 0.45,
          minWidth: 56,
        }}>
          {String(m.id).padStart(2, "0")}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: FONT_MONO, fontSize: 9.5, color: T.ink_3,
            fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
            marginBottom: 4,
          }}>
            Module {String(m.id).padStart(2, "0")} · {m.difficulty}
          </div>
          <h2 style={{
            fontFamily: FONT_SERIF, fontSize: 22, fontWeight: 700,
            color: T.ink_1, margin: 0, letterSpacing: "-0.015em", lineHeight: 1.2,
          }}>
            {m.title}
          </h2>
          <div style={{
            fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 13,
            color: T.ink_3, marginTop: 4, letterSpacing: "0.01em",
          }}>
            {m.subtitle}
          </div>
        </div>
      </div>

      {/* Description */}
      <p style={{
        fontFamily: FONT_SERIF, fontSize: 14, color: T.ink_2,
        lineHeight: 1.6, margin: 0, flex: 1,
      }}>
        {m.description}
      </p>

      {/* Tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {m.tags.map((tag) => (
          <span key={tag} style={{
            fontFamily: FONT_MONO, fontSize: 9.5, color: T.ink_3,
            background: T.surface_1, padding: "2px 8px", borderRadius: 2,
            border: `1px solid ${T.border_soft}`, letterSpacing: "0.02em",
          }}>
            {tag}
          </span>
        ))}
      </div>

      {/* Footer: progress + time */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, paddingTop: 14, borderTop: `1px solid ${T.border_soft}`,
      }}>
        <ProgressRing total={progress.total} done={progress.done} />
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.ink_2, fontWeight: 700, letterSpacing: "0.04em" }}>
            ~{m.estimated_minutes} min
          </div>
          <div style={{
            fontFamily: FONT_MONO, fontSize: 9.5, color: hover && m.available ? T.acc_ink : T.ink_3,
            letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 3, fontWeight: 600,
          }}>
            {!m.available ? "Coming soon" : started ? "Continue →" : "Start →"}
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── MAIN PICKER ────────────────────────────────────────────────────

export default function ModulePicker({ onSelect }) {
  // Force re-render on mount so progress is fresh if user navigated back
  const [, setTick] = useState(0);
  useEffect(() => {
    setTick((t) => t + 1);
  }, []);

  // Aggregate progress across all available modules
  const aggregate = MODULES.filter((m) => m.available).reduce(
    (acc, m) => {
      const p = getProgress(m.storage_key, m.total_checkpoints);
      return { done: acc.done + p.done, total: acc.total + p.total };
    },
    { done: 0, total: 0 }
  );

  return (
    <div style={{
      minHeight: "100vh", background: T.paper,
      fontFamily: FONT_SANS, color: T.ink_2,
      padding: "60px 40px 80px",
    }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            fontFamily: FONT_MONO, fontSize: 10.5, color: T.acc_ink,
            fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
            marginBottom: 8,
          }}>
            Refactoring Factory
          </div>
          <h1 style={{
            fontFamily: FONT_SERIF, fontSize: 44, fontWeight: 700,
            color: T.ink_1, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1,
          }}>
            Interview Prep Worksheets
          </h1>
          <p style={{
            fontFamily: FONT_SERIF, fontSize: 16, fontStyle: "italic",
            color: T.ink_3, marginTop: 10, marginBottom: 0, maxWidth: 640, lineHeight: 1.55,
          }}>
            A sequence of structured, debugger-driven worksheets that train the discipline
            of <strong style={{ color: T.ink_1, fontStyle: "normal" }}>defending every classification</strong> —
            from CAT-x category to SOLID label to test template — under live interview pressure.
          </p>
        </div>

        {/* Aggregate strip */}
        {aggregate.done > 0 && (
          <div style={{
            background: T.surface_1, border: `1px solid ${T.border_soft}`,
            borderLeft: `3px solid ${T.acc_border}`, borderRadius: "0 6px 6px 0",
            padding: "14px 20px", marginBottom: 32,
            display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
          }}>
            <div style={{
              fontFamily: FONT_MONO, fontSize: 9.5, color: T.acc_ink,
              fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
            }}>
              Overall progress
            </div>
            <div style={{
              fontFamily: FONT_MONO, fontSize: 13, color: T.ink_1, fontWeight: 700,
            }}>
              {aggregate.done} / {aggregate.total} checkpoints across {MODULES.filter((m) => m.available).length} modules
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 13, color: T.ink_3 }}>
              Progress is saved per-module in your browser. Resume anytime.
            </div>
          </div>
        )}

        {/* Section label */}
        <div style={{
          fontFamily: FONT_MONO, fontSize: 10, color: T.ink_3,
          fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
          marginBottom: 16, borderBottom: `1px solid ${T.border_soft}`, paddingBottom: 8,
        }}>
          Available worksheets
        </div>

        {/* Grid of cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
          gap: 20,
        }}>
          {MODULES.map((m) => (
            <ModuleCard key={m.id} module={m} onSelect={onSelect} />
          ))}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 56, paddingTop: 24, borderTop: `1px solid ${T.border_soft}`,
          fontFamily: FONT_MONO, fontSize: 10.5, color: T.ink_3,
          letterSpacing: "0.04em", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
        }}>
          <span>Voice examiner: Cartesia Sonic · Assessor: Claude Sonnet 4</span>
          <span style={{ fontStyle: "italic", fontFamily: FONT_SERIF }}>
            Each worksheet is a closed unit — start in any order.
          </span>
        </div>
      </div>
    </div>
  );
}
