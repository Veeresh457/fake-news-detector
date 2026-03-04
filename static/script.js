/* ── Fake News Detector — Frontend Logic ──────────────────────────────────── */

(function () {
  "use strict";

  /* DOM refs */
  const textarea      = document.getElementById("newsInput");
  const detectBtn     = document.getElementById("detectBtn");
  const clearBtn      = document.getElementById("clearBtn");
  const spinner       = document.getElementById("spinner");
  const btnText       = document.getElementById("btnText");
  const resultCard    = document.getElementById("resultCard");
  const resultInner   = document.getElementById("resultInner");
  const resultIcon    = document.getElementById("resultIcon");
  const resultVerdict = document.getElementById("resultVerdict");
  const resultSubtitle= document.getElementById("resultSubtitle");
  const confidenceVal = document.getElementById("confidenceVal");
  const confBar       = document.getElementById("confBar");
  const confidenceCap = document.getElementById("confidenceCap");
  const wordCountBadge= document.getElementById("wordCountBadge");
  const wordCountMeta = document.getElementById("wordCountMeta");
  const errorBox      = document.getElementById("errorBox");
  const errorMsg      = document.getElementById("errorMsg");
  const totalChecked  = document.getElementById("totalChecked");

  /* State */
  let checked = 0;

  /* ── Word counter ────────────────────────────────────────────────────────── */
  textarea.addEventListener("input", () => {
    const words = countWords(textarea.value);
    wordCountBadge.textContent = `${words} word${words !== 1 ? "s" : ""}`;
    wordCountBadge.classList.toggle("has-words", words > 0);
    hideError();
    if (words === 0) hideResult();
  });

  function countWords(text) {
    return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  }

  /* ── Example buttons ─────────────────────────────────────────────────────── */
  document.querySelectorAll("[data-example]").forEach((btn) => {
    btn.addEventListener("click", () => {
      textarea.value = btn.getAttribute("data-example");
      textarea.dispatchEvent(new Event("input"));
      textarea.focus();
      hideResult();
    });
  });

  /* ── Clear button ────────────────────────────────────────────────────────── */
  clearBtn.addEventListener("click", () => {
    textarea.value = "";
    textarea.dispatchEvent(new Event("input"));
    textarea.focus();
    hideResult();
    hideError();
  });

  /* ── Detect button ───────────────────────────────────────────────────────── */
  detectBtn.addEventListener("click", runDetection);

  textarea.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") runDetection();
  });

  async function runDetection() {
    const text = textarea.value.trim();
    if (!text) {
      showError("Please paste or type a news article or headline first.");
      textarea.focus();
      return;
    }
    if (text.length < 5) {
      showError("Your input is too short. Please enter more text.");
      return;
    }

    setLoading(true);
    hideError();
    hideResult();

    try {
      const res = await fetch("/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        showError(data.error || "Server error. Please try again.");
        return;
      }

      showResult(data);
      checked++;
      totalChecked.textContent = checked;

    } catch (err) {
      showError("Network error — make sure the Flask server is running.");
    } finally {
      setLoading(false);
    }
  }

  /* ── Render result ───────────────────────────────────────────────────────── */
  function showResult({ label, confidence, word_count }) {
    const isReal = label === "REAL";

    /* classes */
    resultInner.className = "result-inner " + (isReal ? "real" : "fake");

    /* icon */
    resultIcon.textContent = isReal ? "✅" : "🚨";

    /* verdict */
    resultVerdict.textContent = isReal ? "Real News" : "Fake News";
    resultSubtitle.textContent = isReal
      ? "This article appears to be credible."
      : "This article shows signs of misinformation.";

    /* confidence */
    confidenceVal.textContent = confidence.toFixed(1) + "%";

    const cap = confidence >= 90
      ? "Very high confidence"
      : confidence >= 75
      ? "High confidence"
      : confidence >= 60
      ? "Moderate confidence"
      : "Low confidence";
    confidenceCap.textContent = cap;

    /* word count meta */
    wordCountMeta.textContent = word_count;

    /* show card */
    resultCard.style.display = "block";

    /* animate bar after render */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        confBar.style.width = confidence + "%";
      });
    });
  }

  function hideResult() {
    resultCard.style.display = "none";
    confBar.style.width = "0%";
  }

  /* ── Error ───────────────────────────────────────────────────────────────── */
  function showError(msg) {
    errorMsg.textContent = msg;
    errorBox.style.display = "flex";
  }

  function hideError() {
    errorBox.style.display = "none";
  }

  /* ── Loading state ───────────────────────────────────────────────────────── */
  function setLoading(loading) {
    detectBtn.disabled = loading;
    spinner.style.display  = loading ? "block" : "none";
    btnText.textContent    = loading ? "Analyzing…" : "Detect";
  }

})();
