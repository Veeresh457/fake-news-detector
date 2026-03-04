"""
app.py - Flask web application for Fake News Detection
"""

from flask import Flask, render_template, request, jsonify
import os

from model import load_model, predict

app = Flask(__name__)

# ── Load model once at startup ────────────────────────────────────────────────
try:
    _model, _vectorizer = load_model()
    print("✓  Model loaded successfully.")
except FileNotFoundError as e:
    _model, _vectorizer = None, None
    print(f"⚠  {e}")


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    model_ready = _model is not None
    return render_template("index.html", model_ready=model_ready)


@app.route("/predict", methods=["POST"])
def predict_news():
    """
    Accepts JSON { "text": "..." } and returns:
    {
        "label":      "REAL" | "FAKE",
        "confidence": 87.3,
        "word_count": 12
    }
    """
    if _model is None:
        return jsonify({
            "error": "Model not loaded. Please run: python train_model.py"
        }), 503

    data = request.get_json(silent=True)
    if not data or "text" not in data:
        return jsonify({"error": "No text provided."}), 400

    text = str(data["text"]).strip()
    if len(text) < 5:
        return jsonify({"error": "Please enter a longer text (at least 5 characters)."}), 400

    result = predict(text, _model, _vectorizer)

    if "error" in result:
        return jsonify({"error": result["error"]}), 400

    word_count = len(text.split())

    return jsonify({
        "label":      result["label"],
        "confidence": result["confidence"],
        "word_count": word_count,
    })


@app.route("/health")
def health():
    return jsonify({
        "status":      "ok",
        "model_ready": _model is not None,
    })


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    print(f"\n  Fake News Detector running at http://127.0.0.1:{port}\n")
    app.run(host="0.0.0.0", port=port, debug=debug)
