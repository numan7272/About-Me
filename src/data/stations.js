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
      headline: "Drei Jahre Service. Erstes echtes Netzwerk-Audit.",
      bullets: [
        "Service, Kasse, Tagesgeschäft ab 16. Schicht-Lead nach einem Jahr.",
        "Einkauf, Kalkulation, Umsatzanalysen nebenher.",
        "WPA2-PSK rotiert, Guest-VLAN getrennt, Hikvision-Firmware geupdated.",
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
      headline: "Neun Jahre strukturiertes Denken. Fundament für alles danach.",
      bullets: [
        "Abitur 07/2025, parallel zum Familienbetrieb.",
        "LK Mathe + Englisch. Problemzerlegung und klare Kommunikation.",
        "Selbstdisziplin als Basis fürs Studium.",
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
      headline: "Wirtschaftsinformatik. Brücke zwischen Technik und Geschäft.",
      bullets: [
        "Schwerpunkte: Analyse, Programmierung, Datenbanken, Projektmanagement.",
        "Google Cybersecurity Cert seit 02/2026. Plus PortSwigger, TryHackMe.",
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
      headline: "Werkstudent QA. Log-Analyse, Hardware-Tests, Jira.",
      bullets: [
        "Server- und System-Logs analysiert, Fehlerursachen eingegrenzt.",
        "Incidents in Jira dokumentiert, SQL-Auswertungen erstellt.",
        "Hardware geprüft, zertifiziert als EuP.",
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
        "Synapser. FastAPI-Backend mit Google OR-Tools.",
        "OmniView. News + Threat-Intel-Dashboard, Next.js + GDELT.",
        "Funke. Self-hosted WebRTC, Node + Socket.IO + Electron.",
        "Diese Site. Three.js + Rapier3D, eigenhändig gebaut.",
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
      headline: "Three years of service. First real network audit.",
      bullets: [
        "Service, register, day-to-day from age 16. Shift lead after a year.",
        "Operations on the side: purchasing, costing, revenue analysis.",
        "Rotated WPA2-PSK, split guest VLAN, updated Hikvision firmware.",
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
      headline: "Nine years of structured thinking. Foundation for what came next.",
      bullets: [
        "Abitur July 2025, alongside family-business work.",
        "Math + English as advanced courses. Decomposition + clear writing.",
        "Self-discipline as the base for B.Sc. studies.",
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
      headline: "Business Informatics. Bridge between tech and business.",
      bullets: [
        "Focus: analysis, programming, databases, project management.",
        "Google Cybersecurity Cert since 02/2026. Plus PortSwigger, TryHackMe.",
        "Internships: GMSH Kiel (SAP, eProcurement), Renault (mechanic).",
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
      headline: "Working student QA. Log analysis, hardware tests, Jira.",
      bullets: [
        "Server and system logs analysed, root causes narrowed down.",
        "Documented incidents in Jira, ran SQL-based evaluations.",
        "Hardware tested in lab. EuP-certified.",
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
        "Synapser. FastAPI backend with Google OR-Tools.",
        "OmniView. News + threat-intel dashboard, Next.js + GDELT.",
        "Funke. Self-hosted WebRTC, Node + Socket.IO + Electron.",
        "This site. Three.js + Rapier3D, hand-built from scratch.",
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
