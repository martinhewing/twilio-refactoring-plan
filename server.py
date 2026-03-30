"""
server.py — Worksheet backend

Powers the Module 01 JSX worksheet at twilio-refactoring-plan.connectaiml.com.

Three API routes:
  POST /api/assess        → Claude Sonnet (answer assessment)
  POST /api/speak         → Cartesia Sonic (examiner TTS)
  POST /api/transcribe    → Cartesia Ink (voice-to-text)

Run locally:
  pip install -r requirements.txt
  uvicorn server:app --reload --port 3001

In production, proxy /api/* from your frontend host to this server.
"""

from __future__ import annotations

import io
import json
import os
import subprocess
import tempfile

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
CARTESIA_API_KEY = os.environ.get("CARTESIA_API_KEY", "")
CARTESIA_MODEL = os.environ.get("CARTESIA_MODEL", "sonic-2")
CARTESIA_VOICE_ID = os.environ.get(
    "CARTESIA_EXAMINER_VOICE_ID",
    "79a125e8-cd45-4c13-8a67-188112f4dd22",
)

claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Module 01 Worksheet API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",       # Vite dev server
        "http://localhost:3000",       # CRA dev server
        "https://twilio-refactoring-plan.connectaiml.com",
    ],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "anthropic": bool(ANTHROPIC_API_KEY),
        "cartesia": bool(CARTESIA_API_KEY),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/assess — Claude Sonnet
# ═══════════════════════════════════════════════════════════════════════════════

EXAMINER_PROMPT = """You are a senior engineering examiner. Compare the candidate's answer against the model answer. Be rigorous but fair — they must demonstrate genuine understanding, not match word-for-word.

Respond ONLY with valid JSON, no markdown fences:
{"verdict":"CONFIRMED","feedback":"1-2 sentences","probe":null}

CONFIRMED: genuine understanding. PARTIAL: missing key insight — include a follow-up probe question. NOT_MET: fundamental misunderstanding."""


class AssessRequest(BaseModel):
    question: str
    answer: str
    model_answer: str


@app.post("/api/assess")
async def assess_answer(req: AssessRequest):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured")
    if not req.answer.strip():
        raise HTTPException(status_code=422, detail="Answer is empty")

    try:
        message = claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            system=EXAMINER_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"QUESTION:\n{req.question}\n\n"
                        f"CANDIDATE:\n{req.answer}\n\n"
                        f"MODEL ANSWER:\n{req.model_answer}"
                    ),
                }
            ],
        )

        text = message.content[0].text.strip()
        text = text.replace("```json", "").replace("```", "").strip()
        result = json.loads(text)

        return {
            "verdict": result.get("verdict", "ERROR"),
            "feedback": result.get("feedback", ""),
            "probe": result.get("probe"),
        }

    except json.JSONDecodeError as e:
        return {"verdict": "ERROR", "feedback": f"Failed to parse: {e}", "probe": None}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Claude error: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/speak — Cartesia Sonic TTS
# ═══════════════════════════════════════════════════════════════════════════════


class SpeakRequest(BaseModel):
    text: str
    voice_id: str | None = None


@app.post("/api/speak")
async def speak_text(req: SpeakRequest):
    if not CARTESIA_API_KEY:
        raise HTTPException(status_code=503, detail="CARTESIA_API_KEY not configured")
    if not req.text.strip():
        raise HTTPException(status_code=422, detail="Text is empty")

    try:
        from cartesia import AsyncCartesia

        async with AsyncCartesia(api_key=CARTESIA_API_KEY) as client:
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
                tmp = f.name
            try:
                response = await client.tts.generate(
                    model_id=CARTESIA_MODEL,
                    transcript=req.text,
                    voice={"mode": "id", "id": req.voice_id or CARTESIA_VOICE_ID},
                    output_format={
                        "container": "mp3",
                        "encoding": "mp3",
                        "sample_rate": 44100,
                        "bit_rate": 128000,
                    },
                )
                await response.write_to_file(tmp)
                audio = open(tmp, "rb").read()
            finally:
                if os.path.exists(tmp):
                    os.unlink(tmp)

        return Response(
            content=audio,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline"},
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Cartesia TTS error: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/transcribe — Cartesia Ink STT
# ═══════════════════════════════════════════════════════════════════════════════


def _to_wav(audio_bytes: bytes) -> bytes:
    """Convert browser audio (WebM) to 16kHz mono WAV via ffmpeg."""
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
        f.write(audio_bytes)
        in_path = f.name
    out_path = in_path.replace(".webm", ".wav")
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", in_path, "-ar", "16000", "-ac", "1", out_path],
            check=True,
            capture_output=True,
        )
        return open(out_path, "rb").read()
    finally:
        for p in (in_path, out_path):
            if os.path.exists(p):
                os.unlink(p)


@app.post("/api/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    if not CARTESIA_API_KEY:
        raise HTTPException(status_code=503, detail="CARTESIA_API_KEY not configured")

    audio_bytes = await audio.read()
    if len(audio_bytes) < 1000:
        raise HTTPException(status_code=422, detail="Audio too short")

    try:
        from cartesia import AsyncCartesia

        wav_bytes = _to_wav(audio_bytes)
        audio_file = ("answer.wav", io.BytesIO(wav_bytes), "audio/wav")

        async with AsyncCartesia(api_key=CARTESIA_API_KEY) as client:
            response = await client.stt.transcribe(
                model="ink-whisper",
                file=audio_file,
                language="en",
                timestamp_granularities=["word"],
            )

        transcript = (
            getattr(response, "text", None)
            or getattr(response, "transcript", None)
            or ""
        )
        words = getattr(response, "words", None) or []
        word_count = len(words) if words else len(transcript.split())

        if word_count < 3:
            return {"transcript": "", "word_count": 0, "error": "Too short"}

        return {
            "transcript": transcript.strip(),
            "word_count": word_count,
            "duration": getattr(response, "duration", None),
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Cartesia STT error: {e}")
