import os
import threading
import uuid
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "cinescribe-secret-2024")

# In-memory job store
jobs = {}
jobs_lock = threading.Lock()


def run_pipeline(job_id: str, source: str, language: str):
    # Lazy imports — loaded only when pipeline runs, not at startup
    from utils.audio_processor import process_input
    from core.transcriber import transcribe_all
    from core.summarizer import summarize, generate_title
    from core.extractor import extract_action_items, extract_key_decisions, extract_questions
    from core.rag_engine import build_rag_chain, ask_question

    def update(step, state):
        with jobs_lock:
            jobs[job_id]["steps"][step] = state

    def set_status(s):
        with jobs_lock:
            jobs[job_id]["status"] = s

    try:
        set_status("running")

        update("audio", "active")
        chunks = process_input(source)
        update("audio", "done")

        update("transcript", "active")
        transcript = transcribe_all(chunks, language)
        update("transcript", "done")

        update("title", "active")
        title = generate_title(transcript)
        update("title", "done")

        update("summary", "active")
        summary = summarize(transcript)
        update("summary", "done")

        update("extract", "active")
        action_items = extract_action_items(transcript)
        decisions = extract_key_decisions(transcript)
        questions = extract_questions(transcript)
        update("extract", "done")

        update("rag", "active")
        rag_chain = build_rag_chain(transcript)
        update("rag", "done")

        with jobs_lock:
            jobs[job_id]["result"] = {
                "title": title,
                "transcript": transcript,
                "summary": summary,
                "action_items": action_items,
                "key_decisions": decisions,
                "open_questions": questions,
            }
            jobs[job_id]["rag_chain"] = rag_chain
            jobs[job_id]["status"] = "done"

    except Exception as e:
        set_status("error")
        with jobs_lock:
            jobs[job_id]["error"] = str(e)
            for step in ["audio", "transcript", "title", "summary", "extract", "rag"]:
                if jobs[job_id]["steps"].get(step) == "active":
                    jobs[job_id]["steps"][step] = "pending"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/analyse", methods=["POST"])
def analyse():
    data = request.get_json()
    source = (data.get("source") or "").strip()
    language = data.get("language", "english")

    if not source:
        return jsonify({"error": "Please provide a YouTube URL or file path."}), 400

    job_id = str(uuid.uuid4())
    with jobs_lock:
        jobs[job_id] = {
            "status": "queued",
            "steps": {k: "pending" for k in ["audio", "transcript", "title", "summary", "extract", "rag"]},
            "result": None,
            "rag_chain": None,
            "error": None,
            "chat_history": [],
        }

    thread = threading.Thread(target=run_pipeline, args=(job_id, source, language), daemon=True)
    thread.start()

    return jsonify({"job_id": job_id})


@app.route("/api/status/<job_id>")
def status(job_id):
    with jobs_lock:
        job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404

    payload = {
        "status": job["status"],
        "steps": job["steps"],
        "error": job["error"],
        "result": job["result"],
    }
    return jsonify(payload)


@app.route("/api/chat", methods=["POST"])
def chat():
    from core.rag_engine import ask_question
    data = request.get_json()
    job_id = data.get("job_id")
    question = (data.get("question") or "").strip()

    if not job_id or not question:
        return jsonify({"error": "Missing job_id or question"}), 400

    with jobs_lock:
        job = jobs.get(job_id)

    if not job or job["status"] != "done":
        return jsonify({"error": "Analysis not complete."}), 400

    answer = ask_question(job["rag_chain"], question)

    with jobs_lock:
        jobs[job_id]["chat_history"].append({"role": "user", "content": question})
        jobs[job_id]["chat_history"].append({"role": "assistant", "content": answer})

    return jsonify({"answer": answer})


@app.route("/api/chat/history/<job_id>")
def chat_history(job_id):
    with jobs_lock:
        job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify({"history": job.get("chat_history", [])})


if __name__ == "__main__":
    port = int(os.getenv("PORT", 7860))
    app.run(debug=False, host="0.0.0.0", port=port)
