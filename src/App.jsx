// ═══════════════════════════════════════════════════════════════════
// PATCHED AnswerField — drop-in replacement
//
// Fixes:
// 1. Probe DEFEND now properly tracks probe attempts separately
// 2. Old probe answer cleared when a NEW probe question arrives
// 3. Probe question never silently wiped (section stays visible)
// 4. Probe attempt counter shown so user sees progress
// ═══════════════════════════════════════════════════════════════════

function AnswerField({ id, placeholder, checks, setChecks, multiline = false, question = "", modelAnswer: modelAnswerProp }) {
  const val = checks["answer_" + id] || "";
  const set = (v) => setChecks(p => ({ ...p, ["answer_" + id]: v }));
  const [showModel, setShowModel] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [probeSpeaking, setProbeSpeaking] = useState(false);
  const [probeRecording, setProbeRecording] = useState(false);
  const probeRecRef = useRef(null);
  const recRef = useRef(null);
  const modelAnswer = modelAnswerProp || M[id];
  const verdict = checks["verdict_" + id];
  const feedback = checks["feedback_" + id] || "";
  const probe = checks["probe_" + id] || "";
  const probeVal = checks["answer_probe_" + id] || "";
  const confirmed = verdict === "CONFIRMED";
  const partialCount = checks["partial_count_" + id] || 0;
  const probeAttemptCount = checks["probe_attempt_" + id] || 0;  // ← NEW: separate probe counter

  const sty = {
    width: "100%", background: confirmed ? "#98c37908" : "#1a1d23",
    border: "1px solid " + (confirmed ? "#98c37944" : "#2d313a"),
    borderRadius: 6, color: "#abb2bf", fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12.5, padding: "10px 12px", resize: "vertical", outline: "none",
    boxSizing: "border-box", minHeight: multiline ? 100 : undefined,
  };

  const hasSR = typeof window !== "undefined" && navigator.mediaDevices;
  const toggleVoice = async () => {
    if (recording) {
      // Stop recording and transcribe
      if (recRef.current && recRef.current.state !== "inactive") {
        recRef.current.stop();
        recRef.current.stream.getTracks().forEach(t => t.stop());
      }
      setRecording(false);
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
            if (data.transcript) set(val ? val + " " + data.transcript : data.transcript);
          }
        } catch (e) { /* transcription failed silently */ }
      };
      mr.start();
      recRef.current = mr;
      setRecording(true);
    } catch (e) {
      // Mic access denied — fall back to Web Speech API if available
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        rec.continuous = true; rec.interimResults = false; rec.lang = "en-GB";
        rec.onresult = (e) => {
          let t = "";
          for (let i = 0; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript + " ";
          if (t.trim()) set(val ? val + " " + t.trim() : t.trim());
        };
        rec.onerror = () => setRecording(false);
        rec.onend = () => setRecording(false);
        rec.start(); recRef.current = rec; setRecording(true);
      }
    }
  };

  const defend = async (ans, q, isProbe = false) => {
    if (!ans?.trim() || !modelAnswer) return;
    setAssessing(true);
    try {
      const assessQuestion = q || question || placeholder || id;
      const assessReference = isProbe
        ? `The candidate was asked this follow-up probe after a PARTIAL on the original question.\n\nORIGINAL QUESTION:\n${question || placeholder || id}\n\nMODEL ANSWER:\n${modelAnswer}\n\nPROBE QUESTION:\n${q}\n\nJudge whether the candidate's probe answer demonstrates understanding of the concept in the model answer.`
        : modelAnswer;

      const r = await assessAnswer(assessQuestion, ans, assessReference);
      const partialKey = "partial_count_" + id;
      const currentCount = checks[partialKey] || 0;

      if (isProbe) {
        // ── PROBE DEFEND ──
        if (r.verdict === "CONFIRMED") {
          // Probe confirmed → promote the whole field to CONFIRMED
          setChecks(p => ({ ...p,
            ["verdict_" + id]: "CONFIRMED",
            ["feedback_" + id]: r.feedback || "",
          }));
        } else {
          // Probe not confirmed → show feedback, evolve probe if examiner gave a new one
          const probeKey = "probe_attempt_" + id;
          const currentProbeCount = checks[probeKey] || 0;
          const newProbe = r.probe || null;  // examiner may provide a new follow-up
          setChecks(p => ({
            ...p,
            ["probe_feedback_" + id]: r.feedback || "Try to be more specific about the underlying concept.",
            // If examiner gave a new probe, use it (evolving question); otherwise keep current
            ["probe_" + id]: newProbe || p["probe_" + id] || probe,
            [probeKey]: currentProbeCount + 1,
            // If probe evolved to a new question, clear old answer; otherwise keep it
            ...(newProbe ? { ["answer_probe_" + id]: "" } : {}),
          }));
        }
      } else {
        // ── MAIN DEFEND ──
        if (r.verdict === "NOT_MET" && currentCount < 10) {
          setChecks(p => ({ ...p,
            ["verdict_" + id]: "PARTIAL",
            ["feedback_" + id]: r.feedback || "",
            ["probe_" + id]: r.probe || "",
            ["probe_feedback_" + id]: "",
            ["answer_probe_" + id]: "",   // ← Clear old probe answer for new probe
            ["probe_attempt_" + id]: 0,   // ← Reset probe counter for new probe
            [partialKey]: currentCount + 1,
          }));
        } else if (r.verdict === "PARTIAL") {
          setChecks(p => ({ ...p,
            ["verdict_" + id]: r.verdict,
            ["feedback_" + id]: r.feedback || "",
            ["probe_" + id]: r.probe || "",
            ["probe_feedback_" + id]: "",
            ["answer_probe_" + id]: "",   // ← Clear old probe answer for new probe
            ["probe_attempt_" + id]: 0,   // ← Reset probe counter for new probe
            [partialKey]: currentCount + 1,
          }));
        } else {
          setChecks(p => ({ ...p,
            ["verdict_" + id]: r.verdict,
            ["feedback_" + id]: r.feedback || "",
            ["probe_" + id]: r.probe || "",
          }));
        }
      }
    } catch (e) {
      if (isProbe) {
        setChecks(p => ({ ...p, ["probe_feedback_" + id]: "Error: " + e.message }));
      } else {
        setChecks(p => ({ ...p, ["verdict_" + id]: "ERROR", ["feedback_" + id]: e.message }));
      }
    }
    setAssessing(false);
  };

  const speakProbe = async () => {
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
  };

  const vc = { CONFIRMED: "#98c379", PARTIAL: "#e5c07b", NOT_MET: "#e06c75", ERROR: "#e06c75" };

  return (
    <div>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          {multiline
            ? <textarea value={val} onChange={(e) => set(e.target.value)} placeholder={placeholder} style={sty} rows={4} readOnly={confirmed} />
            : <input value={val} onChange={(e) => set(e.target.value)} placeholder={placeholder} style={sty} readOnly={confirmed} />
          }
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 2 }}>
          {hasSR && !confirmed && (
            <button onClick={toggleVoice} style={{
              background: recording ? "#e06c7522" : "#21252b", border: "1px solid " + (recording ? "#e06c75" : "#3e4451"),
              borderRadius: 4, color: recording ? "#e06c75" : "#636d83", cursor: "pointer", fontSize: 10, padding: "6px 8px",
              fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, whiteSpace: "nowrap",
            }}>{recording ? "■ STOP" : "● REC"}</button>
          )}
          {modelAnswer && !confirmed && (
            <button onClick={() => defend(val)} disabled={assessing || !val.trim()} style={{
              background: assessing ? "#21252b" : "#c678dd18", border: "1px solid #c678dd44", borderRadius: 4,
              color: assessing ? "#636d83" : "#c678dd", cursor: assessing || !val.trim() ? "default" : "pointer",
              fontSize: 10, padding: "6px 8px", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700,
              letterSpacing: "0.04em", opacity: !val.trim() ? 0.4 : 1, whiteSpace: "nowrap",
            }}>{assessing ? "..." : "DEFEND"}</button>
          )}
          {confirmed && <span style={{ color: "#98c379", fontSize: 14, textAlign: "center" }}>✓</span>}
        </div>
      </div>

      {verdict && verdict !== "ERROR" && (
        <div style={{ marginTop: 6, padding: "8px 12px", borderRadius: 6, background: vc[verdict] + "08", border: "1px solid " + vc[verdict] + "33", borderLeft: "3px solid " + vc[verdict] }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: vc[verdict], fontWeight: 700, letterSpacing: "0.06em" }}>{verdict}</span>
            {confirmed && <span style={{ color: "#98c379", fontSize: 12 }}>✓</span>}
            {verdict === "PARTIAL" && (
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#636d83", marginLeft: "auto" }}>
                attempt {partialCount}/10
              </span>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: "#abb2bf", lineHeight: 1.6, marginTop: 4 }}>{feedback}</div>
        </div>
      )}
      {verdict === "ERROR" && <div style={{ marginTop: 6, padding: "8px 12px", borderRadius: 6, background: "#e06c7508", border: "1px solid #e06c7533", fontSize: 12, color: "#e06c75" }}>{feedback}</div>}

      {verdict === "PARTIAL" && probe && (
        <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 6, background: "#e5c07b08", border: "1px solid #e5c07b22", borderLeft: "3px solid #e5c07b44" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#e5c07b", fontWeight: 700, letterSpacing: "0.06em" }}>FOLLOW-UP</span>
            {/* ← NEW: probe attempt counter */}
            {probeAttemptCount > 0 && (
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#636d83" }}>
                probe {probeAttemptCount}
              </span>
            )}
            <button onClick={speakProbe} style={{
              background: probeSpeaking ? "#e5c07b18" : "#21252b",
              border: "1px solid " + (probeSpeaking ? "#e5c07b" : "#3e4451"),
              borderRadius: 4, color: probeSpeaking ? "#e5c07b" : "#636d83",
              cursor: "pointer", fontSize: 10, padding: "3px 6px",
              fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600,
              whiteSpace: "nowrap", marginLeft: "auto",
            }}>{probeSpeaking ? "■" : "▶"}</button>
          </div>
          <div style={{ fontSize: 13, color: "#d7dae0", lineHeight: 1.6, marginBottom: 8, fontStyle: "italic" }}>"{probe}"</div>
          {checks["probe_feedback_" + id] && (
            <div style={{ fontSize: 12, color: "#e5c07b", lineHeight: 1.5, marginBottom: 8, padding: "6px 10px", background: "#e5c07b08", border: "1px solid #e5c07b22", borderRadius: 4 }}>
              {checks["probe_feedback_" + id]}
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <input value={probeVal} onChange={(e) => setChecks(p => ({ ...p, ["answer_probe_" + id]: e.target.value }))} placeholder="Answer the follow-up..." style={{ ...sty, minHeight: undefined, flex: 1 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {hasSR && (
                <button onClick={toggleProbeVoice} style={{
                  background: probeRecording ? "#e06c7522" : "#21252b", border: "1px solid " + (probeRecording ? "#e06c75" : "#3e4451"),
                  borderRadius: 4, color: probeRecording ? "#e06c75" : "#636d83", cursor: "pointer", fontSize: 10, padding: "6px 8px",
                  fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, whiteSpace: "nowrap",
                }}>{probeRecording ? "■ STOP" : "● REC"}</button>
              )}
              <button onClick={() => defend(probeVal, probe, true)} disabled={assessing || !probeVal.trim()} style={{
                background: "#e5c07b18", border: "1px solid #e5c07b44", borderRadius: 4, color: "#e5c07b",
                cursor: "pointer", fontSize: 10, padding: "6px 8px", fontFamily: "'IBM Plex Mono', monospace",
                fontWeight: 700, opacity: !probeVal.trim() ? 0.4 : 1, whiteSpace: "nowrap",
              }}>{assessing ? "..." : "DEFEND"}</button>
            </div>
          </div>
        </div>
      )}

      {modelAnswer && (
        <div style={{ marginTop: 4 }}>
          <button onClick={() => setShowModel(!showModel)} style={{ background: "none", border: "none", cursor: "pointer", padding: "3px 0", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: showModel ? "#56b6c2" : "#3e4451", fontWeight: 600, letterSpacing: "0.05em" }}>{showModel ? "HIDE" : "REVEAL"} MODEL ANSWER</span>
            <span style={{ color: showModel ? "#56b6c2" : "#3e4451", fontSize: 10, transform: showModel ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s", display: "inline-block" }}>{showModel ? "▾" : "▸"}</span>
          </button>
          {showModel && (
            <div style={{ background: "#56b6c206", border: "1px solid #56b6c218", borderLeft: "3px solid #56b6c244", borderRadius: "0 6px 6px 0", padding: "10px 14px", marginTop: 4 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#56b6c266", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 6 }}>MODEL ANSWER</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#8fbcbb", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{modelAnswer}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}