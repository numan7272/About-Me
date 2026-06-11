/**
 * THGQuiz — Allgemeinwissen-Quiz aus Sicht des Thor-Heyerdahl-Gymnasiums.
 *
 * Reworked (ui-ux-pro-max + impeccable): academic paper, kein Gradient-Glas.
 *   - Background: cream paper (oklch warm) statt blue-purple gradient.
 *   - Question heading: italic mono (kohärent mit 3D-Station-Labels).
 *   - Options: sans body.
 *   - THG-Violett nur als gezielter Akzent (selected, progress, signal).
 *   - Korrekt/Falsch: SVG-Check/X, nicht ✓/✗ Unicode.
 *   - Result-Score: tabular-mono Zahl, kein gradient-text-hack.
 *   - 16px body min, A11y: role=dialog, aria-live, focus-trap, ESC.
 *
 * Mischung Mathe-LK, Englisch-LK, Allgemeinwissen.
 * 6 Fragen, je 4 Antwort-Optionen. Score am Ende mit Re-Try.
 */

const THG_INK   = "oklch(18% 0.012 250)";
const THG_PAPER = "oklch(94% 0.018 75)";
const THG_PAPER_SOFT = "oklch(96% 0.012 75)";
const THG_MUTED = "oklch(45% 0.015 70)";
const THG_DIM   = "oklch(60% 0.012 70)";
const THG_RULE  = "oklch(18% 0.012 250 / 0.15)";
const THG_VIOLET = "#6d4cd1";       // calmer than the original #a78bfa
const THG_VIOLET_TINT = "rgba(109, 76, 209, 0.10)";
const THG_GREEN = "#2d8a4f";
const THG_RED   = "#c93f3f";

const ICONS = {
  check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  x: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  arrow: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
};

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
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "THG Allgemeinwissen-Quiz");
    root.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: ${THG_PAPER};
      color: ${THG_INK};
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      opacity: 0; transition: opacity 220ms ease;
      overflow: auto;
      -webkit-overflow-scrolling: touch;
      padding: 24px 16px 48px;
    `;

    const style = document.createElement("style");
    style.textContent = `
      .thg-root, .thg-root *, .thg-root *::before, .thg-root *::after { box-sizing: border-box; }
      .thg-root :focus-visible {
        outline: 2px solid ${THG_VIOLET};
        outline-offset: 2px;
        border-radius: 2px;
      }

      .thg-card {
        max-width: 640px;
        margin: 24px auto;
        background: ${THG_PAPER_SOFT};
        border: 1px solid ${THG_RULE};
        border-top: 4px solid ${THG_VIOLET};
        border-radius: 10px;
        box-shadow: 0 14px 40px rgba(40, 30, 70, 0.10);
        padding: 28px 32px;
      }
      .thg-school {
        font-weight: 700;
        font-size: 14px;
        color: ${THG_INK};
        line-height: 1.2;
      }
      .thg-school small {
        display: block;
        font-weight: 400;
        font-size: 11.5px;
        color: ${THG_MUTED};
        margin-top: 2px;
      }
      .thg-head {
        display: flex; justify-content: space-between;
        align-items: center; margin-bottom: 22px;
        gap: 12px;
      }
      .thg-logo {
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 11px;
        letter-spacing: 0.04em;
        color: ${THG_MUTED};
      }
      .thg-close {
        background: transparent;
        border: 1px solid ${THG_RULE};
        border-radius: 6px;
        color: ${THG_MUTED};
        padding: 6px 12px;
        font-size: 11.5px;
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        cursor: pointer;
        display: flex; align-items: center; gap: 6px;
        min-height: 32px;
        transition: color 150ms, border-color 150ms;
      }
      .thg-close:hover { color: ${THG_INK}; border-color: ${THG_MUTED}; }

      .thg-progress-wrap {
        display: flex; align-items: center; gap: 12px;
        margin-bottom: 22px;
      }
      .thg-progress {
        flex: 1;
        height: 6px;
        border-radius: 3px;
        background: ${THG_RULE};
        overflow: hidden;
      }
      .thg-progress > div { border-radius: 3px; }
      .thg-progress > div {
        height: 100%;
        background: ${THG_VIOLET};
        transition: width 320ms cubic-bezier(0.16, 1, 0.3, 1);
      }
      .thg-progress-text {
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 11px;
        color: ${THG_MUTED};
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      .thg-category {
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 11px;
        color: ${THG_VIOLET};
        margin-bottom: 12px;
        text-transform: lowercase;
        letter-spacing: 0.04em;
      }
      .thg-q {
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-style: italic;
        font-size: 22px;
        line-height: 1.45;
        font-weight: 500;
        color: ${THG_INK};
        margin: 0 0 24px;
        letter-spacing: -0.005em;
      }
      .thg-options {
        display: flex; flex-direction: column; gap: 8px;
      }
      .thg-opt {
        padding: 12px 14px;
        background: #fff;
        border: 1px solid ${THG_RULE};
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        line-height: 1.5;
        text-align: left;
        color: ${THG_INK};
        font-family: inherit;
        transition: border-color 150ms, background 150ms;
        min-height: 48px;
        display: flex; align-items: center; gap: 12px;
      }
      .thg-opt-letter {
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 12px;
        color: ${THG_VIOLET};
        flex-shrink: 0;
        width: 28px; height: 28px;
        border: 1px solid ${THG_RULE};
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        text-transform: uppercase;
        transition: background 150ms, border-color 150ms, color 150ms;
      }
      .thg-opt:hover:not(:disabled) .thg-opt-letter {
        background: ${THG_VIOLET};
        border-color: ${THG_VIOLET};
        color: #fff;
      }
      .thg-opt:hover:not(:disabled) {
        border-color: ${THG_VIOLET};
        background: ${THG_VIOLET_TINT};
      }
      .thg-opt:disabled { cursor: default; }
      .thg-opt.right {
        border-color: ${THG_GREEN};
        background: rgba(45, 138, 79, 0.08);
      }
      .thg-opt.right .thg-opt-letter {
        background: ${THG_GREEN}; border-color: ${THG_GREEN}; color: #fff;
      }
      .thg-opt.right .thg-opt-mark { color: ${THG_GREEN}; }
      .thg-opt.wrong {
        border-color: ${THG_RED};
        background: rgba(201, 63, 63, 0.08);
      }
      .thg-opt.wrong .thg-opt-letter {
        background: ${THG_RED}; border-color: ${THG_RED}; color: #fff;
      }
      .thg-opt.wrong .thg-opt-mark { color: ${THG_RED}; }
      .thg-opt-mark {
        margin-left: auto;
        display: flex; align-items: center;
        color: ${THG_DIM};
      }

      .thg-explain {
        margin-top: 18px;
        padding: 14px 16px;
        background: ${THG_VIOLET_TINT};
        border-left: 3px solid ${THG_VIOLET};
        border-radius: 0 8px 8px 0;
        font-size: 13px;
        line-height: 1.6;
        color: ${THG_INK};
      }

      .thg-next {
        margin-top: 22px;
        width: 100%;
        padding: 14px;
        background: ${THG_VIOLET};
        border: 0;
        border-radius: 8px;
        color: #fff;
        font-weight: 600;
        font-size: 14px;
        font-family: inherit;
        letter-spacing: 0.02em;
        cursor: pointer;
        min-height: 48px;
        display: flex; align-items: center; justify-content: center; gap: 8px;
        transition: background 150ms;
      }
      .thg-next:hover { background: #5a3eb0; }

      /* Result-Screen */
      .thg-result-label {
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 11px;
        color: ${THG_MUTED};
        text-align: center;
        letter-spacing: 0.06em;
        margin-bottom: 6px;
      }
      .thg-result-score {
        text-align: center;
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 64px;
        font-weight: 500;
        color: ${THG_INK};
        line-height: 1;
        margin-bottom: 12px;
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.02em;
      }
      .thg-result-score .denom {
        font-size: 28px;
        color: ${THG_DIM};
      }
      .thg-result-msg {
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-style: italic;
        text-align: center;
        font-size: 14px;
        color: ${THG_MUTED};
        line-height: 1.55;
        margin-bottom: 26px;
        max-width: 440px;
        margin-left: auto; margin-right: auto;
      }
      .thg-result-breakdown {
        display: flex; flex-direction: column;
        margin-bottom: 24px;
        border-top: 1px solid ${THG_RULE};
      }
      .thg-result-row {
        display: flex; justify-content: space-between; align-items: center;
        padding: 10px 4px;
        border-bottom: 1px solid ${THG_RULE};
        font-size: 13px;
      }
      .thg-result-row .label {
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 11px;
        color: ${THG_MUTED};
        margin-right: 8px;
      }
      .thg-result-row .ok { color: ${THG_GREEN}; display: flex; align-items: center; gap: 6px; }
      .thg-result-row .nok { color: ${THG_RED}; display: flex; align-items: center; gap: 6px; }

      @media (max-width: 640px) {
        .thg-card { padding: 20px 16px; margin: 4px auto; }
        .thg-school { font-size: 13px; }
        .thg-q { font-size: 18px; }
        .thg-result-score { font-size: 48px; }
        .thg-result-score .denom { font-size: 22px; }
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
        <div>
          <div class="thg-school">Thor-Heyerdahl-Gymnasium<small>Abi-Quiz · Mathe-LK, Englisch-LK, Allgemeinwissen</small></div>
        </div>
        <button class="thg-close" type="button" aria-label="Quiz beenden">
          ${ICONS.x}<span>Beenden</span>
        </button>
      </div>
      <div class="thg-progress-wrap">
        <div class="thg-progress" role="progressbar" aria-valuenow="${this.qIndex}" aria-valuemin="0" aria-valuemax="${QUESTIONS.length}">
          <div style="width:${progress}%"></div>
        </div>
        <div class="thg-progress-text">${String(this.qIndex + 1).padStart(2, "0")} / ${String(QUESTIONS.length).padStart(2, "0")}</div>
      </div>
      <div class="thg-category">${q.category.toLowerCase()}</div>
      <h2 class="thg-q">${this._escape(q.q)}</h2>
      <div class="thg-options" role="radiogroup" aria-label="Antwort-Optionen"></div>
    `;
    const opts = card.querySelector(".thg-options");
    const letters = ["a", "b", "c", "d", "e"];
    q.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "thg-opt";
      btn.setAttribute("role", "radio");
      btn.innerHTML = `
        <span class="thg-opt-letter">${letters[i]}</span>
        <span>${this._escape(opt)}</span>
      `;
      btn.addEventListener("click", () => this._answer(i, btn, q));
      opts.appendChild(btn);
    });
    card.querySelector(".thg-close").addEventListener("click", () => this.close());
  }

  _answer(chosen, clickedBtn, q) {
    const opts = this.dom.card.querySelectorAll(".thg-opt");
    opts.forEach((b, i) => {
      b.disabled = true;
      if (i === q.correct) {
        b.classList.add("right");
        b.insertAdjacentHTML("beforeend", `<span class="thg-opt-mark">${ICONS.check}</span>`);
      } else if (i === chosen) {
        b.classList.add("wrong");
        b.insertAdjacentHTML("beforeend", `<span class="thg-opt-mark">${ICONS.x}</span>`);
      }
    });
    this.answers.push({ chosen, correct: chosen === q.correct, question: q });

    const explain = document.createElement("div");
    explain.className = "thg-explain";
    explain.textContent = q.explain;
    this.dom.card.appendChild(explain);

    const isLast = this.qIndex >= QUESTIONS.length - 1;
    const next = document.createElement("button");
    next.type = "button";
    next.className = "thg-next";
    next.innerHTML = `<span>${isLast ? "Auswertung anzeigen" : "Nächste Frage"}</span>${ICONS.arrow}`;
    next.addEventListener("click", () => {
      this.qIndex++;
      if (this.qIndex >= QUESTIONS.length) {
        this._renderResult();
      } else {
        this._renderQuestion();
      }
    });
    this.dom.card.appendChild(next);
    setTimeout(() => next.focus(), 80);
  }

  _renderResult() {
    const card = this.dom.card;
    const score = this.answers.filter((a) => a.correct).length;
    const total = QUESTIONS.length;
    const pct = Math.round((score / total) * 100);

    let msg;
    if (pct === 100) msg = "Perfekt. Hätte ich nicht alle auf Anhieb hinbekommen.";
    else if (pct >= 80) msg = "Stark. Da hat das Lernen gelohnt.";
    else if (pct >= 60) msg = "Solide. Nicht alles im Kopf, aber das Wichtige sitzt.";
    else if (pct >= 40) msg = "Geht so. Vielleicht nochmal die Erklärungen lesen?";
    else msg = "Autsch. Aber hey, war Allgemeinwissen-Quiz, kein Bewerbungsgespräch.";

    card.innerHTML = `
      <div class="thg-head">
        <div class="thg-logo">// thg · ergebnis</div>
        <button class="thg-close" type="button" aria-label="Beenden">
          ${ICONS.x}<span>Beenden</span>
        </button>
      </div>
      <div class="thg-result-label">SCORE</div>
      <div class="thg-result-score">${score}<span class="denom">/${total}</span></div>
      <div class="thg-result-msg">${msg}</div>
      <div class="thg-result-breakdown"></div>
      <button class="thg-next" type="button" data-retry><span>Nochmal versuchen</span>${ICONS.arrow}</button>
    `;
    const breakdown = card.querySelector(".thg-result-breakdown");
    this.answers.forEach((a, i) => {
      const row = document.createElement("div");
      row.className = "thg-result-row";
      const num = String(i + 1).padStart(2, "0");
      row.innerHTML = `
        <span><span class="label">${num}</span>${a.question.category}</span>
        <span class="${a.correct ? "ok" : "nok"}">${a.correct ? ICONS.check : ICONS.x}<span>${a.correct ? "Richtig" : "Falsch"}</span></span>
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
