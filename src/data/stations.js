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
import { EXPERIENCE_TOUR } from "./about.js";

export const STORY_ORDER = ["yek", "thg", "haw", "erasmus", "designa", "hq", "security"];

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
      title: "Familienbetrieb & erstes Netzwerk-Audit",
      subtitle: "Yek Döner & Pizzeria · Heikendorf",
      timeframe: "01/2022 – 03/2025",
      headline: "Im Familienbetrieb Verantwortung übernommen und das Netzwerk geprüft.",
      bullets: [
        "Ab 16 im Service und an der Kasse. Nach einem Jahr Schichtleitung.",
        "Einkauf, Preiskalkulation und Umsatzanalysen übernommen.",
        "WLAN-Passwort erneuert, Gästenetz getrennt und Kamera-Firmware aktualisiert.",
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
      timeframe: "09/2016 – 06/2025",
      headline: "Abitur mit Leistungskursen in Mathematik und Englisch.",
      bullets: [
        "Abitur im Juni 2025, parallel zur Arbeit im Familienbetrieb.",
        "In Mathematik und Englisch analytisches Denken und klare Kommunikation geübt.",
        "Schule, Schichten und Prüfungsvorbereitung selbst organisiert.",
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
      subtitle: "HAW Kiel",
      timeframe: "seit 09/2025",
      headline: "Ich lerne, technische Lösungen für betriebliche Aufgaben zu entwickeln.",
      bullets: [
        "Schwerpunkte: Analyse, Programmierung, Datenbanken, Projektmanagement.",
        "Google Cybersecurity Professional Certificate seit 02/2026 in Bearbeitung.",
        "Frühere Praktika: GMSH Kiel (SAP, eVergabe), Renault (Mechanik).",
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
      headline: "Ich prüfe Hardware, analysiere Fehler und dokumentiere Testergebnisse.",
      bullets: [
        "Server- und System-Logs analysiert, Fehlerursachen eingegrenzt.",
        "Incidents in Jira dokumentiert, SQL-Auswertungen erstellt.",
        "Hardware geprüft; als elektrotechnisch unterwiesene Person (EuP) qualifiziert.",
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
      subtitle: "Eigene Projekte · selbst gelernt",
      timeframe: "laufend",
      headline: "Eigene Anwendungen entwickeln, betreiben und verbessern.",
      bullets: [
        "Synapser: Terminplanung mit FastAPI und Google OR-Tools.",
        "OmniView: Dashboard für Nachrichten und Sicherheitsinformationen.",
        "Funke: selbst gehostete Chat- und Sprachplattform mit WebRTC.",
        "Dieses Portfolio: eine interaktive Insel mit Three.js und Rapier3D.",
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
      title: "Family business & first network audit",
      subtitle: "Yek Döner & Pizzeria · Heikendorf",
      timeframe: "01/2022 – 03/2025",
      headline: "Took on responsibility in the family business and reviewed its network.",
      bullets: [
        "Worked in service and at the till from age 16. Became shift lead after a year.",
        "Handled purchasing, pricing and revenue analysis.",
        "Changed the Wi-Fi password, separated the guest network and updated camera firmware.",
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
      timeframe: "09/2016 – 06/2025",
      headline: "Completed my Abitur with advanced courses in mathematics and English.",
      bullets: [
        "Completed my Abitur in June 2025 while working in the family business.",
        "Practised analytical thinking and clear communication in mathematics and English.",
        "Organised schoolwork, shifts and exam preparation.",
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
      subtitle: "HAW Kiel",
      timeframe: "since 09/2025",
      headline: "Learning to develop technical solutions for business needs.",
      bullets: [
        "Focus: analysis, programming, databases, project management.",
        "Google Cybersecurity Professional Certificate in progress since February 2026.",
        "Previous internships at GMSH Kiel (SAP, eProcurement) and Renault (vehicle mechanics).",
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
      headline: "I test hardware, investigate faults and document test results.",
      bullets: [
        "Server and system logs analysed, root causes narrowed down.",
        "Documented incidents in Jira, ran SQL-based evaluations.",
        "Tested hardware; trained as an electrically instructed person (EuP).",
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
      headline: "Building, running and improving my own applications.",
      bullets: [
        "Synapser: scheduling with FastAPI and Google OR-Tools.",
        "OmniView: a dashboard for news and security information.",
        "Funke: a self-hosted chat and voice platform using WebRTC.",
        "This portfolio: an interactive island built with Three.js and Rapier3D.",
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
    step_what: "Überblick",
    step_how: "Konkret gemacht",
    step_stack: "Kenntnisse",
    drawer_hint: "Mit „Weiter“ erfährst du mehr.",
    intro_title: "Hi, ich bin Numan.",
    intro_body: "Ich bin 20, komme aus Kiel und studiere Wirtschaftsinformatik. In sieben Stationen lernst du meine Arbeit, eigene Projekte und internationale Erfahrungen kennen.",
  },
  en: {
    start_tour: "Start guided tour",
    free_roam: "Explore freely",
    next: "Next",
    prev: "Back",
    skip: "End tour",
    contact: "Contact",
    step_what: "Overview",
    step_how: "What I did",
    step_stack: "Tech & Skills",
    drawer_hint: "Click \"Next\" for the next station",
    intro_title: "Hi, I'm Numan.",
    intro_body: "I'm 20, from Kiel, and studying Business Information Systems. Explore my work, personal projects and international experience in seven stops.",
  },
};

export function getStationsForLang(lang) {
  const key = lang === "en" ? "en" : "de";
  return { ...STATIONS[key], ...EXPERIENCE_TOUR[key] };
}

export function getWalkthroughStrings(lang) {
  return WALKTHROUGH_UI[lang === "en" ? "en" : "de"];
}
