"""
model.py - Model loading and prediction utilities
"""

import pickle
import os
import re
import numpy as np


MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")
VECTORIZER_PATH = os.path.join(os.path.dirname(__file__), "vectorizer.pkl")


def clean_text(text: str) -> str:
    """Clean and normalize input text."""
    if not isinstance(text, str):
        text = str(text)
    # Lowercase
    text = text.lower()
    # Remove URLs
    text = re.sub(r"http\S+|www\S+", "", text)
    # Remove HTML tags
    text = re.sub(r"<[^>]+>", "", text)
    # Remove special characters, keep letters, digits, spaces
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    # Collapse multiple spaces
    text = re.sub(r"\s+", " ", text).strip()
    return text


def load_model():
    """Load trained model and vectorizer from disk."""
    if not os.path.exists(MODEL_PATH) or not os.path.exists(VECTORIZER_PATH):
        raise FileNotFoundError(
            "Model files not found. Please run: python train_model.py"
        )

    with open(MODEL_PATH, "rb") as f:
        model = pickle.load(f)

    with open(VECTORIZER_PATH, "rb") as f:
        vectorizer = pickle.load(f)

    return model, vectorizer


def predict(text: str, model, vectorizer) -> dict:
    """
    Predict whether the given text is REAL or FAKE news.

    Returns a dict with:
        - label: 'REAL' or 'FAKE'
        - confidence: float 0–100
        - cleaned_text: the preprocessed version
    """
    cleaned = clean_text(text)

    if not cleaned.strip():
        return {
            "label": "UNKNOWN",
            "confidence": 0.0,
            "cleaned_text": cleaned,
            "error": "Input text is empty or invalid.",
        }

    features = vectorizer.transform([cleaned])

    prediction = model.predict(features)[0]

    # PassiveAggressiveClassifier exposes decision_function, not predict_proba
    decision = model.decision_function(features)[0]

    # Convert decision score to a confidence percentage using sigmoid
    confidence_raw = 1 / (1 + np.exp(-abs(decision)))
    # Scale so that a very decisive score → near 100%
    # and a borderline score → near 55%
    confidence = float(np.clip(50 + confidence_raw * 50, 50, 99))

    return {
        "label": prediction,
        "confidence": round(confidence, 1),
        "cleaned_text": cleaned,
    }
