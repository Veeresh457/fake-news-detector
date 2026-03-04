"""
train_model.py - Train and save the Fake News Detection model.

Run this once before starting the Flask app:
    python train_model.py
"""

import os
import pickle
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
try:
    from sklearn.linear_model import PassiveAggressiveClassifier
except ImportError:
    from sklearn.linear_model import SGDClassifier as PassiveAggressiveClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

from model import clean_text


# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH  = os.path.join(BASE_DIR, "dataset", "news.csv")
MODEL_PATH    = os.path.join(BASE_DIR, "model.pkl")
VECTORIZER_PATH = os.path.join(BASE_DIR, "vectorizer.pkl")


def load_dataset(path: str) -> pd.DataFrame:
    """Load CSV dataset; fall back to a tiny built-in sample if missing."""
    if os.path.exists(path):
        df = pd.read_csv(path)
        print(f"✓  Loaded dataset: {len(df)} rows from {path}")
    else:
        print("⚠  Dataset not found — using built-in sample data.")
        sample = {
            "text": [
                "Government announces new healthcare policy",
                "Aliens land in New York City park",
                "Stock market hits record high today",
                "Scientists confirm chocolate cures all diseases",
                "President signs new climate change legislation",
                "NASA discovers planet made entirely of gold",
                "Federal Reserve raises interest rates",
                "Drinking bleach boosts immune system say doctors",
                "New COVID vaccine shows 95 percent effectiveness",
                "Bill Gates microchips found inside vaccines",
            ],
            "label": [
                "REAL", "FAKE", "REAL", "FAKE", "REAL",
                "FAKE", "REAL", "FAKE", "REAL", "FAKE",
            ],
        }
        df = pd.DataFrame(sample)

    return df


def preprocess(df: pd.DataFrame) -> pd.DataFrame:
    """Drop nulls and clean text column."""
    df = df.dropna(subset=["text", "label"]).copy()
    df["label"] = df["label"].str.upper().str.strip()
    df = df[df["label"].isin(["REAL", "FAKE"])]
    df["text"] = df["text"].apply(clean_text)
    df = df[df["text"].str.len() > 0]
    return df.reset_index(drop=True)


def train():
    print("\n" + "═" * 50)
    print("  Fake News Detector — Model Training")
    print("═" * 50)

    # 1. Load & preprocess
    df = load_dataset(DATASET_PATH)
    df = preprocess(df)
    print(f"✓  After cleaning: {len(df)} usable rows")
    print(f"   REAL: {(df['label']=='REAL').sum()}  |  FAKE: {(df['label']=='FAKE').sum()}")

    # 2. Train / test split
    X_train, X_test, y_train, y_test = train_test_split(
        df["text"], df["label"],
        test_size=0.2,
        random_state=42,
        stratify=df["label"],
    )
    print(f"✓  Train size: {len(X_train)}  |  Test size: {len(X_test)}")

    # 3. TF-IDF vectorisation
    vectorizer = TfidfVectorizer(
        max_features=10_000,
        ngram_range=(1, 2),
        sublinear_tf=True,
        min_df=1,
    )
    X_train_tfidf = vectorizer.fit_transform(X_train)
    X_test_tfidf  = vectorizer.transform(X_test)
    print(f"✓  Vocabulary size: {len(vectorizer.vocabulary_)}")

    # 4. Train PassiveAggressiveClassifier
    clf = PassiveAggressiveClassifier(
        C=0.5,
        max_iter=1000,
        random_state=42,
        tol=1e-3,
    )
    clf.fit(X_train_tfidf, y_train)
    print("✓  Model trained successfully")

    # 5. Evaluate
    y_pred    = clf.predict(X_test_tfidf)
    accuracy  = accuracy_score(y_test, y_pred)
    print(f"\n  Test Accuracy : {accuracy * 100:.1f}%")
    print("\n  Classification Report:")
    print(classification_report(y_test, y_pred, target_names=["FAKE", "REAL"]))

    # 6. Save artefacts
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(clf, f)
    with open(VECTORIZER_PATH, "wb") as f:
        pickle.dump(vectorizer, f)

    print(f"✓  Model saved     → {MODEL_PATH}")
    print(f"✓  Vectorizer saved→ {VECTORIZER_PATH}")
    print("\n  Training complete! You can now run: python app.py")
    print("═" * 50 + "\n")


if __name__ == "__main__":
    train()
