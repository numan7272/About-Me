/**
 * stations.js — Walkthrough-Daten in Cybersec-Story-Reihenfolge.
 *
 * Reihenfolge wurde vom HR-Recruiter-Audit festgelegt:
 * Yek (Origin Story) → THG → HAW → Designa → HQ
 *
 * Pro Station drei Klick-Stufen:
 *   1) Was — Rolle, Zeitraum, eine Kern-Headline
 *   2) Konkret gemacht — 2-3 messbare Punkte
 *   3) Skill-Beweis — Tech-Stack als Chips
 *
 * Die Building-IDs (haw, designa, yek, thg, hq) matchen die GLB-Root-Names
 * (HAW_Root, Designa_Root, ...). Die Walkthrough-Reihenfolge ist
 * STORY_ORDER unten — die unterscheidet sich bewusst von alphabetisch.
 */

// Story-Reihenfolge — HR hat empfohlen mit Yek-Pentest zu starten,
// nicht chronologisch. Origin-Story-Hook ist der Differenzierer.
export const STORY_ORDER = ["yek", "thg", "haw", "designa", "hq"];

// Teleport-Punkte pro Station — vom User per Browser-Console abgelesen.
// Beim Walkthrough-flyTo() landet das Bike hier (Vorplatz/Eingang).
// Hq-Spawn ist der Initial-Spawn beim Pageload und gilt auch als TP-Punkt.
export const TELEPORT_POINTS = {
  haw:     [-20.23, 0.20, -23.78],
  designa: [ 40.51, 0.11,  12.91],
  yek:     [  0.54, 0.01,  39.14],
  thg:     [-27.01, 0.03,  34.47],
  hq:      [ -4.38, 1.00,  16.63],
};

// Cinematic Camera-Posen pro Station — vom User in der Console abgelesen.
// Beim Walkthrough-Step fliegt die Camera an `camera` und schaut auf `lookAt`.
// Das gibt jedem Stopp die optimale Eingang-zeigende Perspektive statt
// generischer Iso-Position.
export const STATION_CAMERAS = {
  yek: {
    camera: [9.97, 6.27, 29.27],
    lookAt: [0.54, 1.01, 39.14],
  },
  thg: {
    camera: [-7.20, 5.21, 33.14],
    lookAt: [-26.98, 0.77, 33.60],
  },
  haw: {
    camera: [-15.32, 7.01, -3.99],
    lookAt: [-24.75, 0.52, -20.72],
  },
  designa: {
    camera: [40.60, 7.67, 30.51],
    lookAt: [42.72, 1.19, 12.40],
  },
  hq: {
    camera: [12.69, 7.21, 26.25],
    lookAt: [-4.38, 2.00, 16.63],
  },
};

export const STATIONS = {
  de: {
    yek: {
      id: "yek",
      buildingRoot: "Yek_Root",
      label: "Yek · Familienbetrieb",
      title: "Drei Jahre Gastro, ein Audit.",
      subtitle: "Yek Döner & Pizzeria · Heikendorf",
      timeframe: "01/2022 – 03/2025",
      headline: "Service-Job, Schicht-Verantwortung und das erste richtige Netzwerk-Audit.",
      bullets: [
        "Drei Jahre Service & Tagesgeschäft im Restaurant meines Vaters — von der Theke bis zur Schicht-Verantwortung, ab 16.",
        "Betriebsmanagement nebenher: Einkauf, Kalkulation, Umsatzanalysen, Hygiene.",
        "Pre: WPA2 mit ISP-Default-PSK, Hikvision-Cam ohne Auth-Update, Kasse + Gäste-WLAN im selben /24. Post: Guest-VLAN getrennt, PSK rotiert, Cam-Firmware geupdated, Telnet disabled.",
      ],
      skills: [
        "Network Audit",
        "Wi-Fi Hardening",
        "Kassenführung",
        "Einkauf & Kalkulation",
        "Gästebetreuung",
        "Verantwortung",
      ],
      eggHint: "router",          // triggert Compromised-Router-Egg
      color: "#fb923c",
      accent: "#ef4444",
    },
    thg: {
      id: "thg",
      buildingRoot: "THG_Root",
      label: "THG · Abitur",
      title: "Abitur · THG Kiel",
      subtitle: "Thor Heyerdahl Gymnasium · Kiel",
      timeframe: "09/2016 – 07/2025",
      headline: "Neun Jahre strukturiertes Denken — das Fundament für alles danach.",
      bullets: [
        "Abitur im Juli 2025 — parallel zur Aushilfe im Gastronomiebetrieb meines Vaters.",
        "Leistungskurse Mathe & Englisch — Problemzerlegung auf der einen, klare Kommunikation auf der anderen Seite.",
        "Selbstdisziplin und analytisches Arbeiten als Basis fürs Wirtschaftsinformatik-Studium.",
      ],
      skills: ["Analytisches Denken", "Selbstdisziplin", "Belastbarkeit"],
      color: "#a78bfa",
      accent: "#7c3aed",
    },
    haw: {
      id: "haw",
      buildingRoot: "HAW_Root",
      label: "HAW · B.Sc. Wirtschaftsinformatik",
      title: "B.Sc. Wirtschaftsinformatik",
      subtitle: "HAW Kiel · 2. Semester",
      timeframe: "seit 09/2025",
      headline: "Wirtschaftsinformatik — Brücke zwischen Technik und Geschäft.",
      bullets: [
        "Schwerpunkte: technische Analyse, Programmierung, Datenbanken, Projektmanagement.",
        "Nebenher: Google Cybersecurity Cert (Coursera) seit 02/2026 — als Einstiegs-Vertiefung, parallel zu eigenen Übungen auf PortSwigger / TryHackMe.",
        "Frühere Praktika: GMSH Kiel (Wirtschaftspraktikum, SAP/ITwo/eVergabe, 01-02/2024) und Renault Haussner (Mechaniker-Praktikum, 06/2022).",
      ],
      skills: ["Wirtschaftsinformatik", "Python", "SQL", "Projektmanagement", "Cybersecurity", "Analytisches Denken"],
      color: "#22d3ee",
      accent: "#06b6d4",
    },
    designa: {
      id: "designa",
      buildingRoot: "Designa_Root",
      label: "Designa · Werkstudent QA",
      title: "Werkstudent QA · TestLab",
      subtitle: "Designa Verkehrsleittechnik GmbH · Kiel",
      timeframe: "seit 11/2025",
      headline: "Erste Werkstudentenstelle — Log-Analyse, Hardware-Tests und Jira im Tagesgeschäft.",
      bullets: [
        "Server- und System-Logs analysiert zur Eingrenzung von Fehlerursachen in technischen Testumgebungen.",
        "Incidents in Jira dokumentiert, Debugging unterstützt, SQL-basierte Auswertungen erstellt.",
        "Hardware-Komponenten im Testbetrieb geprüft; zertifiziert als elektrotechnisch unterwiesene Person (EuP).",
      ],
      skills: ["Log-Analyse", "Jira", "SQL", "Hardware-Tests", "Fehlerdiagnose", "EuP"],
      color: "#34d399",
      accent: "#10b981",
    },
    hq: {
      id: "hq",
      buildingRoot: "HQ_Root",
      label: "HQ · Eigene Projekte",
      title: "Was ich gerade baue",
      subtitle: "Zu Hause · self-taught",
      timeframe: "laufend",
      headline: "Vier eigene Projekte, alle self-hosted.",
      bullets: [
        "Synapser — FastAPI-Backend für intelligenten Scheduler, Optimierung mit Google OR-Tools + Heuristiken.",
        "OmniView — News- und Threat-Intelligence-Dashboard (Next.js + GDELT + Multi-AI).",
        "Funke — Self-hosted WebRTC-Plattform (Node.js, Socket.IO, Electron-Desktop-Client).",
        "Dieses Portfolio — Three.js + Rapier3D + Vite, alles eigenhändig gebaut.",
        "Python Learning Log auf GitHub — strukturierter Lernverlauf, tägliche Commits.",
      ],
      skills: ["Python/FastAPI", "React/Next.js", "Three.js", "Docker", "WebRTC", "Self-Hosted"],
      eggHint: "container",          // Container-Egg = Self-Hosted-Beweis
      color: "#f472b6",
      accent: "#ec4899",
    },
  },

  en: {
    yek: {
      id: "yek",
      buildingRoot: "Yek_Root",
      label: "Yek · Family Business",
      title: "Three years, one open router.",
      subtitle: "Yek Döner & Pizzeria · Heikendorf",
      timeframe: "01/2022 – 03/2025",
      headline: "Service job, shift responsibility, and the first real network audit.",
      bullets: [
        "Three years of service & daily operations at my father's restaurant — counter to shift lead, from age 16.",
        "Operations on the side: purchasing, costing, revenue analysis, hygiene compliance.",
        "Pre: WPA2 on ISP-default PSK, Hikvision cam without auth update, register and guest Wi-Fi on the same /24. Post: guest VLAN split off, PSK rotated, cam firmware updated, telnet disabled.",
      ],
      skills: [
        "Network Audit",
        "Wi-Fi Hardening",
        "Cash Handling",
        "Purchasing & Costing",
        "Customer Service",
        "Responsibility",
      ],
      eggHint: "router",
      color: "#fb923c",
      accent: "#ef4444",
    },
    thg: {
      id: "thg",
      buildingRoot: "THG_Root",
      label: "THG · Abitur",
      title: "Abitur · THG Kiel",
      subtitle: "Thor Heyerdahl Gymnasium · Kiel",
      timeframe: "09/2016 – 07/2025",
      headline: "Nine years of structured thinking — the foundation for everything that followed.",
      bullets: [
        "Completed Abitur in July 2025 — alongside part-time work at my father's restaurant.",
        "Advanced courses in Math & English — problem decomposition on one side, clear communication on the other.",
        "Self-discipline and analytical work as the base for my B.Sc. studies.",
      ],
      skills: ["Analytical Thinking", "Self-Discipline", "Resilience"],
      color: "#a78bfa",
      accent: "#7c3aed",
    },
    haw: {
      id: "haw",
      buildingRoot: "HAW_Root",
      label: "HAW · B.Sc. Business Information Systems",
      title: "B.Sc. Business Information Systems",
      subtitle: "HAW Kiel · 2nd Semester",
      timeframe: "since 09/2025",
      headline: "Business Information Systems — bridging technology and business.",
      bullets: [
        "Focus areas: technical analysis, programming, databases, project management.",
        "On the side: Google Cybersecurity Cert (Coursera) since 02/2026 — entry-level specialization, paired with practice on PortSwigger / TryHackMe.",
        "Earlier internships: GMSH Kiel (business internship, SAP/ITwo/eProcurement, 01-02/2024) and Renault Haussner (mechanic internship, 06/2022).",
      ],
      skills: ["Business Informatics", "Python", "SQL", "Project Management", "Cybersecurity", "Analytical Thinking"],
      color: "#22d3ee",
      accent: "#06b6d4",
    },
    designa: {
      id: "designa",
      buildingRoot: "Designa_Root",
      label: "Designa · QA Working Student",
      title: "Working Student · QA TestLab",
      subtitle: "Designa Verkehrsleittechnik GmbH · Kiel",
      timeframe: "since 11/2025",
      headline: "First working-student role — log analysis, hardware testing and Jira in daily operations.",
      bullets: [
        "Analyzed server and system logs to narrow down root causes in technical test environments.",
        "Documented incidents in Jira, supported debugging, ran SQL-based evaluations.",
        "Tested hardware components in lab environments; certified as electrically instructed person (EuP).",
      ],
      skills: ["Log Analysis", "Jira", "SQL", "Hardware Testing", "Diagnostics", "EuP"],
      color: "#34d399",
      accent: "#10b981",
    },
    hq: {
      id: "hq",
      buildingRoot: "HQ_Root",
      label: "HQ · Personal Projects",
      title: "What I'm Building Right Now",
      subtitle: "Home · self-taught",
      timeframe: "Ongoing",
      headline: "Four personal projects, all self-hosted.",
      bullets: [
        "Synapser — FastAPI backend for an intelligent scheduler, optimization with Google OR-Tools + heuristics.",
        "OmniView — news and threat-intelligence dashboard (Next.js + GDELT + multiple AI providers).",
        "Funke — self-hosted WebRTC platform (Node.js, Socket.IO, Electron desktop client).",
        "This portfolio — Three.js + Rapier3D + Vite, built from scratch.",
        "Python Learning Log on GitHub — structured study trace, daily commits.",
      ],
      skills: ["Python/FastAPI", "React/Next.js", "Three.js", "Docker", "WebRTC", "Self-Hosted"],
      eggHint: "container",
      color: "#f472b6",
      accent: "#ec4899",
    },
  },
};

// Kontakt-Daten — werden vom ContactPanel angezeigt.
//
// CV-Download bewusst NICHT enthalten — Lebenslauf wird auf Anfrage
// individuell per E-Mail verschickt. Keine öffentlich gehosteten PDFs mit
// Adresse/Telefon/Geburtsdatum (DSGVO + Best-Practice).
export const CONTACT = {
  email: "hi@numan-yesil.com",
  linkedin: "https://www.linkedin.com/in/numan-yesil-104654152",
  github: "https://github.com/numan7272",
  location: "Kiel, Deutschland",
};

// Walkthrough-UI-Strings
export const WALKTHROUGH_UI = {
  de: {
    start_tour: "Geführte Tour starten",
    free_roam: "Frei erkunden",
    next: "Weiter",
    prev: "Zurück",
    skip: "Tour beenden",
    contact: "Kontakt",
    step_what: "Was",
    step_how: "Konkret gemacht",
    step_stack: "Tech & Skills",
    drawer_hint: "Klick „Weiter\" für die nächste Station",
    intro_title: "Hi, ich bin Numan.",
    intro_body: "20, aus Kiel, studiere Wirtschaftsinformatik. Ich nehme dich kurz mit durch 5 Stationen: Schule, Familienbetrieb, Studium, Werkstudentenjob, eigene Projekte.",
  },
  en: {
    start_tour: "Start guided tour",
    free_roam: "Explore freely",
    next: "Next",
    prev: "Back",
    skip: "End tour",
    contact: "Contact",
    step_what: "What",
    step_how: "What I did",
    step_stack: "Tech & Skills",
    drawer_hint: "Click \"Next\" for the next station",
    intro_title: "Hi, I'm Numan.",
    intro_body: "20, from Kiel, studying Business Information Systems. Let me take you through 5 quick stops: school, family business, university, working student job, side projects.",
  },
};

export function getStationsForLang(lang) {
  return STATIONS[lang === "en" ? "en" : "de"];
}

export function getWalkthroughStrings(lang) {
  return WALKTHROUGH_UI[lang === "en" ? "en" : "de"];
}
