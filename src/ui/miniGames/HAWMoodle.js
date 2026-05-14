/**
 * HAWMoodle — Fake-Moodle-LMS für HAW Kiel.
 *
 * Statt FakeOS: ein klassisches Web-App-Overlay weil Moodle keine Desktop-OS-Metapher ist.
 *
 * Story: Recruiter klickt aufs HAW-Gebäude → sieht eine Moodle-Login-Seite, automatisch
 * eingeloggt als "Numan Yesil" → Dashboard mit allen aktuellen Modulen.
 */

const CURRICULUM = [
  // Semester 1+2 — aktiv
  { sem: 1, name: "Einführung in die Allgemeine BWL", progress: 100, active: false, img: "📊" },
  { sem: 1, name: "Betriebliches Rechnungswesen WiSe 25/26", progress: 100, active: false, img: "🧮" },
  { sem: 1, name: "Mathematische Grundlagen I WiSe 25/26", progress: 100, active: false, img: "∑" },
  { sem: 1, name: "Einführung in die Wirtschaftsinformatik WiSe 25/26", progress: 100, active: false, img: "💼" },
  { sem: 1, name: "Einführung in die Programmierung WiSe 25/26", progress: 100, active: false, img: "{ }" },
  { sem: 1, name: "Integrationsmodul Capstone WiSe 25/26", progress: 100, active: false, img: "🎯" },
  // Semester 2 — aktuell aktiv
  { sem: 2, name: "Mathematische Grundlagen II SoSe 26", progress: 45, active: true, img: "∫" },
  { sem: 2, name: "Projektmanagement SoSe 26", progress: 32, active: true, img: "📋" },
  { sem: 2, name: "Algorithmen und Datenstrukturen SoSe 26", progress: 28, active: true, img: "🌳" },
  { sem: 2, name: "Soft Skills SoSe 26", progress: 60, active: true, img: "🤝" },
  { sem: 2, name: "Business Intelligence SoSe 26", progress: 18, active: true, img: "📈" },
  { sem: 2, name: "Datenbanksysteme SoSe 26", progress: 25, active: true, img: "🗄" },
];

const PROJEKTMANAGEMENT_MATERIAL = [
  { name: "2026-1-PM-WiInf-Vorlesung", type: "pdf" },
  { name: "2026-2-PM-WiInf-Vorlesung", type: "pdf" },
  { name: "2026-04-01-Pitch", type: "pdf" },
  { name: "2026-3-PM-WiInf-Vorlesung (update)", type: "pdf" },
  { name: "2026-4-PM-WiInf-Vorlesung", type: "pdf" },
  { name: "2026-05-PM-WiInf-Vorlesung", type: "pdf" },
  { name: "2026-6-PM-WiInf-Vorlesung", type: "pdf" },
  { name: "2026-7-PM-WiInf-Vorlesung", type: "pdf" },
  { name: "2026-04-22-notes-uebung", type: "pdf" },
  { name: "2026-8-PM-WiInf-Vorlesung", type: "pdf" },
  { name: "2026-9-PM-WiInf-Vorlesung", type: "pdf" },
  { name: "SMARTE Ziele", type: "txt" },
  { name: "User Stories", type: "txt" },
];

const PROJEKTMANAGEMENT_INFO = `Hier finden Sie Inhalte (Folien und Material) zum Modul "Projektmanagement"!

Veranstaltung für alle Studierende ab dem 18.3.2026:
  • Mittwoch, 16:15 – 17:45 Uhr, ACHTUNG Raumänderung C8 1.04
  • Donnerstag, 14:30 – 16:00 Uhr, ACHTUNG Raumänderung C8 1.04

Nutzen Sie das Forum aktiv für Diskussionen und Unklarheiten, bei Bedarf schreiben Sie mich direkt per E-Mail an Meike.Wocken@haw-kiel.de.`;

export class HAWMoodle {
  constructor(game) {
    this.game = game;
    this.dom = null;
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
    root.className = "haw-root";
    root.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: #1c2128;
      color: #e6e6e6;
      font-family: 'Open Sans', system-ui, sans-serif;
      opacity: 0; transition: opacity 220ms;
      overflow: hidden;
    `;

    const style = document.createElement("style");
    style.textContent = `
      .haw-root *, .haw-root *::before, .haw-root *::after { box-sizing: border-box; }

      .haw-topbar {
        height: 56px;
        background: linear-gradient(90deg, #00b3a4 0%, #007a86 100%);
        display: flex; align-items: center;
        padding: 0 24px;
        gap: 24px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      }
      .haw-logo {
        font-weight: 800; font-size: 17px;
        color: #fff;
        letter-spacing: -0.01em;
      }
      .haw-nav {
        display: flex; gap: 20px;
        font-size: 13px;
      }
      .haw-nav a { color: rgba(255,255,255,0.85); cursor: pointer; }
      .haw-nav a:hover { color: #fff; text-decoration: underline; }
      .haw-user {
        margin-left: auto;
        display: flex; align-items: center; gap: 10px;
        font-size: 13px;
      }
      .haw-avatar {
        width: 32px; height: 32px;
        border-radius: 50%;
        background: #fff; color: #007a86;
        display: flex; align-items: center; justify-content: center;
        font-weight: 700;
      }
      .haw-close {
        background: rgba(0,0,0,0.20);
        border: 0; color: #fff;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      .haw-close:hover { background: rgba(0,0,0,0.4); }

      .haw-content {
        max-width: 1100px; margin: 0 auto;
        padding: 32px 24px 80px;
      }
      .haw-h1 { font-size: 22px; font-weight: 700; margin: 0 0 4px; color: #fff; }
      .haw-h1 + p { margin: 0 0 24px; opacity: 0.8; font-size: 14px; }

      .haw-toolbar {
        display: flex; gap: 10px; margin-bottom: 20px;
        align-items: center;
      }
      .haw-pill {
        padding: 5px 14px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 999px;
        font-size: 12px;
        cursor: pointer;
      }
      .haw-pill.active {
        background: rgba(0, 200, 200, 0.20);
        border-color: rgba(0, 200, 200, 0.50);
        color: #82e5e5;
      }

      .haw-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 16px;
      }
      .haw-card {
        background: #25292f;
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 10px;
        overflow: hidden;
        cursor: pointer;
        transition: transform 150ms, border-color 150ms;
      }
      .haw-card:hover {
        transform: translateY(-3px);
        border-color: rgba(0, 200, 200, 0.40);
      }
      .haw-card-img {
        height: 80px;
        background: linear-gradient(135deg, #00b3a4 0%, #007a86 100%);
        display: flex; align-items: center; justify-content: center;
        font-size: 32px;
      }
      .haw-card.passed .haw-card-img {
        background: linear-gradient(135deg, #4a5160 0%, #2c3038 100%);
        filter: grayscale(0.4);
      }
      .haw-card-body {
        padding: 14px;
      }
      .haw-card-title {
        font-size: 13px;
        font-weight: 600;
        line-height: 1.35;
        margin-bottom: 8px;
      }
      .haw-card-progress {
        height: 4px;
        background: rgba(255,255,255,0.08);
        border-radius: 99px;
        overflow: hidden;
      }
      .haw-card-progress > div {
        height: 100%;
        background: #00b3a4;
        transition: width 300ms;
      }
      .haw-card-progress-label {
        font-size: 11px;
        opacity: 0.6;
        margin-top: 4px;
      }

      /* Course-Detail */
      .haw-course {
        max-width: 900px;
        margin: 0 auto;
      }
      .haw-course-back {
        background: none; border: 0;
        color: #82e5e5;
        cursor: pointer;
        font-size: 13px;
        padding: 0; margin-bottom: 16px;
      }
      .haw-course-tabs {
        display: flex; gap: 28px;
        border-bottom: 2px solid rgba(255,255,255,0.08);
        margin-bottom: 24px;
      }
      .haw-course-tab {
        padding: 12px 0;
        font-size: 14px;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        margin-bottom: -2px;
        opacity: 0.7;
      }
      .haw-course-tab.active {
        opacity: 1;
        border-bottom-color: #00b3a4;
        color: #82e5e5;
      }
      .haw-section {
        background: #25292f;
        border-radius: 8px;
        margin-bottom: 12px;
        overflow: hidden;
      }
      .haw-section-head {
        padding: 12px 16px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        display: flex; justify-content: space-between;
        background: rgba(0, 200, 200, 0.05);
      }
      .haw-section-body {
        padding: 12px 16px;
        font-size: 13px;
        line-height: 1.55;
      }
      .haw-material-item {
        display: flex; align-items: center;
        gap: 10px;
        padding: 8px 4px;
        border-bottom: 1px solid rgba(255,255,255,0.04);
        font-size: 13px;
      }
      .haw-material-item:last-child { border-bottom: 0; }
      .haw-material-icon {
        width: 24px; text-align: center;
        opacity: 0.7;
      }

      @media (max-width: 640px) {
        .haw-nav { display: none; }
        .haw-content { padding: 20px 14px 80px; }
        .haw-grid { grid-template-columns: 1fr; }
      }
    `;
    root.appendChild(style);

    // Topbar
    const topbar = document.createElement("div");
    topbar.className = "haw-topbar";
    topbar.innerHTML = `
      <div class="haw-logo">⚡ HAW Kiel</div>
      <nav class="haw-nav">
        <a>Startseite</a>
        <a>Dashboard</a>
        <a>Meine Kurse</a>
        <a>Kurssuche</a>
      </nav>
      <div class="haw-user">
        <span>Numan Yesil</span>
        <div class="haw-avatar">NY</div>
        <button class="haw-close">✕ Schließen</button>
      </div>
    `;
    root.appendChild(topbar);

    // Content (Dashboard or Course)
    const content = document.createElement("div");
    content.className = "haw-content";
    root.appendChild(content);

    this.dom = { root, topbar, content };

    // Wire close
    topbar.querySelector(".haw-close").addEventListener("click", () => this.close());
    this._onKey = (e) => { if (e.key === "Escape") this.close(); };
    document.addEventListener("keydown", this._onKey);

    this._renderDashboard();
  }

  _renderDashboard() {
    const c = this.dom.content;
    c.innerHTML = `
      <h1 class="haw-h1">Meine Kurse</h1>
      <p>Hallo, Numan Yesil! 👋</p>
      <div class="haw-toolbar">
        <span class="haw-pill active" data-filter="all">Alle</span>
        <span class="haw-pill" data-filter="active">In Bearbeitung</span>
        <span class="haw-pill" data-filter="passed">Abgeschlossen</span>
      </div>
      <div class="haw-grid"></div>
    `;
    const grid = c.querySelector(".haw-grid");

    const renderGrid = (filter) => {
      grid.innerHTML = "";
      let courses = CURRICULUM;
      if (filter === "active") courses = courses.filter((x) => x.active);
      else if (filter === "passed") courses = courses.filter((x) => !x.active);

      for (const course of courses) {
        const card = document.createElement("div");
        card.className = `haw-card ${!course.active && course.progress >= 100 ? "passed" : ""}`;
        card.innerHTML = `
          <div class="haw-card-img">${course.img}</div>
          <div class="haw-card-body">
            <div class="haw-card-title">${course.name}</div>
            <div class="haw-card-progress"><div style="width:${course.progress}%"></div></div>
            <div class="haw-card-progress-label">${course.progress}% abgeschlossen</div>
          </div>
        `;
        card.addEventListener("click", () => this._renderCourse(course));
        grid.appendChild(card);
      }
    };

    c.querySelectorAll(".haw-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        c.querySelectorAll(".haw-pill").forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        renderGrid(pill.dataset.filter);
      });
    });
    renderGrid("all");
  }

  _renderCourse(course) {
    const c = this.dom.content;
    // Sondersache: Projektmanagement hat realistisches Material aus dem Screenshot.
    const isPM = course.name.toLowerCase().includes("projektmanagement");
    const material = isPM ? PROJEKTMANAGEMENT_MATERIAL : null;
    const info = isPM ? PROJEKTMANAGEMENT_INFO :
      `Hier finden Sie Inhalte zum Modul "${course.name}". Aktive Anwesenheit erwartet.\n\nMaterialien werden im Lauf des Semesters hochgeladen.`;

    c.innerHTML = `
      <div class="haw-course">
        <button class="haw-course-back">← Zurück zum Dashboard</button>
        <h1 class="haw-h1">${course.name}</h1>
        <p>${course.progress}% abgeschlossen</p>
        <div class="haw-course-tabs">
          <span class="haw-course-tab active">Kurs</span>
          <span class="haw-course-tab">Teilnehmer/innen</span>
          <span class="haw-course-tab">Bewertungen</span>
          <span class="haw-course-tab">Download Center</span>
        </div>
        <div class="haw-section">
          <div class="haw-section-head">▼ Allgemeines</div>
          <div class="haw-section-body" style="white-space:pre-wrap;">${info}</div>
        </div>
        ${material ? `
        <div class="haw-section">
          <div class="haw-section-head">▼ Material</div>
          <div class="haw-section-body" id="material-list"></div>
        </div>
        ` : ""}
      </div>
    `;
    c.querySelector(".haw-course-back").addEventListener("click", () => this._renderDashboard());

    if (material) {
      const list = c.querySelector("#material-list");
      for (const m of material) {
        const item = document.createElement("div");
        item.className = "haw-material-item";
        const icon = m.type === "pdf" ? "📄" : "📝";
        item.innerHTML = `<span class="haw-material-icon">${icon}</span><span>${m.name}</span>`;
        list.appendChild(item);
      }
    }
  }
}
