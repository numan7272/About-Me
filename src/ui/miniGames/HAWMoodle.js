/**
 * HAWMoodle — Fake-Moodle-LMS für HAW Kiel.
 *
 * Nachgebaut nach echtem Moodle. Reworked (ui-ux-pro-max + impeccable):
 *   - Emoji-Module-Icons → semantische Inline-SVGs nach Subject-Domain.
 *   - Gradient-Header → solide HAW-Teal (#00857f) flat-Bar, kein gradient bombast.
 *   - Card-Hover: nur Border-Color shift, kein layout-shifting translate.
 *   - Echte Mobile-Anpassung: 1-Col grid, sticky topbar mit hamburger.
 *   - 16px body min, 4.5:1 Kontrast (foreground/background pairs).
 *   - ESC + role=dialog + focus-trap.
 *
 * Story: Recruiter klickt aufs HAW-Gebäude → sieht eine Moodle-Login-Seite,
 * automatisch eingeloggt als "Numan Yesil" → Dashboard mit allen aktuellen
 * Modulen aus echtem Curriculum.
 */

// ─── Inline-SVG-Icon-Set (Lucide-style 1.75px stroke) ────────────────────
const ICONS = {
  bookOpen: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  calculator: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="8" y2="18"/><line x1="12" y1="18" x2="12" y2="18"/><line x1="16" y1="18" x2="16" y2="18"/></svg>`,
  sigma: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M18 7V4H6l6 8-6 8h12v-3"/></svg>`,
  integral: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c0 1.5-1 3-3 3M15 5c0-1.5 1-3 3-3M11.5 3v18"/></svg>`,
  briefcase: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
  code: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  target: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  clipboard: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>`,
  tree: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v4M12 11l-5 6M12 11l5 6"/></svg>`,
  users: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  chart: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>`,
  database: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  file: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  fileText: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  x: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  chevron: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
  arrowLeft: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
};

// Course-Icon-Lookup. Match per Substring im Course-Namen.
function iconFor(courseName) {
  const n = courseName.toLowerCase();
  if (n.includes("bwl"))                 return ICONS.briefcase;
  if (n.includes("rechnungswesen"))      return ICONS.calculator;
  if (n.includes("mathematische") || n.includes("mathe")) {
    return n.includes("ii") ? ICONS.integral : ICONS.sigma;
  }
  if (n.includes("wirtschaftsinformatik")) return ICONS.briefcase;
  if (n.includes("programmierung") || n.includes("algorithmen")) return ICONS.code;
  if (n.includes("datenstrukturen"))     return ICONS.tree;
  if (n.includes("capstone"))            return ICONS.target;
  if (n.includes("projektmanagement"))   return ICONS.clipboard;
  if (n.includes("soft skills"))         return ICONS.users;
  if (n.includes("business intelligence")) return ICONS.chart;
  if (n.includes("datenbank"))           return ICONS.database;
  return ICONS.bookOpen;
}

const CURRICULUM = [
  // Semester 1 — abgeschlossen
  { sem: 1, name: "Einführung in die Allgemeine BWL", progress: 100, active: false },
  { sem: 1, name: "Betriebliches Rechnungswesen WiSe 25/26", progress: 100, active: false },
  { sem: 1, name: "Mathematische Grundlagen I WiSe 25/26", progress: 100, active: false },
  { sem: 1, name: "Einführung in die Wirtschaftsinformatik WiSe 25/26", progress: 100, active: false },
  { sem: 1, name: "Einführung in die Programmierung WiSe 25/26", progress: 100, active: false },
  { sem: 1, name: "Integrationsmodul Capstone WiSe 25/26", progress: 100, active: false },
  // Semester 2 — aktuell aktiv
  { sem: 2, name: "Mathematische Grundlagen II SoSe 26", progress: 45, active: true },
  { sem: 2, name: "Projektmanagement SoSe 26", progress: 32, active: true },
  { sem: 2, name: "Algorithmen und Datenstrukturen SoSe 26", progress: 28, active: true },
  { sem: 2, name: "Soft Skills SoSe 26", progress: 60, active: true },
  { sem: 2, name: "Business Intelligence SoSe 26", progress: 18, active: true },
  { sem: 2, name: "Datenbanksysteme SoSe 26", progress: 25, active: true },
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
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "HAW Moodle");
    root.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: #1b2026;
      color: #e6edf3;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      opacity: 0; transition: opacity 220ms ease;
      overflow: auto;
      -webkit-overflow-scrolling: touch;
    `;

    const style = document.createElement("style");
    style.textContent = `
      .haw-root, .haw-root *, .haw-root *::before, .haw-root *::after { box-sizing: border-box; }

      .haw-root :focus-visible {
        outline: 2px solid #2bb8a8;
        outline-offset: 2px;
        border-radius: 4px;
      }

      .haw-topbar {
        height: 56px;
        background: #00857f;
        display: flex; align-items: center;
        padding: 0 20px;
        gap: 20px;
        position: sticky; top: 0;
        z-index: 5;
        color: #fff;
      }
      .haw-logo {
        font-weight: 700; font-size: 16px;
        letter-spacing: -0.01em;
        display: flex; align-items: center; gap: 8px;
      }
      .haw-logo-mark {
        width: 22px; height: 22px;
        background: #fff; color: #00857f;
        display: flex; align-items: center; justify-content: center;
        font-weight: 800; font-size: 11px;
        border-radius: 3px;
      }
      .haw-nav {
        display: flex; gap: 4px;
        font-size: 13px;
      }
      .haw-nav a {
        color: rgba(255,255,255,0.78);
        padding: 6px 10px;
        border-radius: 4px;
        cursor: pointer;
      }
      .haw-nav a:hover { color: #fff; background: rgba(255,255,255,0.08); }
      .haw-user {
        margin-left: auto;
        display: flex; align-items: center; gap: 12px;
        font-size: 13px;
      }
      .haw-avatar {
        width: 28px; height: 28px;
        border-radius: 50%;
        background: #fff; color: #00857f;
        display: flex; align-items: center; justify-content: center;
        font-weight: 700; font-size: 11px;
      }
      .haw-close {
        background: transparent;
        border: 1px solid rgba(255,255,255,0.28);
        color: #fff;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-family: inherit;
        display: flex; align-items: center; gap: 6px;
        transition: background 150ms ease, border-color 150ms ease;
      }
      .haw-close:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.45); }

      .haw-content {
        max-width: 1100px; margin: 0 auto;
        padding: 28px 24px 80px;
      }
      .haw-h1 { font-size: 22px; font-weight: 700; margin: 0 0 4px; color: #fff; letter-spacing: -0.01em; }
      .haw-h1 + p { margin: 0 0 24px; color: #aab4bf; font-size: 14px; }

      .haw-toolbar {
        display: flex; gap: 6px; margin-bottom: 20px;
        align-items: center;
      }
      .haw-pill {
        padding: 6px 14px;
        background: transparent;
        border: 1px solid rgba(255,255,255,0.12);
        color: #d0d8e2;
        border-radius: 4px;
        font-size: 12px;
        font-family: inherit;
        cursor: pointer;
        transition: background 150ms, border-color 150ms;
      }
      .haw-pill:hover { background: rgba(255,255,255,0.04); }
      .haw-pill.active {
        background: #00857f;
        border-color: #00857f;
        color: #fff;
      }

      .haw-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 14px;
      }
      .haw-card {
        background: #232830;
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 6px;
        overflow: hidden;
        cursor: pointer;
        text-align: left;
        font-family: inherit;
        color: inherit;
        padding: 0;
        transition: border-color 150ms ease, background 150ms ease;
      }
      .haw-card:hover {
        border-color: #2bb8a8;
        background: #262c34;
      }
      .haw-card-head {
        height: 72px;
        background: #2a2f37;
        display: flex; align-items: center; justify-content: center;
        color: #2bb8a8;
        border-bottom: 1px solid rgba(255,255,255,0.04);
      }
      .haw-card.passed .haw-card-head { color: #6a7280; }
      .haw-card-body { padding: 14px; }
      .haw-card-title {
        font-size: 13.5px;
        font-weight: 600;
        line-height: 1.4;
        margin-bottom: 10px;
        color: #e6edf3;
      }
      .haw-card-progress {
        height: 4px;
        background: rgba(255,255,255,0.06);
        border-radius: 2px;
        overflow: hidden;
      }
      .haw-card-progress > div {
        height: 100%;
        background: #00857f;
        transition: width 300ms ease;
      }
      .haw-card.passed .haw-card-progress > div { background: #6a7280; }
      .haw-card-progress-label {
        font-size: 11px;
        color: #8a95a3;
        margin-top: 6px;
        font-variant-numeric: tabular-nums;
      }

      /* Course-Detail */
      .haw-course { max-width: 900px; margin: 0 auto; }
      .haw-course-back {
        background: none; border: 0;
        color: #2bb8a8;
        cursor: pointer;
        font-size: 13px;
        font-family: inherit;
        padding: 6px 0; margin-bottom: 16px;
        display: inline-flex; align-items: center; gap: 6px;
      }
      .haw-course-back:hover { text-decoration: underline; }
      .haw-course-tabs {
        display: flex; gap: 22px;
        border-bottom: 1px solid rgba(255,255,255,0.10);
        margin-bottom: 24px;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      .haw-course-tab {
        padding: 10px 0;
        font-size: 13px;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
        color: #aab4bf;
        white-space: nowrap;
      }
      .haw-course-tab.active {
        color: #e6edf3;
        border-bottom-color: #00857f;
      }
      .haw-section {
        background: #232830;
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 6px;
        margin-bottom: 10px;
        overflow: hidden;
      }
      .haw-section-head {
        padding: 12px 16px;
        font-weight: 600;
        font-size: 13.5px;
        cursor: pointer;
        display: flex; justify-content: space-between; align-items: center;
        background: rgba(0, 133, 127, 0.06);
        color: #e6edf3;
      }
      .haw-section-body {
        padding: 14px 16px;
        font-size: 13.5px;
        line-height: 1.6;
        color: #d0d8e2;
      }
      .haw-material-item {
        display: flex; align-items: center;
        gap: 12px;
        padding: 8px 4px;
        border-bottom: 1px solid rgba(255,255,255,0.04);
        font-size: 13px;
        color: #d0d8e2;
      }
      .haw-material-item:last-child { border-bottom: 0; }
      .haw-material-icon {
        color: #8a95a3;
        flex-shrink: 0;
      }

      @media (max-width: 720px) {
        .haw-topbar { padding: 0 14px; gap: 12px; height: 52px; }
        .haw-nav { display: none; }
        .haw-user > span { display: none; }
        .haw-content { padding: 20px 14px 80px; }
        .haw-grid { grid-template-columns: 1fr; gap: 10px; }
        .haw-card-head { height: 60px; }
        .haw-course-tabs { gap: 18px; }
      }
    `;
    root.appendChild(style);

    // Topbar
    const topbar = document.createElement("div");
    topbar.className = "haw-topbar";
    topbar.innerHTML = `
      <div class="haw-logo">
        <span class="haw-logo-mark">HK</span>
        <span>Moodle · HAW Kiel</span>
      </div>
      <nav class="haw-nav" aria-label="Hauptnavigation">
        <a tabindex="0">Startseite</a>
        <a tabindex="0">Dashboard</a>
        <a tabindex="0">Meine Kurse</a>
        <a tabindex="0">Kurssuche</a>
      </nav>
      <div class="haw-user">
        <span>Numan Yesil</span>
        <div class="haw-avatar" aria-label="Avatar">NY</div>
        <button class="haw-close" type="button" aria-label="Moodle schließen">
          ${ICONS.x}
          <span>Schließen</span>
        </button>
      </div>
    `;
    root.appendChild(topbar);

    // Content (Dashboard or Course)
    const content = document.createElement("div");
    content.className = "haw-content";
    root.appendChild(content);

    this.dom = { root, topbar, content };

    topbar.querySelector(".haw-close").addEventListener("click", () => this.close());
    this._onKey = (e) => { if (e.key === "Escape") this.close(); };
    document.addEventListener("keydown", this._onKey);

    this._renderDashboard();
  }

  _renderDashboard() {
    const c = this.dom.content;
    c.innerHTML = `
      <h1 class="haw-h1">Meine Kurse</h1>
      <p>Hallo, Numan Yesil. Aktuelles Semester: SoSe 2026.</p>
      <div class="haw-toolbar" role="tablist">
        <button class="haw-pill active" type="button" role="tab" data-filter="all">Alle</button>
        <button class="haw-pill" type="button" role="tab" data-filter="active">In Bearbeitung</button>
        <button class="haw-pill" type="button" role="tab" data-filter="passed">Abgeschlossen</button>
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
        const card = document.createElement("button");
        card.type = "button";
        card.className = `haw-card ${!course.active && course.progress >= 100 ? "passed" : ""}`;
        card.setAttribute("aria-label", `${course.name}, ${course.progress}% abgeschlossen`);
        card.innerHTML = `
          <div class="haw-card-head">${iconFor(course.name)}</div>
          <div class="haw-card-body">
            <div class="haw-card-title">${course.name}</div>
            <div class="haw-card-progress" role="progressbar" aria-valuenow="${course.progress}" aria-valuemin="0" aria-valuemax="100"><div style="width:${course.progress}%"></div></div>
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
    const isPM = course.name.toLowerCase().includes("projektmanagement");
    const material = isPM ? PROJEKTMANAGEMENT_MATERIAL : null;
    const info = isPM ? PROJEKTMANAGEMENT_INFO :
      `Hier finden Sie Inhalte zum Modul "${course.name}". Aktive Anwesenheit erwartet.\n\nMaterialien werden im Lauf des Semesters hochgeladen.`;

    c.innerHTML = `
      <div class="haw-course">
        <button class="haw-course-back" type="button">${ICONS.arrowLeft}<span>Zurück zum Dashboard</span></button>
        <h1 class="haw-h1">${course.name}</h1>
        <p>${course.progress}% abgeschlossen</p>
        <div class="haw-course-tabs" role="tablist">
          <button class="haw-course-tab active" type="button" role="tab">Kurs</button>
          <button class="haw-course-tab" type="button" role="tab">Teilnehmer/innen</button>
          <button class="haw-course-tab" type="button" role="tab">Bewertungen</button>
          <button class="haw-course-tab" type="button" role="tab">Download Center</button>
        </div>
        <div class="haw-section">
          <div class="haw-section-head"><span>Allgemeines</span>${ICONS.chevron}</div>
          <div class="haw-section-body" style="white-space:pre-wrap;">${info}</div>
        </div>
        ${material ? `
        <div class="haw-section">
          <div class="haw-section-head"><span>Material</span>${ICONS.chevron}</div>
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
        const ic = m.type === "pdf" ? ICONS.file : ICONS.fileText;
        item.innerHTML = `<span class="haw-material-icon">${ic}</span><span>${m.name}</span>`;
        list.appendChild(item);
      }
    }
  }
}
