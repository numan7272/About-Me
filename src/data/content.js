/**
 * content.js, Werdegang-Texte + Easter-Egg-Texte (DE/EN).
 *
 * Verwendung:
 *   import { getLang, t, LANDMARKS, EGGS } from "./data/content.js";
 *   const lang = getLang();
 *   const station = LANDMARKS[lang].haw;
 */

const STRINGS = {
  de: {
    discovery_counter: "Easter Eggs",
    egg_found: "Easter Egg gefunden!",
    drive_close_hint: "Fahr näher ran für mehr",
    close: "Schließen",
    open_repo: "Repo auf GitHub öffnen",
  },
  en: {
    discovery_counter: "Easter Eggs",
    egg_found: "Easter Egg discovered!",
    drive_close_hint: "Drive closer for more",
    close: "Close",
    open_repo: "Open repo on GitHub",
  },
};

export const LANDMARKS = {
  de: {
    HAW: {
      id: "haw",
      title: "B.Sc. Wirtschaftsinformatik",
      subtitle: "HAW Kiel",
      timeframe: "seit 09/2025",
      text: "Ich studiere Wirtschaftsinformatik an der HAW Kiel und arbeite parallel als Werkstudent. Mich interessieren Backend-Entwicklung, Cloud-Systeme und IT-Sicherheit. Im September 2026 nahm ich an der Erasmus+ Learning Tour Agents of Change teil.",
      skills: ["Wirtschaftsinformatik", "Python", "SQL", "Projektmanagement"],
      color: "#22d3ee",
      accent: "#06b6d4",
    },
    Designa: {
      id: "designa",
      title: "Werkstudent QS · TestLab",
      subtitle: "Designa Verkehrsleittechnik GmbH",
      timeframe: "seit 11/2025",
      text: "Werkstudent Qualitätssicherung im TestLab bei Designa Verkehrsleittechnik, Kiel. Server- und Systemlogs analysieren, Vorfälle in Jira dokumentieren, mit SQL Daten auswerten, Hardware-Komponenten (EuP) testen.",
      skills: ["Jira", "SQL", "Log-Analyse", "Hardware-Tests", "Fehlerdiagnose"],
      color: "#34d399",
      accent: "#10b981",
    },
    Yek: {
      id: "yek",
      title: "Familienbetrieb · Verantwortung & erstes Audit",
      subtitle: "Yek Döner & Pizzeria, Heikendorf",
      timeframe: "01/2022 – 03/2025",
      text: "Drei Jahre lang habe ich neben der Schule im Service, an der Kasse und im Tagesgeschäft mitgearbeitet. Beim ersten Netzwerk-Audit erneuerte ich das WLAN-Passwort, trennte das Gästenetz vom Kassennetz, aktualisierte die Kamera-Firmware und deaktivierte Telnet.",
      skills: ["Network Audit", "Wi-Fi Hardening", "Betriebsmanagement"],
      color: "#fb923c",
      accent: "#ef4444",
    },
    THG: {
      id: "thg",
      title: "Allgemeine Hochschulreife",
      subtitle: "Thor Heyerdahl Gymnasium, Kiel",
      timeframe: "09/2016 – 06/2025",
      text: "Mein Abitur habe ich im Juni 2025 abgeschlossen. In den letzten drei Schuljahren arbeitete ich parallel im Familienbetrieb. Dabei lernte ich, Unterricht, Schichten und Prüfungsvorbereitung zu organisieren.",
      skills: ["Abitur 06/2025", "Schule + Job parallel"],
      color: "#a78bfa",
      accent: "#7c3aed",
    },
    HQ: {
      id: "hq",
      title: "HQ · Aktuelle Projekte",
      subtitle: "Zu Hause · selbst gelernt",
      timeframe: "laufend",
      text: "Im HQ findest du meine Projekte, darunter Synapser zur Terminplanung, das Dashboard OmniView und die selbst gehostete Kommunikationsplattform Funke. Auch diese 3D-Insel gehört dazu. Das Google Cybersecurity Professional Certificate bearbeite ich seit Februar 2026; zusätzlich übe ich mit PortSwigger und TryHackMe.",
      skills: ["Python/FastAPI", "React/Next.js", "Docker", "Linux", "Self-Hosted", "Self-taught"],
      color: "#f472b6",
      accent: "#ec4899",
    },
  },
  en: {
    HAW: {
      id: "haw",
      title: "B.Sc. Business Information Systems",
      subtitle: "HAW Kiel",
      timeframe: "Since 09/2025",
      text: "I study Business Information Systems at HAW Kiel and work part-time alongside my studies. My interests include backend development, cloud systems and cybersecurity. In September 2026, I joined the Erasmus+ Agents of Change learning tour.",
      skills: ["Business Informatics", "Python", "SQL", "Project Management"],
      color: "#22d3ee",
      accent: "#06b6d4",
    },
    Designa: {
      id: "designa",
      title: "Working Student · QA TestLab",
      subtitle: "Designa Verkehrsleittechnik GmbH",
      timeframe: "Since 11/2025",
      text: "Working student in QA at Designa Verkehrsleittechnik's TestLab, Kiel. Analyzing server and system logs, documenting incidents in Jira, running data analysis with SQL, testing hardware components (EuP).",
      skills: ["Jira", "SQL", "Log Analysis", "Hardware Testing", "Diagnostics"],
      color: "#34d399",
      accent: "#10b981",
    },
    Yek: {
      id: "yek",
      title: "Family Business · Responsibility & First Audit",
      subtitle: "Yek Döner & Pizzeria, Heikendorf",
      timeframe: "01/2022 – 03/2025",
      text: "For three years, I worked in service, at the till and in daily operations alongside school. During my first network audit, I changed the Wi-Fi password, separated the guest and till networks, updated camera firmware and disabled Telnet.",
      skills: ["Network Audit", "Wi-Fi Hardening", "Operations"],
      color: "#fb923c",
      accent: "#ef4444",
    },
    THG: {
      id: "thg",
      title: "Abitur (Higher Education Entrance)",
      subtitle: "Thor Heyerdahl Gymnasium, Kiel",
      timeframe: "09/2016 – 06/2025",
      text: "I completed my Abitur in June 2025. During my final three school years, I also worked in the family business. This taught me to organise lessons, shifts and exam preparation.",
      skills: ["Abitur 06/2025", "School + job in parallel"],
      color: "#a78bfa",
      accent: "#7c3aed",
    },
    HQ: {
      id: "hq",
      title: "HQ · Current Projects",
      subtitle: "Home · self-taught",
      timeframe: "Ongoing",
      text: "The HQ contains my projects, including Synapser for scheduling, the OmniView dashboard and Funke, a self-hosted communication platform. This 3D island is another project. I have been working towards the Google Cybersecurity Professional Certificate since February 2026 and also practise with PortSwigger and TryHackMe.",
      skills: ["Python/FastAPI", "React/Next.js", "Docker", "Linux", "Self-Hosted", "Self-taught"],
      color: "#f472b6",
      accent: "#ec4899",
    },
  },
};

export const EGGS = {
  de: {
    Pi: {
      id: "pi",
      title: "Pi Zero W als Lern-Lab",
      subtitle: "Easter Egg · Raspberry Pi Zero W",
      text: "Pi Zero W mit Kali ARM, headless. Für eigene Übungen: Wi-Fi-Monitor-Mode via nexmon, OSINT-Workflows, kleine Server-Setups. Hardware verstehen lernt sich anders als reines Coden.",
      skills: ["Kali Linux", "Wi-Fi / nexmon", "OSINT"],
      color: "#a3e635",
    },
    Router: {
      id: "router",
      title: "Yek Network Audit",
      subtitle: "Easter Egg · Router & IP-Cam",
      text: "Drei Jahre Familienbetrieb, ein in den Defaults vergessener Router. Hikvision-Cam ohne Firmware-Update, Kasse + Gäste-WLAN im gleichen /24. VLAN getrennt, PSK rotiert, Telnet aus. Klick zum Lab.",
      skills: ["Network Audit", "Wi-Fi Hardening", "CVE-2017-7921"],
      color: "#fb923c",
    },
    Container: {
      id: "container",
      title: "Self-Hosted Architectures",
      subtitle: "Easter Egg · Shipping Container",
      text: "Docker. Funke = WebRTC-Plattform self-hosted (Node.js, Socket.IO, Electron). Synapser = FastAPI mit Google OR-Tools. Dabei lerne ich, Anwendungen selbst bereitzustellen und zu betreiben.",
      skills: ["Docker", "WebRTC", "FastAPI", "Self-Hosted"],
      color: "#22d3ee",
    },
    Dumbbell: {
      id: "dumbbell",
      title: "Gegengewicht zum Schreibtisch",
      subtitle: "Easter Egg · 20 kg Hantel",
      text: "Gym seit Ende 2019, richtig dabei seit 01/2022. Der Ausgleich zu den Stunden vorm Bildschirm. Trainingsplan und Progression werden getrackt, wie alles andere auch.",
      skills: ["Krafttraining", "Konstanz seit 2022"],
      color: "#f472b6",
    },
  },
  en: {
    Pi: {
      id: "pi",
      title: "Pi Zero W learning lab",
      subtitle: "Easter Egg · Raspberry Pi Zero W",
      text: "Pi Zero W with Kali ARM, headless. For my own practice: Wi-Fi monitor mode via nexmon patch, OSINT workflows, small server setups. Understanding hardware needs a different muscle than pure coding.",
      skills: ["Kali Linux", "Wi-Fi / nexmon", "OSINT"],
      color: "#a3e635",
    },
    Router: {
      id: "router",
      title: "Yek Network Audit",
      subtitle: "Easter Egg · Router & IP-Cam",
      text: "Three years in the family business and a router still on ISP defaults. Hikvision cam with no firmware updates, register and guest Wi-Fi on the same /24. Split the VLAN, rotated the PSK, disabled telnet. Click to open the lab.",
      skills: ["Network Audit", "Wi-Fi Hardening", "CVE-2017-7921"],
      color: "#fb923c",
    },
    Container: {
      id: "container",
      title: "Self-Hosted Architectures",
      subtitle: "Easter Egg · Shipping Container",
      text: "Docker. Funke = self-hosted WebRTC platform (Node.js, Socket.IO, Electron). Synapser = FastAPI with Google OR-Tools. These projects help me learn how to deploy and run applications myself.",
      skills: ["Docker", "WebRTC", "FastAPI", "Self-Hosted"],
      color: "#22d3ee",
    },
    Dumbbell: {
      id: "dumbbell",
      title: "Counterweight to the desk",
      subtitle: "Easter Egg · 20 kg Plate",
      text: "Gym member since late 2019, training for real since 01/2022. The counterweight to hours in front of a screen. Plan and progression get tracked, same as everything else.",
      skills: ["Strength Training", "Consistent since 2022"],
      color: "#f472b6",
    },
  },
};

/**
 * PROJECTS, kuratierte GitHub-Projekte für den Projekthafen.
 * Reihenfolge = Reihenfolge der Kisten am Steg (Security-Steg zuerst).
 * `link: null` = Repo (noch) privat → InfoCard zeigt linkNote statt Anchor.
 */
export const PROJECT_ORDER = ["ctp", "pwdemo", "synapser", "funke", "somnoscope"];

export const PROJECTS = {
  de: {
    ctp: {
      id: "ctp",
      title: "Contextual Trust Protocol",
      subtitle: "Projekthafen · Security-Steg · Rust",
      timeframe: "2026 · early research",
      text: "Zero-Trust-Containment für Agenten-Systeme. Grundannahme: ein LLM kann Instruktionen nicht zuverlässig von Daten trennen, also externe Mauern statt Prompt-Engineering. Fünf Rust-Crates: statischer Scanner gegen Encoding-Tricks, ein sandboxed Guard-Modell ohne Exekutionsrechte (eigener Prozess, nur Unix-Socket), Tool-I/O-Vetting in beide Richtungen, fail-closed bei jedem Fehler. Threat Model mit offen dokumentierten Lücken statt Marketing.",
      skills: ["Rust", "Zero Trust", "Prompt-Injection-Defense", "gRPC / UDS", "systemd-Sandboxing"],
      link: "https://github.com/numan7272/contextualtrustprotocol",
      color: "#ff8576",
      accent: "#ff8576",
    },
    pwdemo: {
      id: "pwdemo",
      title: "AI Password Awareness",
      subtitle: "Projekthafen · Security-Steg · Python",
      timeframe: "2026",
      text: "Offline-Awareness-Demo: wie KI-gestütztes Raten den Passwort-Suchraum schrumpfen lässt, und welche Verteidigung dagegen tatsächlich wirkt. Komplett synthetische Daten, reproduzierbare Läufe, kein einziges echtes Passwort nötig.",
      skills: ["Python", "Security Awareness", "Synthetische Daten", "Reproduzierbarkeit"],
      link: "https://github.com/numan7272/ai-password-awareness",
      color: "#ffd28a",
      accent: "#ffd28a",
    },
    synapser: {
      id: "synapser",
      title: "Synapser",
      subtitle: "Projekthafen · Python / FastAPI",
      timeframe: "seit 2025",
      text: "KI-gestützte Terminplanung als FastAPI-Backend. Kern ist ein Constraint-Solver (Google OR-Tools) für Stundenplan-artige Probleme, dazu Echtzeit-Rescheduling und Anbindung an Geo-, Wetter- und Smart-Home-APIs.",
      skills: ["Python", "FastAPI", "OR-Tools / CSP", "API-Integrationen"],
      link: "https://github.com/numan7272/synapser-backend",
      color: "#8fe3c0",
      accent: "#8fe3c0",
    },
    funke: {
      id: "funke",
      title: "funke",
      subtitle: "Projekthafen · JavaScript",
      timeframe: "2026",
      text: "Selbst gehostete Discord-Alternative: Echtzeit-Messaging, WebRTC-Voice, Screen-Sharing. Eigene Infrastruktur statt fremder Cloud, deshalb steht die Kiste direkt neben dem Container.",
      skills: ["Node.js", "WebRTC", "Socket.IO", "Self-Hosted"],
      link: "https://github.com/numan7272/funke",
      color: "#22d3ee",
      accent: "#22d3ee",
    },
    somnoscope: {
      id: "somnoscope",
      title: "Somnoscope",
      subtitle: "Projekthafen · Python · work in progress",
      timeframe: "2026 · WIP",
      text: "Lokaler Edge-AI-Sleep-Tracker: BLE/MQTT-Sensorfusion, Schlafphasen-Scoring mit YASA, privacy-first, alle Daten bleiben auf eigener Hardware. Ehrlich gelabelt: work in progress.",
      skills: ["Python", "BLE / MQTT", "YASA", "Edge AI", "Privacy-first"],
      link: "https://github.com/numan7272/Somnoscope",
      color: "#a78bfa",
      accent: "#a78bfa",
    },
  },
  en: {
    ctp: {
      id: "ctp",
      title: "Contextual Trust Protocol",
      subtitle: "Project Harbor · Security Pier · Rust",
      timeframe: "2026 · early research",
      text: "Zero-trust containment for agent systems. Core premise: an LLM cannot reliably separate instructions from data, so build external walls instead of prompt engineering. Five Rust crates: a static scanner for encoding tricks, a sandboxed guard model with zero execution power (separate process, Unix socket only), tool I/O vetting in both directions, fail-closed on every error. A threat model with openly documented gaps instead of marketing.",
      skills: ["Rust", "Zero Trust", "Prompt Injection Defense", "gRPC / UDS", "systemd Sandboxing"],
      link: "https://github.com/numan7272/contextualtrustprotocol",
      color: "#ff8576",
      accent: "#ff8576",
    },
    pwdemo: {
      id: "pwdemo",
      title: "AI Password Awareness",
      subtitle: "Project Harbor · Security Pier · Python",
      timeframe: "2026",
      text: "Offline awareness demo: how AI-assisted guessing shrinks the password search space, and which defenses actually hold up. Fully synthetic data, reproducible runs, not a single real password required.",
      skills: ["Python", "Security Awareness", "Synthetic Data", "Reproducibility"],
      link: "https://github.com/numan7272/ai-password-awareness",
      color: "#ffd28a",
      accent: "#ffd28a",
    },
    synapser: {
      id: "synapser",
      title: "Synapser",
      subtitle: "Project Harbor · Python / FastAPI",
      timeframe: "Since 2025",
      text: "AI-assisted scheduling as a FastAPI backend. At the core: a constraint solver (Google OR-Tools) for timetable-style problems, plus real-time rescheduling and geo, weather and smart-home API integrations.",
      skills: ["Python", "FastAPI", "OR-Tools / CSP", "API Integrations"],
      link: "https://github.com/numan7272/synapser-backend",
      color: "#8fe3c0",
      accent: "#8fe3c0",
    },
    funke: {
      id: "funke",
      title: "funke",
      subtitle: "Project Harbor · JavaScript",
      timeframe: "2026",
      text: "Self-hosted Discord alternative: real-time messaging, WebRTC voice, screen sharing. Own infrastructure instead of someone else's cloud, which is why this crate sits right next to the container.",
      skills: ["Node.js", "WebRTC", "Socket.IO", "Self-Hosted"],
      link: "https://github.com/numan7272/funke",
      color: "#22d3ee",
      accent: "#22d3ee",
    },
    somnoscope: {
      id: "somnoscope",
      title: "Somnoscope",
      subtitle: "Project Harbor · Python · work in progress",
      timeframe: "2026 · WIP",
      text: "Local edge-AI sleep tracker: BLE/MQTT sensor fusion, sleep staging with YASA, privacy-first, all data stays on your own hardware. Honestly labeled: work in progress.",
      skills: ["Python", "BLE / MQTT", "YASA", "Edge AI", "Privacy-first"],
      link: "https://github.com/numan7272/Somnoscope",
      color: "#a78bfa",
      accent: "#a78bfa",
    },
  },
};

export function getLang() {
  if (typeof window !== "undefined" && window.__lang) {
    return window.__lang === "en" ? "en" : "de";
  }
  return "de";
}

export function t(key) {
  const lang = getLang();
  return STRINGS[lang]?.[key] ?? STRINGS.de[key] ?? key;
}
