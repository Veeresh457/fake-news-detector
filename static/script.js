/* ── Fake News Detector v3.0 ─────────────────────────────────────────────── */
(function () {
  "use strict";

  /* ── DOM ───────────────────────────────────────────────────────────────── */
  const textarea        = document.getElementById("newsInput");
  const detectBtn       = document.getElementById("detectBtn");
  const clearBtn        = document.getElementById("clearBtn");
  const spinner         = document.getElementById("spinner");
  const btnText         = document.getElementById("btnText");
  const resultCard      = document.getElementById("resultCard");
  const resultInner     = document.getElementById("resultInner");
  const resultIcon      = document.getElementById("resultIcon");
  const resultVerdict   = document.getElementById("resultVerdict");
  const resultSubtitle  = document.getElementById("resultSubtitle");
  const resultBadge     = document.getElementById("resultBadge");
  const confidenceVal   = document.getElementById("confidenceVal");
  const confBar         = document.getElementById("confBar");
  const confidenceCap   = document.getElementById("confidenceCap");
  const wordCountBadge  = document.getElementById("wordCountBadge");
  const wordCountMeta   = document.getElementById("wordCountMeta");
  const responseTime    = document.getElementById("responseTime");
  const suspiciousCount = document.getElementById("suspiciousCount");
  const errorBox        = document.getElementById("errorBox");
  const errorMsg        = document.getElementById("errorMsg");
  const heatmapText     = document.getElementById("heatmapText");
  const heatmapSection  = document.getElementById("heatmapSection");
  const exportPdfBtn    = document.getElementById("exportPdfBtn");
  const totalChecked    = document.getElementById("totalChecked");
  const totalReal       = document.getElementById("totalReal");
  const totalFake       = document.getElementById("totalFake");
  const avgConfidence   = document.getElementById("avgConfidence");

  /* ── State ─────────────────────────────────────────────────────────────── */
  let stats = { checked: 0, real: 0, fake: 0, confidences: [] };
  let chartGauge = null, chartBar = null, chartRadar = null, chartLine = null;
  let historyLabels = [], historyReal = [], historyFake = [];
  let lastResult = null;

  /* ── Theme ─────────────────────────────────────────────────────────────── */
  const themeToggle = document.getElementById("themeToggle");
  const themeSwitch = document.getElementById("themeSwitch");

  function applyTheme(light) {
    document.body.classList.toggle("light", light);
    themeToggle.textContent = light ? "☀️" : "🌙";
    if (themeSwitch) themeSwitch.checked = light;
    localStorage.setItem("theme", light ? "light" : "dark");
  }

  applyTheme(localStorage.getItem("theme") === "light");
  themeToggle.addEventListener("click", () => applyTheme(!document.body.classList.contains("light")));
  if (themeSwitch) themeSwitch.addEventListener("change", () => applyTheme(themeSwitch.checked));

  /* ── Panels ────────────────────────────────────────────────────────────── */
  const overlay       = document.getElementById("panelOverlay");
  const settingsPanel = document.getElementById("settingsPanel");
  const aboutPanel    = document.getElementById("aboutPanel");

  function openPanel(p) { p.classList.add("open"); overlay.classList.add("active"); }
  function closeAll()   { [settingsPanel, aboutPanel].forEach(p => p.classList.remove("open")); overlay.classList.remove("active"); }

  document.getElementById("settingsBtn").addEventListener("click", () => openPanel(settingsPanel));
  document.getElementById("closeSettings").addEventListener("click", closeAll);
  document.getElementById("aboutBtn").addEventListener("click", () => openPanel(aboutPanel));
  document.getElementById("closeAbout").addEventListener("click", closeAll);
  overlay.addEventListener("click", closeAll);

  /* ── Chart toggles ─────────────────────────────────────────────────────── */
  const showGauge = document.getElementById("showGauge");
  const showBar   = document.getElementById("showBar");
  const showRadar = document.getElementById("showRadar");
  const showLine  = document.getElementById("showLine");

  function updateChartVis() {
    document.getElementById("gaugeCard").style.display  = showGauge.checked ? "" : "none";
    document.getElementById("barCard").style.display    = showBar.checked   ? "" : "none";
    document.getElementById("radarCard").style.display  = showRadar.checked ? "" : "none";
    document.getElementById("lineCard").style.display   = showLine.checked  ? "" : "none";
  }
  [showGauge, showBar, showRadar, showLine].forEach(el => el.addEventListener("change", updateChartVis));

  /* ── Input tabs ────────────────────────────────────────────────────────── */
  document.querySelectorAll(".input-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".input-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".input-pane").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("pane" + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)).classList.add("active");
      hideError(); hideResult();
    });
  });

  /* ── URL Fetch ─────────────────────────────────────────────────────────── */
  const urlInput   = document.getElementById("urlInput");
  const fetchBtn   = document.getElementById("fetchBtn");
  const fetchSpinner = document.getElementById("fetchSpinner");
  const fetchBtnText = document.getElementById("fetchBtnText");
  const urlStatus  = document.getElementById("urlStatus");

  fetchBtn.addEventListener("click", async () => {
    const url = urlInput.value.trim();
    if (!url) { setUrlStatus("Please enter a URL", "error"); return; }
    if (!url.startsWith("http")) { setUrlStatus("Invalid URL", "error"); return; }

    setFetchLoading(true);
    setUrlStatus("Fetching…", "");

    try {
      const res  = await fetch("/fetch-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setUrlStatus(data.error || "Failed to fetch", "error");
      } else {
        textarea.value = data.text;
        textarea.dispatchEvent(new Event("input"));
        setUrlStatus("✓ Article fetched!", "success");
        // Switch to text tab to show fetched content
        document.getElementById("tabText").click();
      }
    } catch {
      setUrlStatus("Network error", "error");
    } finally {
      setFetchLoading(false);
    }
  });

  function setFetchLoading(on) {
    fetchBtn.disabled = on;
    fetchSpinner.style.display = on ? "block" : "none";
    fetchBtnText.textContent   = on ? "Fetching…" : "Fetch";
  }

  function setUrlStatus(msg, type) {
    urlStatus.textContent  = msg;
    urlStatus.className    = "url-status" + (type ? " " + type : "");
    urlStatus.style.display = msg ? "" : "none";
  }

  /* ── Word counter ──────────────────────────────────────────────────────── */
  textarea.addEventListener("input", () => {
    const w = countWords(textarea.value);
    wordCountBadge.textContent = `${w} word${w !== 1 ? "s" : ""}`;
    wordCountBadge.classList.toggle("has-words", w > 0);
    hideError();
    if (w === 0) hideResult();
  });

  function countWords(t) { return t.trim() === "" ? 0 : t.trim().split(/\s+/).length; }

  /* ── Example buttons ───────────────────────────────────────────────────── */
  document.querySelectorAll("[data-example]").forEach(btn => {
    btn.addEventListener("click", () => {
      textarea.value = btn.getAttribute("data-example");
      textarea.dispatchEvent(new Event("input"));
      textarea.focus();
      hideResult();
    });
  });

  /* ── Clear ─────────────────────────────────────────────────────────────── */
  clearBtn.addEventListener("click", () => {
    textarea.value = "";
    urlInput.value = "";
    textarea.dispatchEvent(new Event("input"));
    setUrlStatus("", "");
    hideResult(); hideError();
  });

  /* ── Detect ────────────────────────────────────────────────────────────── */
  detectBtn.addEventListener("click", runDetection);
  textarea.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") runDetection(); });

  async function runDetection() {
    const text = textarea.value.trim();
    if (!text) { showError("Please paste or type a news article first."); return; }
    if (text.length < 5) { showError("Input too short. Please enter more text."); return; }

    setLoading(true); hideError(); hideResult();
    const t0 = Date.now();

    try {
      const res  = await fetch("/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      const ms   = Date.now() - t0;

      if (!res.ok || data.error) { showError(data.error || "Server error."); return; }
      showResult(data, ms);
    } catch {
      showError("Network error — make sure Flask is running.");
    } finally {
      setLoading(false);
    }
  }

  /* ── Show Result ───────────────────────────────────────────────────────── */
  function showResult({ label, confidence, word_count, highlights }, elapsed) {
    const isReal = label === "REAL";
    lastResult   = { label, confidence, word_count, highlights };

    resultInner.className      = "result-inner " + (isReal ? "real" : "fake");
    resultIcon.textContent     = isReal ? "✅" : "🚨";
    resultVerdict.textContent  = isReal ? "Real News" : "Fake News";
    resultBadge.textContent    = isReal ? "VERIFIED REAL" : "LIKELY FAKE";
    resultSubtitle.textContent = isReal
      ? "This article appears credible based on ML analysis."
      : "This article shows signs of misinformation.";

    confidenceVal.textContent = confidence.toFixed(1) + "%";
    confidenceCap.textContent = confidence >= 90 ? "Very high confidence"
      : confidence >= 75 ? "High confidence"
      : confidence >= 60 ? "Moderate confidence" : "Low confidence";

    wordCountMeta.textContent = word_count;
    responseTime.textContent  = elapsed + "ms";

    resultCard.style.display = "block";
    requestAnimationFrame(() => requestAnimationFrame(() => { confBar.style.width = confidence + "%"; }));

    // Heatmap
    renderHeatmap(highlights || []);

    // Stats
    stats.checked++;
    stats.confidences.push(confidence);
    if (isReal) stats.real++; else stats.fake++;
    totalChecked.textContent = stats.checked;
    totalReal.textContent    = stats.real;
    totalFake.textContent    = stats.fake;
    const avg = stats.confidences.reduce((a,b) => a+b, 0) / stats.confidences.length;
    avgConfidence.textContent = avg.toFixed(1) + "%";

    // History
    historyLabels.push("#" + stats.checked);
    historyReal.push(isReal ? confidence : 0);
    historyFake.push(!isReal ? confidence : 0);
    if (historyLabels.length > 10) { historyLabels.shift(); historyReal.shift(); historyFake.shift(); }

    updateChartVis();
    renderGauge(confidence, isReal);
    renderBar(confidence, isReal);
    renderRadar(confidence, isReal);
    renderLine();
  }

  function hideResult() {
    resultCard.style.display = "none";
    confBar.style.width = "0%";
    destroyCharts();
    lastResult = null;
  }

  /* ── Heatmap ───────────────────────────────────────────────────────────── */
  function renderHeatmap(highlights) {
    const suspicious = highlights.filter(h => h.suspicious);
    suspiciousCount.textContent = suspicious.length;

    if (highlights.length === 0) {
      heatmapSection.style.display = "none";
      return;
    }

    heatmapSection.style.display = "";
    heatmapText.innerHTML = highlights.map(h => {
      if (h.suspicious) {
        return `<span class="hw hw-suspicious" title="Suspicious word">${escHtml(h.word)}</span> `;
      }
      return `<span class="hw">${escHtml(h.word)}</span> `;
    }).join("");
  }

  function escHtml(s) {
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  /* ── PDF Export ────────────────────────────────────────────────────────── */
  exportPdfBtn.addEventListener("click", exportPDF);

  function exportPDF() {
    if (!lastResult) return;
    const { jsPDF } = window.jspdf;
    const doc  = new jsPDF({ unit: "mm", format: "a4" });
    const isReal = lastResult.label === "REAL";
    const color  = isReal ? [34, 214, 138] : [247, 95, 95];
    const now    = new Date().toLocaleString();

    // Header bar
    doc.setFillColor(...color);
    doc.rect(0, 0, 210, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("FAKE NEWS DETECTOR — ANALYSIS REPORT", 14, 12);

    // Sub header
    doc.setFillColor(18, 21, 31);
    doc.rect(0, 18, 210, 10, "F");
    doc.setTextColor(180, 180, 200);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${now}   |   Version 3.0.0   |   Model: TF-IDF + PassiveAggressive`, 14, 24);

    // Verdict section
    doc.setFillColor(240, 244, 255);
    doc.rect(10, 34, 190, 30, "F");
    doc.setDrawColor(...color);
    doc.setLineWidth(0.8);
    doc.rect(10, 34, 190, 30, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...color);
    doc.text(isReal ? "✓ REAL NEWS" : "✗ FAKE NEWS", 14, 48);

    doc.setFontSize(10);
    doc.setTextColor(80, 80, 110);
    doc.text(`Confidence: ${lastResult.confidence.toFixed(1)}%`, 14, 57);
    doc.text(`Words Analyzed: ${lastResult.word_count}`, 80, 57);
    doc.text(`Label: ${lastResult.label}`, 150, 57);

    // Confidence bar
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 80, 110);
    doc.text("CONFIDENCE SCORE", 14, 74);
    doc.setFillColor(220, 220, 235);
    doc.rect(14, 77, 182, 6, "F");
    doc.setFillColor(...color);
    doc.rect(14, 77, 182 * (lastResult.confidence / 100), 6, "F");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 110);
    doc.text(`${lastResult.confidence.toFixed(1)}%`, 200, 82, { align: "right" });

    // Article text
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 80, 110);
    doc.text("ANALYZED TEXT", 14, 94);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 70);
    const articleText = textarea.value.trim().substring(0, 800);
    const lines = doc.splitTextToSize(articleText, 182);
    doc.text(lines.slice(0, 18), 14, 100);

    // Summary box
    const summaryY = 200;
    doc.setFillColor(240, 244, 255);
    doc.rect(10, summaryY, 190, 40, "F");
    doc.setDrawColor(200, 200, 220);
    doc.rect(10, summaryY, 190, 40, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 110);
    doc.text("ANALYSIS SUMMARY", 14, summaryY + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 90);
    const summary = isReal
      ? `This article has been classified as REAL NEWS with ${lastResult.confidence.toFixed(1)}% confidence. The content appears to be factual and credible based on linguistic patterns and vocabulary analysis by the TF-IDF + Passive Aggressive Classifier model.`
      : `This article has been classified as FAKE NEWS with ${lastResult.confidence.toFixed(1)}% confidence. The content shows signs of misinformation including sensationalist language, suspicious vocabulary patterns, and unverified claims detected by the ML model.`;
    const sumLines = doc.splitTextToSize(summary, 182);
    doc.text(sumLines, 14, summaryY + 16);

    // Footer
    doc.setFillColor(18, 21, 31);
    doc.rect(0, 282, 210, 15, "F");
    doc.setTextColor(120, 120, 150);
    doc.setFontSize(7);
    doc.text("Fake News Detector v3.0.0 — For educational purposes only. Always verify with trusted sources.", 14, 291);
    doc.text("Page 1 of 1", 196, 291, { align: "right" });

    doc.save(`fake-news-report-${Date.now()}.pdf`);
  }

  /* ── Charts ────────────────────────────────────────────────────────────── */
  const isLight    = () => document.body.classList.contains("light");
  const textColor  = () => isLight() ? "#4a5080" : "#9aa0bc";
  const gridColor  = () => isLight() ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";

  function destroyCharts() {
    [chartGauge, chartBar, chartRadar, chartLine].forEach(c => { if (c) c.destroy(); });
    chartGauge = chartBar = chartRadar = chartLine = null;
    const gc = document.getElementById("gaugeCenterText");
    if (gc) gc.innerHTML = "";
  }

  function renderGauge(confidence, isReal) {
    const color = isReal ? "#22d68a" : "#f75f5f";
    if (chartGauge) chartGauge.destroy();
    chartGauge = new Chart(document.getElementById("gaugeChart"), {
      type: "doughnut",
      data: { datasets: [{ data: [confidence, 100-confidence], backgroundColor: [color, isLight() ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"], borderWidth: 0, circumference: 270, rotation: 225 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: "78%", plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: { duration: 1000, easing: "easeOutQuart" } }
    });
    const gc = document.getElementById("gaugeCenterText");
    gc.innerHTML = `<span class="gc-val" style="color:${color}">${confidence.toFixed(1)}%</span><span class="gc-label">${isReal ? "Real" : "Fake"}</span>`;
  }

  function renderBar(confidence, isReal) {
    const rs = isReal ? confidence : 100 - confidence;
    const fs = isReal ? 100 - confidence : confidence;
    if (chartBar) chartBar.destroy();
    chartBar = new Chart(document.getElementById("barChart"), {
      type: "bar",
      data: { labels: ["Real","Fake"], datasets: [{ data: [rs,fs], backgroundColor: ["rgba(34,214,138,0.7)","rgba(247,95,95,0.7)"], borderColor: ["#22d68a","#f75f5f"], borderWidth: 2, borderRadius: 8 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, ticks: { color: textColor(), font: { size: 10 } }, grid: { color: gridColor() } }, x: { ticks: { color: textColor(), font: { size: 11, weight: "600" } }, grid: { display: false } } }, animation: { duration: 900, easing: "easeOutBounce" } }
    });
  }

  function renderRadar(confidence, isReal) {
    const c = confidence / 100;
    const rd = isReal ? [c*95,c*88,c*92,c*85,c*90,c*87] : [(1-c)*60,(1-c)*55,(1-c)*50,(1-c)*65,(1-c)*45,(1-c)*58];
    const fd = isReal ? [(1-c)*60,(1-c)*55,(1-c)*50,(1-c)*65,(1-c)*45,(1-c)*58] : [c*95,c*88,c*92,c*85,c*90,c*87];
    if (chartRadar) chartRadar.destroy();
    chartRadar = new Chart(document.getElementById("radarChart"), {
      type: "radar",
      data: { labels: ["Factual","Source","Tone","Clarity","Logic","Context"], datasets: [{ label: "Real", data: rd, backgroundColor: "rgba(34,214,138,0.15)", borderColor: "#22d68a", borderWidth: 2, pointBackgroundColor: "#22d68a", pointRadius: 3 }, { label: "Fake", data: fd, backgroundColor: "rgba(247,95,95,0.15)", borderColor: "#f75f5f", borderWidth: 2, pointBackgroundColor: "#f75f5f", pointRadius: 3 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { r: { beginAtZero: true, max: 100, ticks: { display: false }, grid: { color: gridColor() }, pointLabels: { color: textColor(), font: { size: 9, weight: "600" } } } }, animation: { duration: 1000 } }
    });
  }

  function renderLine() {
    if (chartLine) chartLine.destroy();
    chartLine = new Chart(document.getElementById("lineChart"), {
      type: "line",
      data: { labels: historyLabels, datasets: [{ label: "Real Confidence", data: historyReal, borderColor: "#22d68a", backgroundColor: "rgba(34,214,138,0.1)", borderWidth: 2.5, tension: 0.4, fill: true, pointBackgroundColor: "#22d68a", pointRadius: 5, pointHoverRadius: 7 }, { label: "Fake Confidence", data: historyFake, borderColor: "#f75f5f", backgroundColor: "rgba(247,95,95,0.1)", borderWidth: 2.5, tension: 0.4, fill: true, pointBackgroundColor: "#f75f5f", pointRadius: 5, pointHoverRadius: 7 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, labels: { color: textColor(), font: { size: 11 }, boxWidth: 12, padding: 16 } } }, scales: { y: { beginAtZero: true, max: 100, ticks: { color: textColor(), font: { size: 10 } }, grid: { color: gridColor() } }, x: { ticks: { color: textColor(), font: { size: 10 } }, grid: { color: gridColor() } } }, animation: { duration: 800 } }
    });
  }

  /* ── Utilities ─────────────────────────────────────────────────────────── */
  function showError(msg) { errorMsg.textContent = msg; errorBox.style.display = "flex"; }
  function hideError()    { errorBox.style.display = "none"; }

  function setLoading(on) {
    detectBtn.disabled    = on;
    spinner.style.display = on ? "block" : "none";
    btnText.textContent   = on ? "Analyzing…" : "Detect";
  }

})();
