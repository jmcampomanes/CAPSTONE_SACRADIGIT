"""
SacraDigit — AI document reader (PaddleOCR + Qwen2.5-VL via Ollama)

POST /scan   an image of a certificate/record page  ->  the words with their
             positions (PaddleOCR) + the form fields (Qwen2.5-VL reads the image
             and the OCR text together, and fixes letters OCR got wrong).
GET  /health tells the browser whether the AI reader is ready to use.

Everything runs on this machine: no document leaves it, no paid API.
Start it with  start.ps1  (see README.md).
"""
import asyncio
import base64
import difflib
import io
import json
import os
import re
import time
from typing import Any

import httpx
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps
from starlette.middleware.base import BaseHTTPMiddleware

# ---------------------------------------------------------------- settings --

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5vl:3b")
# "mobile" = light PP-OCRv5 models (~10 s/page on a laptop CPU, default);
# "server" = PaddleOCR's default medium models (more accurate, ~4x slower on CPU).
OCR_PROFILE = os.getenv("OCR_PROFILE", "mobile").lower()
VLM_MAX_SIDE = int(os.getenv("VLM_MAX_SIDE", "1280"))      # smaller = faster on CPU
OCR_MAX_SIDE = int(os.getenv("OCR_MAX_SIDE", "2400"))
VLM_TIMEOUT = float(os.getenv("VLM_TIMEOUT_SECONDS", "600"))
MAX_UPLOAD = 15 * 1024 * 1024
API_KEY = os.getenv("OCR_API_KEY", "")                      # optional shared secret
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
    ).split(",")
    if o.strip()
]

app = FastAPI(title="SacraDigit AI reader", docs_url=None, redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "x-ocr-key"],
)


class PrivateNetworkMiddleware(BaseHTTPMiddleware):
    """Lets a deployed https page call this service on the admin's own computer."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if request.headers.get("access-control-request-private-network") == "true":
            response.headers["Access-Control-Allow-Private-Network"] = "true"
        return response


app.add_middleware(PrivateNetworkMiddleware)


def check_key(request: Request) -> None:
    if API_KEY and request.headers.get("x-ocr-key") != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


# --------------------------------------------------------------- PaddleOCR --

_ocr = None
_ocr_lock = asyncio.Lock()  # CPU-bound: one scan at a time


def get_ocr():
    global _ocr
    if _ocr is None:
        os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
        from paddleocr import PaddleOCR  # imported late: it is slow to load

        kwargs: dict[str, Any] = dict(
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            lang="en",
            # PaddlePaddle 3.x's oneDNN path crashes on some CPUs/models
            # ("ConvertPirAttribute2RuntimeAttribute not support"). Plain CPU mode works.
            enable_mkldnn=False,
        )
        if OCR_PROFILE == "mobile":
            kwargs["text_detection_model_name"] = "PP-OCRv5_mobile_det"
            kwargs["text_recognition_model_name"] = "PP-OCRv5_mobile_rec"
        _ocr = PaddleOCR(**kwargs)
    return _ocr


def to_rgb(data: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(data))
    img = ImageOps.exif_transpose(img).convert("RGB")
    k = min(1.0, OCR_MAX_SIDE / max(img.size))
    if k < 1:
        img = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)
    return img


def run_paddle(img: Image.Image) -> list[dict]:
    """PaddleOCR -> one dict per text line: text, conf (0-100), x0,y0,x1,y1."""
    out = get_ocr().predict(np.array(img))
    lines: list[dict] = []
    for r in out:
        d = r
        if not hasattr(d, "get") or "rec_texts" not in d:
            d = (getattr(r, "json", None) or {}).get("res", {})
        texts = d.get("rec_texts", []) or []
        scores = d.get("rec_scores", []) or []
        polys = d.get("rec_polys", None)
        if polys is None or len(polys) == 0:
            polys = d.get("dt_polys", []) or []
        for text, score, poly in zip(texts, scores, polys):
            text = str(text).strip()
            if not text:
                continue
            pts = np.array(poly, dtype=float).reshape(-1, 2)
            lines.append(
                dict(
                    text=text,
                    conf=int(round(float(score) * 100)),
                    x0=float(pts[:, 0].min()),
                    y0=float(pts[:, 1].min()),
                    x1=float(pts[:, 0].max()),
                    y1=float(pts[:, 1].max()),
                )
            )
    return lines


def lines_to_words(lines: list[dict]) -> list[dict]:
    """Splits each text line into words, sharing the line's width by character count."""
    words: list[dict] = []
    for ln in lines:
        parts = ln["text"].split()
        if not parts:
            continue
        total = sum(len(p) for p in parts) + (len(parts) - 1)  # spaces count as one char
        width = ln["x1"] - ln["x0"]
        x = ln["x0"]
        for p in parts:
            w = width * len(p) / total
            words.append(
                dict(text=p, conf=ln["conf"], x0=round(x, 1), x1=round(x + w, 1),
                     y0=round(ln["y0"], 1), y1=round(ln["y1"], 1))
            )
            x += width * (len(p) + 1) / total
    return words


def reading_order_text(lines: list[dict]) -> str:
    """Top-to-bottom, left-to-right text — what the model sees as the OCR layer."""
    if not lines:
        return ""
    heights = sorted(l["y1"] - l["y0"] for l in lines)
    med = heights[len(heights) // 2] or 10
    rows: list[list[dict]] = []
    for ln in sorted(lines, key=lambda l: (l["y0"] + l["y1"]) / 2):
        cy = (ln["y0"] + ln["y1"]) / 2
        if rows and abs(cy - np.mean([(r["y0"] + r["y1"]) / 2 for r in rows[-1]])) < med * 0.6:
            rows[-1].append(ln)
        else:
            rows.append([ln])
    return "\n".join(" | ".join(l["text"] for l in sorted(r, key=lambda l: l["x0"])) for r in rows)


# ----------------------------------------------------------- Qwen2.5-VL ----

def vlm_image_b64(img: Image.Image) -> str:
    k = min(1.0, VLM_MAX_SIDE / max(img.size))
    small = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS) if k < 1 else img
    buf = io.BytesIO()
    small.save(buf, "JPEG", quality=90)
    return base64.b64encode(buf.getvalue()).decode()


def build_schema(fields: list[dict]) -> dict:
    return {
        "type": "object",
        "properties": {
            f["key"]: {
                "type": "object",
                "properties": {"value": {"type": "string"}, "certain": {"type": "boolean"}},
                "required": ["value", "certain"],
            }
            for f in fields
        },
        "required": [f["key"] for f in fields],
    }


def build_prompt(doc_label: str, fields: list[dict], ocr_text: str) -> str:
    lines = []
    for f in fields:
        hint = {"name": "a person's full name", "date": "a date written as YYYY-MM-DD",
                "row": "the printed Book / Page / Line text"}.get(f.get("kind"), "text as printed")
        lines.append(f'- "{f["key"]}": {f["label"]} ({hint})')
    return (
        f"You are reading a scanned Philippine parish or civil record: {doc_label}.\n"
        "A basic OCR tool already read the page, but it makes mistakes on faded, stamped or "
        "poorly printed letters. Use BOTH the image and the OCR text below. Correct OCR "
        "mistakes only when the image supports the correction.\n\n"
        "Fill in these fields:\n" + "\n".join(lines) + "\n\n"
        "Rules:\n"
        "- Copy names, places and numbers exactly as they are printed. Never invent or guess.\n"
        "- A name goes in the order: first name, middle name, last name (reorder 'DELA CRUZ, JUAN').\n"
        "- If a field is not on the page, or you cannot read it, set value to \"\" and certain to false.\n"
        "- certain is true only when you can clearly read the value in the image.\n"
        "- Dates must be YYYY-MM-DD; if the full date is not readable use \"\".\n\n"
        "OCR text (rows top to bottom, cells on a row separated by |):\n"
        f"{ocr_text[:6000]}\n\nAnswer with JSON only."
    )


async def ollama_status() -> dict:
    try:
        async with httpx.AsyncClient(timeout=2.5) as c:
            r = await c.get(f"{OLLAMA_URL}/api/tags")
        names = [m.get("name", "") for m in r.json().get("models", [])]
        base = OLLAMA_MODEL.split(":")[0]
        installed = any(n == OLLAMA_MODEL or n.startswith(OLLAMA_MODEL + "-") or
                        (":" not in OLLAMA_MODEL and n.split(":")[0] == base) for n in names)
        return {"running": True, "modelInstalled": installed}
    except Exception:
        return {"running": False, "modelInstalled": False}


async def ask_vlm(img: Image.Image, doc_label: str, fields: list[dict], ocr_text: str) -> dict:
    payload = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "format": build_schema(fields),
        "keep_alive": "30m",
        "options": {"temperature": 0, "num_ctx": 6144, "num_predict": 900},
        "messages": [{
            "role": "user",
            "content": build_prompt(doc_label, fields, ocr_text),
            "images": [vlm_image_b64(img)],
        }],
    }
    async with httpx.AsyncClient(timeout=VLM_TIMEOUT) as c:
        r = await c.post(f"{OLLAMA_URL}/api/chat", json=payload)
    if r.status_code != 200:
        raise RuntimeError(f"Ollama answered {r.status_code}: {r.text[:200]}")
    content = r.json().get("message", {}).get("content", "")
    return json.loads(content)


# ------------------------------------------------------ anti-hallucination --

_TOKEN = re.compile(r"[A-Za-z0-9ÑñÁÉÍÓÚáéíóú]{3,}")


def grounded_score(value: str, kind: str, ocr_tokens: set[str], ocr_text: str) -> float | None:
    """How much of the AI's answer does the OCR also see? 1 = all, 0 = none, None = can't tell."""
    if kind == "date":
        m = re.match(r"(\d{4})-(\d{2})-(\d{2})$", value)
        if not m:
            return None
        year, _, day = m.groups()
        hits = int(year in ocr_text) + int(str(int(day)) in ocr_text.replace("-", " "))
        return hits / 2
    toks = [t.upper() for t in _TOKEN.findall(value)]
    if not toks:
        return None
    ok = 0
    for t in toks:
        if t in ocr_tokens or difflib.get_close_matches(t, ocr_tokens, n=1, cutoff=0.8):
            ok += 1
    return ok / len(toks)


def score_fields(raw: dict, fields: list[dict], ocr_text: str) -> dict:
    ocr_tokens = {t.upper() for t in _TOKEN.findall(ocr_text)}
    out: dict[str, dict] = {}
    for f in fields:
        item = raw.get(f["key"]) or {}
        value = str(item.get("value", "")).strip()
        if not value:
            continue
        certain = bool(item.get("certain"))
        grounded = grounded_score(value, f.get("kind", "text"), ocr_tokens, ocr_text)
        conf = 85 if certain else 50
        if grounded is not None:
            if grounded < 0.34:
                conf = min(conf, 40)   # OCR never saw this: needs a human look
            elif grounded < 0.67:
                conf = min(conf, 55)
        out[f["key"]] = dict(value=value, certain=certain,
                             grounded=None if grounded is None else round(grounded, 2), conf=conf)
    return out


# ---------------------------------------------------------------- routes ----

@app.get("/health")
async def health(request: Request):
    check_key(request)
    st = await ollama_status()
    return {
        "ok": True,
        "model": OLLAMA_MODEL,
        "ollamaRunning": st["running"],
        "modelInstalled": st["modelInstalled"],
        "ready": st["running"] and st["modelInstalled"],
    }


@app.post("/scan")
async def scan(
    request: Request,
    image: UploadFile = File(...),
    docLabel: str = Form("Certificate"),
    fields: str = Form("[]"),
):
    check_key(request)
    data = await image.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "Image is too large")
    try:
        field_list = [
            {"key": str(f["key"]), "label": str(f.get("label", f["key"])), "kind": str(f.get("kind", "text"))}
            for f in json.loads(fields)
        ][:40]
        img = to_rgb(data)
    except Exception:
        raise HTTPException(400, "Bad image or field list")

    async with _ocr_lock:
        t0 = time.time()
        lines = await run_in_threadpool(run_paddle, img)
        t_ocr = time.time() - t0
        ocr_text = reading_order_text(lines)

        ai: dict[str, Any] = {"used": False, "model": OLLAMA_MODEL, "error": None}
        scored: dict = {}
        t_ai = 0.0
        if field_list and lines:
            t1 = time.time()
            try:
                raw = await ask_vlm(img, docLabel, field_list, ocr_text)
                scored = score_fields(raw, field_list, ocr_text)
                ai["used"] = True
            except Exception as e:  # Ollama off, model missing, bad JSON, timeout…
                ai["error"] = f"{type(e).__name__}: {e}"[:300]
            t_ai = time.time() - t1

    return {
        "width": img.width,
        "height": img.height,
        "words": lines_to_words(lines),
        "text": ocr_text,
        "fields": scored,
        "ai": ai,
        "seconds": {"ocr": round(t_ocr, 1), "ai": round(t_ai, 1)},
    }
