# CineScribe — AI Video Intelligence

Transcribe, summarise, and chat with your videos and meetings.

## Stack

- **Frontend**: Plain HTML + CSS + JavaScript (no frameworks)
- **Backend**: Flask (Python)
- **STT**: OpenAI Whisper (English) / Sarvam AI (Hinglish)
- **LLM**: Mistral via LangChain
- **RAG**: ChromaDB + HuggingFace Embeddings

## Project Structure

```
cinescribe/
├── app.py                  # Flask backend + API routes
├── requirements.txt
├── .env.example
├── templates/
│   └── index.html          # Single-page HTML
├── static/
│   ├── css/style.css       # Flat Design Corporativo
│   └── js/app.js           # Frontend logic
├── core/
│   ├── extractor.py        # Action items, decisions, questions
│   ├── rag_engine.py       # RAG pipeline
│   ├── summarizer.py       # Map-reduce summarisation
│   ├── transcriber.py      # Whisper + Sarvam routing
│   └── vector_store.py     # ChromaDB helpers
└── utils/
    └── audio_processor.py  # yt-dlp download + audio chunking
```

## Setup

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Copy and fill in env vars
cp .env.example .env

# 3. Run the server
python app.py
```

Open **http://localhost:5000** in your browser.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Serve the frontend |
| POST | `/api/analyse` | Start a pipeline job → returns `job_id` |
| GET | `/api/status/<job_id>` | Poll job status + results |
| POST | `/api/chat` | Ask a question against the transcript RAG |
| GET | `/api/chat/history/<job_id>` | Retrieve chat history |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MISTRAL_API_KEY` | Mistral AI key (LLM for all tasks) |
| `SARVAM_API_KEY` | Sarvam API key (Hinglish STT only) |
| `WHISPER_MODEL` | Whisper model size (`tiny`, `base`, `small`, `medium`) |
| `FLASK_SECRET_KEY` | Flask session secret |
