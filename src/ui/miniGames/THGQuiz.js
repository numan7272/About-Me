/**
 * THGQuiz — Allgemeinwissen-Quiz aus Sicht des Thor-Heyerdahl-Gymnasiums.
 *
 * Mischung aus Mathe-LK, Englisch-LK, Allgemeinwissen Geschichte/Geografie.
 * 6 Fragen, je 4 Antwort-Optionen. Score am Ende mit Re-Try-Option.
 */

const QUESTIONS = [
  {
    category: "Mathe LK",
    q: "Was ist die Ableitung von f(x) = sin(x²)?",
    options: [
      "2x · cos(x²)",
      "cos(x²)",
      "2 · sin(x)",
      "-cos(x²)",
    ],
    correct: 0,
    explain: "Kettenregel: äußere Ableitung cos(x²) × innere Ableitung 2x = 2x·cos(x²).",
  },
  {
    category: "Mathe LK",
    q: "Welche Aussage über die Funktion f(x) = x³ - 3x ist korrekt?",
    options: [
      "f hat genau einen Wendepunkt bei x=0",
      "f ist auf ganz ℝ monoton steigend",
      "f hat zwei Extremstellen bei x=±1",
      "f hat keine Nullstellen",
    ],
    correct: 2,
    explain: "f'(x) = 3x² - 3 = 0 → x = ±1. Beide sind Extremstellen (lokales Max bei -1, lokales Min bei +1). f hat auch einen Wendepunkt bei 0, aber zwei Extremstellen ist die genauere Aussage.",
  },
  {
    category: "Englisch LK",
    q: "What does the idiom \"to bite the bullet\" mean?",
    options: [
      "To make a quick decision under pressure",
      "To force yourself to do something unpleasant",
      "To take revenge on someone",
      "To save money for a rainy day",
    ],
    correct: 1,
    explain: "Origin: soldiers biting on a bullet during surgery without anesthesia. Means accepting a tough situation you can't avoid.",
  },
  {
    category: "Englisch LK",
    q: "Which sentence is grammatically correct?",
    options: [
      "If I would have known, I would have called.",
      "If I had known, I would have called.",
      "If I knew, I would have called.",
      "If I have known, I would call.",
    ],
    correct: 1,
    explain: "Third conditional: 'If + past perfect, would + have + past participle'. Used for hypothetical situations in the past.",
  },
  {
    category: "Geschichte",
    q: "Welches Ereignis markierte den Beginn des Ersten Weltkriegs?",
    options: [
      "Der Sturm auf die Bastille (1789)",
      "Die Schlacht von Verdun (1916)",
      "Das Attentat auf Erzherzog Franz Ferdinand in Sarajevo (1914)",
      "Die russische Oktoberrevolution (1917)",
    ],
    correct: 2,
    explain: "28. Juni 1914: Gavrilo Princip erschoss den österreichisch-ungarischen Thronfolger in Sarajevo. Daraus eskalierte die Julikrise zum Weltkrieg.",
  },
  {
    category: "Geografie",
    q: "Welcher dieser deutschen Flüsse ist der längste?",
    options: [
      "Rhein",
      "Donau (deutscher Abschnitt)",
      "Elbe",
      "Main",
    ],
    correct: 0,
    explain: "Rhein: 1230 km gesamt, davon 865 km in Deutschland. Donau: 2850 km gesamt, aber nur 647 km in Deutschland. Auf deutschem Gebiet ist der Rhein der längste.",
  },
];

export class THGQuiz {
  constructor(game) {
    this.game = game;
    this.dom = null;
    this.qIndex = 0;
    this.answers = [];   // {chosen, correct}
  }

  open() {
    if (this.dom) return;
    this._buildDom();
    document.body.appendChild(this.dom.root);
    requestAnimationFrame(() => { this.dom.root.style.opacity = "1"; });
  }

  close() {
    if (!this.dom) return;
    document.removeEventListener("keydown", this._onKey);
    this.dom.root.style.opacity = "0";
    const r = this.dom.root;
    this.dom = null;
    setTimeout(() => r.remove(), 220);
  }

  _buildDom() {
    const root = document.createElement("div");
    root.className = "thg-root";
    root.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: linear-gradient(135deg, #4c2882 0%, #2c1b5c 50%, #1a0f3a 100%);
      color: #f0f5fa;
      font-family: 'Inter', system-ui, sans-serif;
      opacity: 0; transition: opacity 220ms;
      overflow: auto;
      padding: 20px;
    `;

    const style = document.createElement("style");
    style.textContent = `
      .thg-root *, .thg-root *::before, .thg-root *::after { box-sizing: border-box; }
      .thg-card {
        max-width: 640px;
        margin: 40px auto;
        background: rgba(20, 12, 38, 0.85);
        backdrop-filter: blur(14px);
        border: 1px solid rgba(167, 139, 250, 0.22);
        border-radius: 16px;
        padding: 32px 28px;
        box-shadow: 0 24px 60px rgba(0,0,0,0.5);
      }
      .thg-head {
        display: flex; justify-content: space-between;
        align-items: center; margin-bottom: 24px;
      }
      .thg-logo {
        display: flex; align-items: center; gap: 10px;
        font-size: 13px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #c4b5fd;
      }
      .thg-close {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.10);
        color: #fff;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
      }
      .thg-close:hover { background: rgba(255,80,80,0.20); border-color: rgba(255,80,80,0.40); }

      .thg-progress {
        height: 4px;
        background: rgba(255,255,255,0.08);
        border-radius: 99px;
        overflow: hidden;
        margin-bottom: 24px;
      }
      .thg-progress > div {
        height: 100%;
        background: linear-gradient(90deg, #a78bfa, #c4b5fd);
        transition: width 320ms;
      }

      .thg-category {
        display: inline-block;
        padding: 3px 10px;
        background: rgba(167, 139, 250, 0.15);
        border: 1px solid rgba(167, 139, 250, 0.35);
        border-radius: 999px;
        font-size: 11px;
        color: #c4b5fd;
        margin-bottom: 14px;
        letter-spacing: 0.05em;
      }
      .thg-q {
        font-size: 19px;
        line-height: 1.4;
        font-weight: 600;
        margin: 0 0 22px;
      }
      .thg-options {
        display: flex; flex-direction: column; gap: 10px;
      }
      .thg-opt {
        padding: 14px 16px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 10px;
        cursor: pointer;
        font-size: 14px;
        line-height: 1.45;
        text-align: left;
        color: inherit;
        font-family: inherit;
        transition: all 150ms;
        min-height: 44px;
      }
      .thg-opt:hover {
        background: rgba(167, 139, 250, 0.12);
        border-color: rgba(167, 139, 250, 0.45);
      }
      .thg-opt.right {
        background: rgba(80, 200, 120, 0.20);
        border-color: rgba(80, 200, 120, 0.60);
        color: #b8f0c8;
      }
      .thg-opt.wrong {
        background: rgba(255, 100, 100, 0.18);
        border-color: rgba(255, 100, 100, 0.50);
        color: #ffb0b0;
      }
      .thg-opt:disabled { cursor: default; }

      .thg-explain {
        margin-top: 18px;
        padding: 14px 16px;
        background: rgba(167, 139, 250, 0.08);
        border-left: 3px solid #a78bfa;
        border-radius: 6px;
        font-size: 13px;
        line-height: 1.5;
        color: #d8c8ff;
      }

      .thg-next {
        margin-top: 22px;
        width: 100%;
        padding: 14px;
        background: linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%);
        border: 0;
        border-radius: 10px;
        color: #fff;
        font-weight: 700;
        font-size: 14px;
        cursor: pointer;
        min-height: 44px;
      }
      .thg-next:hover { filter: brightness(1.1); }

      /* Result-Screen */
      .thg-result-score {
        text-align: center;
        font-size: 56px;
        font-weight: 800;
        margin: 20px 0;
        background: linear-gradient(135deg, #a78bfa, #c4b5fd);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }
      .thg-result-msg {
        text-align: center;
        font-size: 15px;
        opacity: 0.85;
        line-height: 1.5;
        margin-bottom: 22px;
      }
      .thg-result-breakdown {
        display: flex; flex-direction: column; gap: 8px;
        margin-bottom: 24px;
      }
      .thg-result-row {
        display: flex; justify-content: space-between;
        padding: 9px 12px;
        background: rgba(255,255,255,0.04);
        border-radius: 6px;
        font-size: 13px;
      }
      .thg-result-row .ok { color: #82d982; }
      .thg-result-row .nok { color: #ffb0b0; }

      @media (max-width: 640px) {
        .thg-card { padding: 22px 18px; margin: 14px auto; }
        .thg-q { font-size: 17px; }
        .thg-result-score { font-size: 44px; }
      }
    `;
    root.appendChild(style);

    const card = document.createElement("div");
    card.className = "thg-card";
    root.appendChild(card);
    this.dom = { root, card };

    this._onKey = (e) => { if (e.key === "Escape") this.close(); };
    document.addEventListener("keydown", this._onKey);

    this._renderQuestion();
  }

  _renderQuestion() {
    const card = this.dom.card;
    const q = QUESTIONS[this.qIndex];
    const progress = ((this.qIndex) / QUESTIONS.length) * 100;

    card.innerHTML = `
      <div class="thg-head">
        <div class="thg-logo">▼ THG · Allgemeinwissen-Quiz</div>
        <button class="thg-close">✕ Beenden</button>
      </div>
      <div class="thg-progress"><div style="width:${progress}%"></div></div>
      <div class="thg-category">${q.category} — Frage ${this.qIndex + 1} / ${QUESTIONS.length}</div>
      <h2 class="thg-q">${this._escape(q.q)}</h2>
      <div class="thg-options"></div>
    `;
    const opts = card.querySelector(".thg-options");
    q.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "thg-opt";
      btn.textContent = opt;
      btn.addEventListener("click", () => this._answer(i, btn, q));
      opts.appendChild(btn);
    });
    card.querySelector(".thg-close").addEventListener("click", () => this.close());
  }

  _answer(chosen, clickedBtn, q) {
    // Sperre alle Buttons
    const opts = this.dom.card.querySelectorAll(".thg-opt");
    opts.forEach((b, i) => {
      b.disabled = true;
      if (i === q.correct) b.classList.add("right");
      else if (i === chosen) b.classList.add("wrong");
    });
    this.answers.push({ chosen, correct: chosen === q.correct, question: q });

    // Explain + Next
    const explain = document.createElement("div");
    explain.className = "thg-explain";
    explain.textContent = q.explain;
    this.dom.card.appendChild(explain);

    const isLast = this.qIndex >= QUESTIONS.length - 1;
    const next = document.createElement("button");
    next.className = "thg-next";
    next.textContent = isLast ? "Auswertung anzeigen →" : "Nächste Frage →";
    next.addEventListener("click", () => {
      this.qIndex++;
      if (this.qIndex >= QUESTIONS.length) {
        this._renderResult();
      } else {
        this._renderQuestion();
      }
    });
    this.dom.card.appendChild(next);
  }

  _renderResult() {
    const card = this.dom.card;
    const score = this.answers.filter((a) => a.correct).length;
    const total = QUESTIONS.length;
    const pct = Math.round((score / total) * 100);

    let msg;
    if (pct === 100) msg = "Perfekt! Du hättest's auch ins Abi-Zeugnis geschafft. 🏆";
    else if (pct >= 80) msg = "Stark — Abi-Niveau. Da hat das Lernen gelohnt.";
    else if (pct >= 60) msg = "Solide. Nicht alles im Kopf, aber das Wichtige sitzt.";
    else if (pct >= 40) msg = "Geht so. Vielleicht nochmal die Erklärungen lesen?";
    else msg = "Autsch. Aber hey, das war Allgemeinwissen-Quiz, kein Bewerbungsgespräch.";

    card.innerHTML = `
      <div class="thg-head">
        <div class="thg-logo">▼ Ergebnis</div>
        <button class="thg-close">✕ Beenden</button>
      </div>
      <div class="thg-result-score">${score} / ${total}</div>
      <div class="thg-result-msg">${msg}</div>
      <div class="thg-result-breakdown"></div>
      <button class="thg-next" data-retry>Nochmal versuchen</button>
    `;
    const breakdown = card.querySelector(".thg-result-breakdown");
    this.answers.forEach((a, i) => {
      const row = document.createElement("div");
      row.className = "thg-result-row";
      row.innerHTML = `
        <span>${i + 1}. ${a.question.category}</span>
        <span class="${a.correct ? "ok" : "nok"}">${a.correct ? "✓ Richtig" : "✗ Falsch"}</span>
      `;
      breakdown.appendChild(row);
    });
    card.querySelector(".thg-close").addEventListener("click", () => this.close());
    card.querySelector("[data-retry]").addEventListener("click", () => {
      this.qIndex = 0;
      this.answers = [];
      this._renderQuestion();
    });
  }

  _escape(s) {
    return String(s).replace(/[&<>]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
  }
}
