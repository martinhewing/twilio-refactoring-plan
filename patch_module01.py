#!/usr/bin/env python3
"""
Apply the two feature changes to Module01.jsx:
1. 10 partials before NOT_MET
2. TTS on follow-up questions

Usage:
    python3 patch_module01.py Module01.jsx
    # Creates Module01_patched.jsx
"""

import sys
import os

def patch(content):
    changes = 0

    # ── CHANGE 1: Add probeSpeaking state ──
    old = '  const [recording, setRecording] = useState(false);\n  const recRef'
    new = '  const [recording, setRecording] = useState(false);\n  const [probeSpeaking, setProbeSpeaking] = useState(false);\n  const recRef'
    if old in content:
        content = content.replace(old, new)
        changes += 1
        print("  ✓ Change 1: Added probeSpeaking state")
    else:
        print("  ✗ Change 1: Pattern not found")

    # ── CHANGE 2: Add partialCount variable ──
    old = '  const confirmed = verdict === "CONFIRMED";'
    new = '  const confirmed = verdict === "CONFIRMED";\n  const partialCount = checks["partial_count_" + id] || 0;'
    if old in content:
        content = content.replace(old, new)
        changes += 1
        print("  ✓ Change 2: Added partialCount variable")
    else:
        print("  ✗ Change 2: Pattern not found")

    # ── CHANGE 3: Replace defend function + add speakProbe ──
    old = '''  const defend = async (ans, q) => {
    if (!ans?.trim() || !modelAnswer) return;
    setAssessing(true);
    try {
      const r = await assessAnswer(q || question || placeholder || id, ans, modelAnswer);
      setChecks(p => ({ ...p, ["verdict_" + id]: r.verdict, ["feedback_" + id]: r.feedback || "", ["probe_" + id]: r.probe || "" }));
    } catch (e) {
      setChecks(p => ({ ...p, ["verdict_" + id]: "ERROR", ["feedback_" + id]: e.message }));
    }
    setAssessing(false);
  };'''

    new = '''  const defend = async (ans, q) => {
    if (!ans?.trim() || !modelAnswer) return;
    setAssessing(true);
    try {
      const r = await assessAnswer(q || question || placeholder || id, ans, modelAnswer);
      const partialKey = "partial_count_" + id;
      const currentCount = checks[partialKey] || 0;

      if (r.verdict === "NOT_MET" && currentCount < 10) {
        // Override NOT_MET to PARTIAL — give 10 partial attempts before failing
        setChecks(p => ({ ...p,
          ["verdict_" + id]: "PARTIAL",
          ["feedback_" + id]: r.feedback || "",
          ["probe_" + id]: r.probe || "",
          [partialKey]: currentCount + 1,
        }));
      } else if (r.verdict === "PARTIAL") {
        setChecks(p => ({ ...p,
          ["verdict_" + id]: r.verdict,
          ["feedback_" + id]: r.feedback || "",
          ["probe_" + id]: r.probe || "",
          [partialKey]: currentCount + 1,
        }));
      } else {
        setChecks(p => ({ ...p,
          ["verdict_" + id]: r.verdict,
          ["feedback_" + id]: r.feedback || "",
          ["probe_" + id]: r.probe || "",
        }));
      }
    } catch (e) {
      setChecks(p => ({ ...p, ["verdict_" + id]: "ERROR", ["feedback_" + id]: e.message }));
    }
    setAssessing(false);
  };

  const speakProbe = async () => {
    if (probeSpeaking) { setProbeSpeaking(false); return; }
    setProbeSpeaking(true);
    await speakText(probe);
    setProbeSpeaking(false);
  };'''

    if old in content:
        content = content.replace(old, new)
        changes += 1
        print("  ✓ Change 3: Replaced defend function + added speakProbe")
    else:
        print("  ✗ Change 3: defend function pattern not found")

    # ── CHANGE 4: Add attempt counter to verdict display ──
    old = '''          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: vc[verdict], fontWeight: 700, letterSpacing: "0.06em" }}>{verdict}</span>
          {confirmed && <span style={{ color: "#98c379", fontSize: 12, marginLeft: 6 }}>✓</span>}
          <div style={{ fontSize: 12.5, color: "#abb2bf", lineHeight: 1.6, marginTop: 4 }}>{feedback}</div>'''

    new = '''          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: vc[verdict], fontWeight: 700, letterSpacing: "0.06em" }}>{verdict}</span>
            {confirmed && <span style={{ color: "#98c379", fontSize: 12 }}>✓</span>}
            {verdict === "PARTIAL" && (
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#636d83", marginLeft: "auto" }}>
                attempt {partialCount}/10
              </span>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: "#abb2bf", lineHeight: 1.6, marginTop: 4 }}>{feedback}</div>'''

    if old in content:
        content = content.replace(old, new)
        changes += 1
        print("  ✓ Change 4: Added attempt counter to verdict display")
    else:
        print("  ✗ Change 4: Verdict display pattern not found")

    # ── CHANGE 5: Add TTS button to follow-up section ──
    old = '''          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#e5c07b", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 6 }}>FOLLOW-UP</div>
          <div style={{ fontSize: 13, color: "#d7dae0", lineHeight: 1.6, marginBottom: 8, fontStyle: "italic" }}>"{probe}"</div>'''

    new = '''          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#e5c07b", fontWeight: 700, letterSpacing: "0.06em" }}>FOLLOW-UP</span>
            <button onClick={speakProbe} style={{
              background: probeSpeaking ? "#e5c07b18" : "#21252b",
              border: "1px solid " + (probeSpeaking ? "#e5c07b" : "#3e4451"),
              borderRadius: 4, color: probeSpeaking ? "#e5c07b" : "#636d83",
              cursor: "pointer", fontSize: 10, padding: "3px 6px",
              fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600,
              whiteSpace: "nowrap", marginLeft: "auto",
            }}>{probeSpeaking ? "■" : "▶"}</button>
          </div>
          <div style={{ fontSize: 13, color: "#d7dae0", lineHeight: 1.6, marginBottom: 8, fontStyle: "italic" }}>"{probe}"</div>'''

    if old in content:
        content = content.replace(old, new)
        changes += 1
        print("  ✓ Change 5: Added TTS button to follow-up section")
    else:
        print("  ✗ Change 5: Follow-up section pattern not found")

    return content, changes


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 patch_module01.py <path_to_Module01.jsx>")
        sys.exit(1)

    input_path = sys.argv[1]
    if not os.path.exists(input_path):
        print(f"File not found: {input_path}")
        sys.exit(1)

    with open(input_path, "r") as f:
        content = f.read()

    print(f"Patching {input_path}...")
    patched, count = patch(content)

    output_path = input_path.replace(".jsx", "_patched.jsx")
    with open(output_path, "w") as f:
        f.write(patched)

    print(f"\n{count}/5 changes applied → {output_path}")
    if count < 5:
        print("⚠ Some patterns were not found. Check if the file has been modified from the original.")
