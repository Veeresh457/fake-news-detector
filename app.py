"""
app.py - Flask web application for Fake News Detection
"""

from flask import Flask, render_template, request, jsonify
import os
import re
import urllib.request
from urllib.error import URLError

from model import load_model, predict

app = Flask(__name__)

# ── Load model once at startup ────────────────────────────────────────────────
try:
    _model, _vectorizer = load_model()
    print("✓  Model loaded successfully.")
except FileNotFoundError as e:
    _model, _vectorizer = None, None
    print(f"⚠  {e}")


# ── Suspicious word list for heatmap ─────────────────────────────────────────
SUSPICIOUS_WORDS = {
    "shocking", "unbelievable", "secret", "hidden", "exposed", "conspiracy",
    "hoax", "fake", "fraud", "lie", "lies", "lied", "lying", "cheat", "scam",
    "cover-up", "coverup", "corrupt", "corruption", "illegal", "criminal",
    "bombshell", "explosive", "leaked", "whistleblower", "anonymous",
    "sources say", "insiders", "claim", "claims", "alleged", "allegedly",
    "reportedly", "rumor", "rumours", "unverified", "disputed", "debunked",
    "miracle", "cure", "cures", "guaranteed", "100%", "proven", "confirms",
    "confirms", "shocking truth", "wake up", "sheeple", "globalist",
    "deep state", "mainstream media", "fake news", "propaganda", "brainwash",
    "illuminati", "nwo", "agenda", "they don't want you to know",
    "what they're hiding", "banned", "censored", "silenced", "suppressed",
    "never before seen", "mind blowing", "mind-blowing", "jaw dropping",
    "jaw-dropping", "you won't believe", "share before deleted",
    "doctors hate", "one weird trick", "big pharma", "big tech",
    "elites", "cabal", "satanic", "reptilian", "clone", "microchip",
    "5g", "chemtrail", "chemtrails", "fluoride", "vaccine", "hoax",
    "plandemic", "scamdemic", "crisis actor", "false flag", "staged",
    "actors", "crisis actors", "government admits", "cia admits"
}


def fetch_article_from_url(url: str) -> dict:
    """Fetch plain text from a URL using only stdlib."""
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; FakeNewsDetector/2.0)"}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            raw = response.read().decode("utf-8", errors="ignore")

        # Strip HTML tags
        text = re.sub(r"<script[^>]*>.*?</script>", " ", raw, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<style[^>]*>.*?</style>",  " ", text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"&[a-zA-Z]+;", " ", text)
        text = re.sub(r"\s+", " ", text).strip()

        # Keep only meaningful portion (first 2000 chars of body text)
        text = text[:3000]

        if len(text) < 50:
            return {"error": "Could not extract enough text from that URL."}

        return {"text": text}

    except URLError as e:
        return {"error": f"Could not reach URL: {str(e)}"}
    except Exception as e:
        return {"error": f"Error fetching URL: {str(e)}"}


def highlight_suspicious(text: str, label: str) -> list:
    """
    Return list of word objects with highlight info.
    { word, suspicious: bool, space_after: bool }
    """
    words = re.split(r"(\s+)", text)
    result = []
    text_lower = text.lower()

    for token in words:
        if re.match(r"\s+", token):
            continue
        clean = re.sub(r"[^a-z0-9\-'% ]", "", token.lower())
        suspicious = False
        if label == "FAKE":
            for sw in SUSPICIOUS_WORDS:
                if sw in clean or clean in sw.split():
                    suspicious = True
                    break
        result.append({"word": token, "suspicious": suspicious})

    return result


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html", model_ready=_model is not None)


@app.route("/predict", methods=["POST"])
def predict_news():
    if _model is None:
        return jsonify({"error": "Model not loaded. Run: python train_model.py"}), 503

    data = request.get_json(silent=True)
    if not data or "text" not in data:
        return jsonify({"error": "No text provided."}), 400

    text = str(data["text"]).strip()
    if len(text) < 5:
        return jsonify({"error": "Please enter a longer text."}), 400

    result = predict(text, _model, _vectorizer)

    if "error" in result:
        return jsonify({"error": result["error"]}), 400

    word_count = len(text.split())
    highlights = highlight_suspicious(text, result["label"])

    return jsonify({
        "label":      result["label"],
        "confidence": result["confidence"],
        "word_count": word_count,
        "highlights": highlights,
    })


@app.route("/fetch-url", methods=["POST"])
def fetch_url():
    """Fetch article text from a given URL."""
    data = request.get_json(silent=True)
    if not data or "url" not in data:
        return jsonify({"error": "No URL provided."}), 400

    url = str(data["url"]).strip()
    if not url.startswith(("http://", "https://")):
        return jsonify({"error": "Invalid URL. Must start with http:// or https://"}), 400

    result = fetch_article_from_url(url)
    if "error" in result:
        return jsonify(result), 400

    return jsonify(result)


@app.route("/health")
def health():
    return jsonify({"status": "ok", "model_ready": _model is not None})


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port  = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    print(f"\n  Fake News Detector running at http://127.0.0.1:{port}\n")
    app.run(host="0.0.0.0", port=port, debug=debug)
