#!/usr/bin/env python3
"""
patch_module01_v2.py — Apply to the already-patched App.jsx

1. Adds ● REC button to FOLLOW-UP probe input
2. Adds ▶ TTS button to InterviewDialog (FAANG INTERVIEW boxes)

Usage:
    python3 patch_module01_v2.py src/App.jsx
    # Creates src/App_patched.jsx
"""

import sys, os

def patch(content):
    changes = 0

    # ══════════════════════════════════════════════════════════════
    # CHANGE 1: Add REC button to the FOLLOW-UP probe input area
    # ══════════════════════════════════════════════════════════════
    # We need to add voice recording state + handler for the probe,
    # plus a REC button next to the DEFEND button in the follow-up.

    # 1a: Add probeRecording state (next to probeSpeaking)
    old = '  const [probeSpeaking, setProbeSpeaking] = useState(false);\n  const recRef'
    new = '  const [probeSpeaking, setProbeSpeaking] = useState(false);\n  const [probeRecording, setProbeRecording] = useState(false);\n  const probeRecRef = useRef(null);\n  const recRef'
    if old in content:
        content = content.replace(old, new)
        changes += 1
        print("  ✓ 1a: Added probeRecording state")
    else:
        print("  ✗ 1a: probeRecording state pattern not found")

    # 1b: Add toggleProbeVoice function (after speakProbe)
    old = '''  const speakProbe = async () => {
    if (probeSpeaking) { setProbeSpeaking(false); return; }
    setProbeSpeaking(true);
    await speakText(probe);
    setProbeSpeaking(false);
  };'''

    new = '''  const speakProbe = async () => {
    if (probeSpeaking) { setProbeSpeaking(false); return; }
    setProbeSpeaking(true);
    await speakText(probe);
    setProbeSpeaking(false);
  };

  const toggleProbeVoice = async () => {
    if (probeRecording) {
      if (probeRecRef.current && probeRecRef.current.state !== "inactive") {
        probeRecRef.current.stop();
        probeRecRef.current.stream.getTracks().forEach(t => t.stop());
      }
      setProbeRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const form = new FormData();
        form.append("audio", blob, "answer.webm");
        try {
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          if (res.ok) {
            const data = await res.json();
            if (data.transcript) setChecks(p => ({ ...p, ["answer_probe_" + id]: (p["answer_probe_" + id] || "") + (p["answer_probe_" + id] ? " " : "") + data.transcript }));
          }
        } catch (e) { /* transcription failed silently */ }
      };
      mr.start();
      probeRecRef.current = mr;
      setProbeRecording(true);
    } catch (e) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        rec.continuous = true; rec.interimResults = false; rec.lang = "en-GB";
        rec.onresult = (ev) => {
          let t = "";
          for (let i = 0; i < ev.results.length; i++) if (ev.results[i].isFinal) t += ev.results[i][0].transcript + " ";
          if (t.trim()) setChecks(p => ({ ...p, ["answer_probe_" + id]: (p["answer_probe_" + id] || "") + (p["answer_probe_" + id] ? " " : "") + t.trim() }));
        };
        rec.onerror = () => setProbeRecording(false);
        rec.onend = () => setProbeRecording(false);
        rec.start(); probeRecRef.current = rec; setProbeRecording(true);
      }
    }
  };'''

    if old in content:
        content = content.replace(old, new)
        changes += 1
        print("  ✓ 1b: Added toggleProbeVoice function")
    else:
        print("  ✗ 1b: speakProbe pattern not found")

    # 1c: Add REC button next to the follow-up DEFEND button
    old = '''          <div style={{ display: "flex", gap: 6 }}>
            <input value={probeVal} onChange={(e) => setChecks(p => ({ ...p, ["answer_probe_" + id]: e.target.value }))} placeholder="Answer the follow-up..." style={{ ...sty, minHeight: undefined, flex: 1 }} />
            <button onClick={() => defend(probeVal, probe)} disabled={assessing || !probeVal.trim()} style={{
              background: "#e5c07b18", border: "1px solid #e5c07b44", borderRadius: 4, color: "#e5c07b",
              cursor: "pointer", fontSize: 10, padding: "6px 8px", fontFamily: "'IBM Plex Mono', monospace",
              fontWeight: 700, opacity: !probeVal.trim() ? 0.4 : 1, whiteSpace: "nowrap",
            }}>{assessing ? "..." : "DEFEND"}</button>
          </div>'''

    new = '''          <div style={{ display: "flex", gap: 6 }}>
            <input value={probeVal} onChange={(e) => setChecks(p => ({ ...p, ["answer_probe_" + id]: e.target.value }))} placeholder="Answer the follow-up..." style={{ ...sty, minHeight: undefined, flex: 1 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {hasSR && (
                <button onClick={toggleProbeVoice} style={{
                  background: probeRecording ? "#e06c7522" : "#21252b", border: "1px solid " + (probeRecording ? "#e06c75" : "#3e4451"),
                  borderRadius: 4, color: probeRecording ? "#e06c75" : "#636d83", cursor: "pointer", fontSize: 10, padding: "6px 8px",
                  fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, whiteSpace: "nowrap",
                }}>{probeRecording ? "■ STOP" : "● REC"}</button>
              )}
              <button onClick={() => defend(probeVal, probe)} disabled={assessing || !probeVal.trim()} style={{
                background: "#e5c07b18", border: "1px solid #e5c07b44", borderRadius: 4, color: "#e5c07b",
                cursor: "pointer", fontSize: 10, padding: "6px 8px", fontFamily: "'IBM Plex Mono', monospace",
                fontWeight: 700, opacity: !probeVal.trim() ? 0.4 : 1, whiteSpace: "nowrap",
              }}>{assessing ? "..." : "DEFEND"}</button>
            </div>
          </div>'''

    if old in content:
        content = content.replace(old, new)
        changes += 1
        print("  ✓ 1c: Added REC button to follow-up input")
    else:
        print("  ✗ 1c: Follow-up input pattern not found")

    # ══════════════════════════════════════════════════════════════
    # CHANGE 2: Add ▶ TTS button to InterviewDialog
    # ══════════════════════════════════════════════════════════════

    old = '''function InterviewDialog({ question, hint, context }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #e06c7508, #c678dd08)",
      border: "1px solid #e06c7533", borderRadius: 8, padding: "16px 18px",
      margin: "14px 0",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
      }}>
        <span style={{
          background: "#e06c7522", color: "#e06c75", padding: "2px 8px",
          borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
        }}>FAANG INTERVIEW</span>
      </div>
      <p style={{
        color: "#d7dae0", fontSize: 14, lineHeight: 1.6, margin: 0,
        fontWeight: 500, fontStyle: "italic",
      }}>"{question}"</p>'''

    new = '''function InterviewDialog({ question, hint, context }) {
  const [speaking, setSpeaking] = useState(false);
  const speak = async () => {
    if (speaking) { setSpeaking(false); return; }
    setSpeaking(true);
    await speakText(question);
    setSpeaking(false);
  };
  return (
    <div style={{
      background: "linear-gradient(135deg, #e06c7508, #c678dd08)",
      border: "1px solid #e06c7533", borderRadius: 8, padding: "16px 18px",
      margin: "14px 0",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
      }}>
        <span style={{
          background: "#e06c7522", color: "#e06c75", padding: "2px 8px",
          borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
        }}>FAANG INTERVIEW</span>
        <button onClick={speak} style={{
          background: speaking ? "#e06c7518" : "#21252b",
          border: "1px solid " + (speaking ? "#e06c75" : "#3e4451"),
          borderRadius: 4, color: speaking ? "#e06c75" : "#636d83",
          cursor: "pointer", fontSize: 10, padding: "3px 6px",
          fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600,
          whiteSpace: "nowrap", marginLeft: "auto",
        }}>{speaking ? "■" : "▶"}</button>
      </div>
      <p style={{
        color: "#d7dae0", fontSize: 14, lineHeight: 1.6, margin: 0,
        fontWeight: 500, fontStyle: "italic",
      }}>"{question}"</p>'''

    if old in content:
        content = content.replace(old, new)
        changes += 1
        print("  ✓ 2: Added TTS button to InterviewDialog")
    else:
        print("  ✗ 2: InterviewDialog pattern not found")

    return content, changes


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 patch_module01_v2.py <path_to_App.jsx>")
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

    print(f"\n{count}/4 changes applied → {output_path}")
    if count < 4:
        print("⚠ Some patterns were not found. Check if the file matches the expected version.")
