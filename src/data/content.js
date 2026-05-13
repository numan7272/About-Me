/**
 * content.js — Werdegang-Texte + Easter-Egg-Texte (DE/EN).
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
  },
  en: {
    discovery_counter: "Easter Eggs",
    egg_found: "Easter Egg discovered!",
    drive_close_hint: "Drive closer for more",
    close: "Close",
  },
};

export const LANDMARKS = {
  de: {
    HAW: {
      id: "haw",
      title: "B.Sc. Wirtschaftsinformatik",
      subtitle: "HAW Kiel · 2. Semester",
      timeframe: "seit 09/2025",
      text: "B.Sc. Wirtschaftsinformatik, 2. Semester. Schwerpunkt Cybersecurity, Log-Analyse, praxisnahe Systemarbeit. Ich studiere und arbeite parallel.",
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
      title: "Familienbetrieb · IT-Security im Alltag",
      subtitle: "Yek Döner & Pizzeria, Heikendorf",
      timeframe: "01/2022 – 03/2025",
      text: "3 Jahre Service, Kasse, Tagesgeschäft — parallel zur Oberstufe. Hier kam ich erstmals mit IT-Security in Kontakt: praxisnaher Security-Check des Betriebs-WLANs — offene Ports identifiziert, Netzwerk isoliert, Wi-Fi-Härtung, Default-Passwörter ersetzt, Kameras vom öffentlichen Netz getrennt. Erstes echtes Security-Lab.",
      skills: ["Network Audit", "Port Filtering", "Wi-Fi Hardening", "Social Engineering", "Betriebsmanagement"],
      color: "#fb923c",
      accent: "#ef4444",
    },
    THG: {
      id: "thg",
      title: "Allgemeine Hochschulreife",
      subtitle: "Thor Heyerdahl Gymnasium, Kiel",
      timeframe: "09/2016 – 07/2025",
      text: "9 Jahre Schule, Abi im Juli 2025. Hier lernte ich strukturiertes Denken und Selbstdisziplin — die Grundlage für mein Wirtschaftsinformatikstudium.",
      skills: ["Analytisches Denken", "Selbstdisziplin", "Allgemeinbildung"],
      color: "#a78bfa",
      accent: "#7c3aed",
    },
    HQ: {
      id: "hq",
      title: "HQ — Aktuelle Projekte",
      subtitle: "Zu Hause · selbst gelernt",
      timeframe: "laufend",
      text: "Zurück am HQ. Aktuelle Projekte: Synapser (FastAPI-Backend mit Google OR-Tools), OmniView (News-Dashboard mit Next.js + GDELT), Funke (WebRTC-Plattform self-hosted). Als letztes Projekt diese Portfolio-Website, auf der du gerade fährst. Plus Google Cybersecurity Professional Certificate seit 02/2026.",
      skills: ["Python/FastAPI", "React/Next.js", "Docker", "Linux", "Self-Hosted", "Self-taught"],
      color: "#f472b6",
      accent: "#ec4899",
    },
  },
  en: {
    HAW: {
      id: "haw",
      title: "B.Sc. Business Information Systems",
      subtitle: "HAW Kiel · 2nd Semester",
      timeframe: "Since 09/2025",
      text: "B.Sc. Business Information Systems, 2nd semester. Focus on cybersecurity, log analysis, hands-on systems work. Studying and working in parallel.",
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
      title: "Family Business · IT Security in the Wild",
      subtitle: "Yek Döner & Pizzeria, Heikendorf",
      timeframe: "01/2022 – 03/2025",
      text: "3 years of service, register, day-to-day operations — alongside upper-school. This is where I first encountered IT security in practice: hands-on security audit of the business Wi-Fi — identified open ports, isolated the network, hardened Wi-Fi, replaced default passwords, separated cameras from public network. My first real security lab.",
      skills: ["Network Audit", "Port Filtering", "Wi-Fi Hardening", "Social Engineering", "Operations"],
      color: "#fb923c",
      accent: "#ef4444",
    },
    THG: {
      id: "thg",
      title: "Abitur (Higher Education Entrance)",
      subtitle: "Thor Heyerdahl Gymnasium, Kiel",
      timeframe: "09/2016 – 07/2025",
      text: "9 years of school, Abitur in July 2025. This is where I learned structured thinking and self-discipline — the foundation for my Business Information Systems studies.",
      skills: ["Analytical Thinking", "Self-Discipline", "General Education"],
      color: "#a78bfa",
      accent: "#7c3aed",
    },
    HQ: {
      id: "hq",
      title: "HQ — Current Projects",
      subtitle: "Home · self-taught",
      timeframe: "Ongoing",
      text: "Back at HQ. Current projects: Synapser (FastAPI backend with Google OR-Tools), OmniView (news dashboard with Next.js + GDELT), Funke (self-hosted WebRTC platform). Latest project is this portfolio website you're riding through right now. Plus Google Cybersecurity Professional Certificate since 02/2026.",
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
      title: "Hardware Hacking & OSINT",
      subtitle: "Easter Egg · Raspberry Pi Zero",
      text: "Raspberry Pi Zero. Hardware Hacking, OSINT, Kali Linux. Coden ist eine Sache — Hardware verstehen eine andere. Tools für unsichtbare Netzwerk-Setups und individuelle Security-Gadgets.",
      skills: ["Kali Linux", "Hardware Modding", "OSINT"],
      color: "#a3e635",
    },
    Router: {
      id: "router",
      title: "Der Gastro-Pentest",
      subtitle: "Easter Egg · Compromised Router",
      text: "3 Jahre Familienbetrieb = mein erstes Security-Lab. Offene Ports gefunden, Netzwerk isoliert, Port-Filtering eingerichtet, Passwörter gehärtet. Praxis schlägt Theorie.",
      skills: ["Network Audit", "Port Filtering", "Wi-Fi Hardening"],
      color: "#fb923c",
    },
    Container: {
      id: "container",
      title: "Self-Hosted Architectures",
      subtitle: "Easter Egg · Shipping Container",
      text: "Docker. Funke = WebRTC-Plattform self-hosted (Node.js, Socket.IO, Electron). Synapser = FastAPI mit Google OR-Tools. Volle Kontrolle über die Infrastruktur statt fremde Cloud.",
      skills: ["Docker", "WebRTC", "FastAPI", "Self-Hosted"],
      color: "#22d3ee",
    },
    Dumbbell: {
      id: "dumbbell",
      title: "Widerstand & Wachstum",
      subtitle: "Easter Egg · 20 kg Hantel",
      text: "Gym seit Ende 2019, aktiv seit 01/2022. Krafttraining ist Gegengewicht zu Code-Stunden. In IT genauso: ohne konsistenten Widerstand kein Wachstum.",
      skills: ["Krafttraining", "Disziplin", "Mind-Body Balance"],
      color: "#f472b6",
    },
  },
  en: {
    Pi: {
      id: "pi",
      title: "Hardware Hacking & OSINT",
      subtitle: "Easter Egg · Raspberry Pi Zero",
      text: "Raspberry Pi Zero. Hardware hacking, OSINT, Kali Linux. Coding is one thing — understanding hardware is another. Tools for invisible network setups and custom security gadgets.",
      skills: ["Kali Linux", "Hardware Modding", "OSINT"],
      color: "#a3e635",
    },
    Router: {
      id: "router",
      title: "The Gastro Pentest",
      subtitle: "Easter Egg · Compromised Router",
      text: "3 years in the family business = my first security lab. Found open ports, isolated the network, set up port filtering, hardened the passwords. Practice beats theory.",
      skills: ["Network Audit", "Port Filtering", "Wi-Fi Hardening"],
      color: "#fb923c",
    },
    Container: {
      id: "container",
      title: "Self-Hosted Architectures",
      subtitle: "Easter Egg · Shipping Container",
      text: "Docker. Funke = self-hosted WebRTC platform (Node.js, Socket.IO, Electron). Synapser = FastAPI with Google OR-Tools. Full control over the infrastructure instead of someone else's cloud.",
      skills: ["Docker", "WebRTC", "FastAPI", "Self-Hosted"],
      color: "#22d3ee",
    },
    Dumbbell: {
      id: "dumbbell",
      title: "Resistance & Growth",
      subtitle: "Easter Egg · 20 kg Plate",
      text: "Gym membership since late 2019, active since 01/2022. Strength training is the counterweight to hours sitting in front of code. In IT same: without consistent resistance there's no growth.",
      skills: ["Strength Training", "Discipline", "Mind-Body Balance"],
      color: "#f472b6",
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
