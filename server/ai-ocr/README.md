# SacraDigit AI reader (PaddleOCR + Qwen2.5-VL)

Reads scanned certificates (birth, baptism, confirmation, marriage, death) for the
Digital Archives "Scan Document" screen. Free and open source; runs on your own
computer, so no document leaves it.

```
photo/PDF page ──► PaddleOCR  ──► words + positions (the boxes you see on the page)
              └──► Qwen2.5-VL (via Ollama) looks at the image AND the OCR text,
                   repairs letters OCR got wrong, returns the form fields as JSON
                         │
                         ▼
        grounding check: an AI answer the OCR never saw is marked amber
        ("please check") — the admin always confirms before saving
```

If this service isn't running (or fails), the scan screen silently uses the built-in
Tesseract reader, exactly as before.

## One-time setup

1. `powershell -ExecutionPolicy Bypass -File server\ai-ocr\setup.ps1`
   (creates `server/ai-ocr/.venv` and installs PaddleOCR + the web server)
2. Install Ollama: https://ollama.com/download (or `winget install Ollama.Ollama`)
3. `ollama pull qwen2.5vl:3b` (about 3.2 GB)

PaddleOCR downloads its own small models the first time it reads a page.

## Every time

```
powershell -ExecutionPolicy Bypass -File server\ai-ocr\start.ps1   # AI reader on :8008
npm run dev                                                         # the site
```

Open Digital Archives → Scan Document. A **Read with AI** chip appears on results.
In `npm run dev` the site finds the service at `http://127.0.0.1:8008` by itself.

## Settings (`.env`, copy from `.env.example`)

| Variable | What it does |
|---|---|
| `OLLAMA_MODEL` | `qwen2.5vl:3b` (default, laptop-friendly) or `qwen2.5vl:7b` (more accurate, wants a GPU) |
| `OCR_PROFILE` | `mobile` (default, ~10 s/page on CPU) or `server` (more accurate, ~4x slower on CPU) PaddleOCR models |
| `VLM_MAX_SIDE` | Size of the picture shown to the AI. Lower = faster |
| `ALLOWED_ORIGINS` | Sites allowed to call this service |
| `OCR_API_KEY` | Optional shared secret (set the same in `VITE_OCR_API_KEY`) |

For a hosted site, set `VITE_OCR_API_URL` when building. Without it, a production
build never tries to reach the AI reader.

## Speed and accuracy notes

- On a laptop without a strong GPU the AI step takes roughly 1–3 minutes per page.
  The first scan after starting is the slowest (the model loads into memory).
- The AI can guess wrong on letters that are truly unreadable. That's why every
  value is cross-checked against the OCR text, and why the admin confirms each field.
- Details of what was used are saved in the `.scan.json` transcript (`reader`).

## Check it without the website

```
curl http://127.0.0.1:8008/health
```
`"ready": true` means PaddleOCR's service is up and the Ollama model is installed.
