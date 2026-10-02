// Portfolio claims are based on the owner's report and participation certificate.
// Keep private report contents and exploit details out of the public portfolio.
export const ABOUT = {
  de: {
    button: "Über mich", close: "Schließen", kicker: "Kiel · Neugier in der Praxis",
    title: "Hi, ich bin Numan.",
    intro: "Ich studiere Wirtschaftsinformatik an der HAW Kiel und arbeite im QA-TestLab bei Designa. Mich interessiert, wie Systeme funktionieren, wo sie scheitern und wie Menschen gemeinsam bessere Lösungen entwickeln.",
    lead: "Zwei Erfahrungen, die zeigen, wie ich arbeite.",
    sections: [
      {
        id: "security", number: "01", category: "Security Research", title: "Vom Fund zur bestätigten Schwachstelle.",
        meta: "H1 BBP · HackerOne · 2026", status: "Validiert & behoben",
        summary: "Ich habe eine Sicherheitslücke in Discourse entdeckt und über HackerOne gemeldet. Das Discourse-Team hat die Schwachstelle geprüft, bestätigt und den Report nach der Behebung als gelöst geschlossen.",
        facts: [["1", "validierter Report"], ["HackerOne", "Responsible Disclosure"]],
        details: [
          ["Mein Beitrag", "Die Schwachstelle identifiziert, dokumentiert und über den vorgesehenen Meldeweg eingereicht. Den Report habe ich bis zur Behebung begleitet."],
          ["Was ich mitnehme", "Sorgfältig analysieren, technische Probleme nachvollziehbar beschreiben und mit dem zuständigen Team kommunizieren."],
        ],
        skills: ["Schwachstellenanalyse", "Responsible Disclosure", "Technische Dokumentation"],
        links: [{ label: "Mein HackerOne-Profil", href: "https://hackerone.com/numan7272" }],
      },
      {
        id: "erasmus", number: "02", category: "Internationale Zusammenarbeit", title: "Agents of Change · Slow Tourism",
        meta: "Erasmus+ · Agents of Change · 14.–26.09.2026", status: "Learning Tour abgeschlossen",
        summary: "Bei der zweiten Erasmus+ Learning Tour „Agents of Change – Unhurried Horizons: Slow Tourism“ erkundete ich mit Studierenden und Lehrenden aus sechs Ländern nachhaltigen und regenerativen Tourismus. Die Reise führte mit Zug, Bus und Fähre zu Partnerhochschulen in Vantaa, Tallinn und Ljubljana.",
        facts: [["6", "Länder im Programm"], ["3", "Partnerstandorte"]],
        details: [
          ["Nachhaltig reisen", "Slow Tourism als Alternative zu Massen- und Übertourismus kennenlernen: bewusst reisen, lokale Gemeinschaften einbeziehen und Umwelt sowie Klima berücksichtigen."],
          ["Gemeinsam Lösungen entwickeln", "In internationalen Teams und Innovationsworkshops arbeiteten wir mit lokalen Unternehmen und Gemeinschaften an Ideen für nachhaltige Angebote und Dienstleistungen."],
          ["Was ich mitnehme", "Interkulturelle Zusammenarbeit, Problemlösung und neue Perspektiven auf Innovation, Unternehmertum und die Entwicklung nachhaltiger Reiseziele."],
        ],
        skills: ["Interkulturelle Teamarbeit", "Problemlösung", "Präsentation", "Nachhaltiger Tourismus"],
        links: [
          { label: "Teilnahmezertifikat (PDF)", href: "/certificates/agents-of-change-2026.pdf" },
        ],
      },
    ],
  },
  en: {
    button: "About me", close: "Close", kicker: "Kiel · Curiosity in practice",
    title: "Hi, I'm Numan.",
    intro: "I study Business Information Systems at HAW Kiel and work in Designa's QA TestLab. I'm interested in how systems work, where they fail, and how people can build better solutions together.",
    lead: "Two experiences that show how I work.",
    sections: [
      {
        id: "security", number: "01", category: "Security research", title: "From discovery to a validated vulnerability.",
        meta: "H1 BBP · HackerOne · 2026", status: "Validated & resolved",
        summary: "I discovered a security vulnerability in Discourse and reported it through HackerOne. The Discourse team reviewed and validated the finding, then closed the report as resolved after fixing the issue.",
        facts: [["1", "validated report"], ["HackerOne", "responsible disclosure"]],
        details: [
          ["My contribution", "Identified and documented the vulnerability, submitted it through the designated reporting channel, and followed the report through to resolution."],
          ["What I learned", "Careful analysis, clear technical documentation, and communication with the team responsible for the fix."],
        ],
        skills: ["Vulnerability analysis", "Responsible disclosure", "Technical documentation"],
        links: [{ label: "My HackerOne profile", href: "https://hackerone.com/numan7272" }],
      },
      {
        id: "erasmus", number: "02", category: "International collaboration", title: "Agents of Change · Slow Tourism",
        meta: "Erasmus+ · Agents of Change · 14–26 Sep 2026", status: "Learning tour completed",
        summary: "On the second Erasmus+ learning tour, “Agents of Change – Unhurried Horizons: Slow Tourism”, I explored sustainable and regenerative tourism with students and teachers from six countries. We travelled by train, bus, and ferry to partner universities in Vantaa, Tallinn, and Ljubljana.",
        facts: [["6", "countries in the programme"], ["3", "partner locations"]],
        details: [
          ["Travelling sustainably", "Explored slow tourism as an alternative to mass tourism and overtourism: travelling mindfully, engaging local communities, and considering the environment and climate."],
          ["Developing solutions together", "In international teams and innovation workshops, we worked with local businesses and communities on ideas for sustainable services and experiences."],
          ["What I take away", "Intercultural collaboration, problem solving, and new perspectives on innovation, entrepreneurship, and sustainable destination development."],
        ],
        skills: ["Intercultural teamwork", "Problem solving", "Presentation", "Sustainable tourism"],
        links: [
          { label: "Participation certificate (PDF)", href: "/certificates/agents-of-change-2026.pdf" },
        ],
      },
    ],
  },
};

export const EXPERIENCE_TOUR = {
  de: {
    erasmus: {
      id: "erasmus", anchorStation: "haw", aboutSection: "erasmus",
      title: "Agents of Change", subtitle: "Erasmus+ · Slow Tourism",
      timeframe: "14.–26.09.2026", headline: "Nachhaltig reisen, international zusammenarbeiten und gemeinsam neue Ideen entwickeln.",
      bullets: ["Learning Tour mit Studierenden und Lehrenden aus sechs Ländern.", "Mit Zug, Bus und Fähre nach Vantaa, Tallinn und Ljubljana.", "Innovationsworkshops mit lokalen Unternehmen und Gemeinschaften."],
      skills: ["Interkulturelle Teamarbeit", "Problemlösung", "Präsentation", "Slow Tourism"],
      eggHint: "Experience_erasmus", color: "#ffd28a", accent: "#ffd28a",
    },
    security: {
      id: "security", anchorStation: "hq", aboutSection: "security",
      title: "H1 BBP", subtitle: "HackerOne · Bug Bounty Research",
      timeframe: "2026", headline: "Selbst entdeckt. Über HackerOne gemeldet. Von Discourse validiert und behoben.",
      bullets: ["Sicherheitslücke in Discourse identifiziert und dokumentiert.", "Über HackerOne gemeldet und bis zur Behebung begleitet.", "Discourse bestätigte die Schwachstelle und schloss den Report als gelöst."],
      skills: ["Schwachstellenanalyse", "Responsible Disclosure", "Dokumentation"],
      eggHint: "Experience_security", color: "#8fe3c0", accent: "#8fe3c0",
    },
  },
  en: {
    erasmus: {
      id: "erasmus", anchorStation: "haw", aboutSection: "erasmus",
      title: "Agents of Change", subtitle: "Erasmus+ · Slow Tourism",
      timeframe: "14–26 Sep 2026", headline: "Travel sustainably, collaborate internationally, and develop new ideas together.",
      bullets: ["Learning tour with students and teachers from six countries.", "Travelled by train, bus, and ferry to Vantaa, Tallinn, and Ljubljana.", "Innovation workshops with local businesses and communities."],
      skills: ["Intercultural teamwork", "Problem solving", "Presentation", "Slow tourism"],
      eggHint: "Experience_erasmus", color: "#ffd28a", accent: "#ffd28a",
    },
    security: {
      id: "security", anchorStation: "hq", aboutSection: "security",
      title: "H1 BBP", subtitle: "HackerOne · Bug bounty research",
      timeframe: "2026", headline: "Discovered, reported through HackerOne, validated and fixed by Discourse.",
      bullets: ["Identified and documented a vulnerability in Discourse.", "Reported it through HackerOne and followed it through to resolution.", "Discourse confirmed the vulnerability and closed the report as resolved."],
      skills: ["Vulnerability analysis", "Responsible disclosure", "Documentation"],
      eggHint: "Experience_security", color: "#8fe3c0", accent: "#8fe3c0",
    },
  },
};
