/**
 * i18nHead — hält <head> + SEO-Text synchron zur aktiven Sprache.
 *
 * URL-Schema (muss zu den statischen Tags in index.html passen):
 *   DE (Default):  https://numan-yesil.com/
 *   EN:            https://numan-yesil.com/?lang=en
 *
 * Pro Sprache gilt:
 *   - <html lang> = aktive Sprache
 *   - Canonical zeigt auf die EIGENE Sprach-URL (self-referencing) —
 *     sonst ignoriert Google die hreflang-Paare.
 *   - hreflang de / en / x-default sind immer vollständig vorhanden.
 *   - Im #seo-content ist nur der Block der aktiven Sprache sichtbar.
 *
 * Priorität beim Boot: ?lang= in der URL > localStorage > "de".
 */

const SITE_URL = "https://numan-yesil.com/";

const HEAD = {
  de: {
    locale: "de_DE",
    altLocale: "en_US",
    description:
      "Interaktives 3D-Portfolio von Numan Yesil. Fahr mit dem Fahrrad über eine kleine Insel und entdecke die Stationen meiner Ausbildung, Arbeit und Projekte. Plus ein paar versteckte Labs zum Selbst-Spielen.",
  },
  en: {
    locale: "en_US",
    altLocale: "de_DE",
    description:
      "Interactive 3D portfolio of Numan Yesil. Ride a bike across a small island and discover the stations of my education, work and projects. Plus a few hidden labs to play with.",
  },
};

export function normalizeLang(value) {
  return value === "en" || value === "de" ? value : null;
}

/** Sprache aus ?lang= (oder null, wenn nicht gesetzt/ungültig). */
export function getUrlLang() {
  if (typeof window === "undefined") return null;
  try {
    return normalizeLang(new URLSearchParams(window.location.search).get("lang"));
  } catch {
    return null;
  }
}

export function langUrl(lang) {
  return lang === "en" ? `${SITE_URL}?lang=en` : SITE_URL;
}

function setAttr(selector, attr, value) {
  const el = document.head.querySelector(selector);
  if (el && el.getAttribute(attr) !== value) el.setAttribute(attr, value);
}

function ensureHreflang() {
  const pairs = [
    ["de", langUrl("de")],
    ["en", langUrl("en")],
    ["x-default", SITE_URL],
  ];
  for (const [hreflang, href] of pairs) {
    let link = document.head.querySelector(`link[rel="alternate"][hreflang="${hreflang}"]`);
    if (!link) {
      link = document.createElement("link");
      link.rel = "alternate";
      link.hreflang = hreflang;
      document.head.appendChild(link);
    }
    if (link.getAttribute("href") !== href) link.setAttribute("href", href);
  }
}

/**
 * Sprache auf Dokument-Ebene anwenden. Idempotent, darf bei jedem
 * Settings-Apply aufgerufen werden.
 * @param {"de"|"en"} lang
 * @param {{ updateUrl?: boolean }} [opts] — ?lang= in der Adresszeile
 *   nachziehen (replaceState, kein History-Eintrag).
 */
export function applyLangToDocument(lang, { updateUrl = true } = {}) {
  if (typeof document === "undefined") return;
  const l = lang === "en" ? "en" : "de";
  const meta = HEAD[l];

  document.documentElement.lang = l;
  setAttr('link[rel="canonical"]', "href", langUrl(l));
  setAttr('meta[property="og:url"]', "content", langUrl(l));
  setAttr('meta[property="og:locale"]', "content", meta.locale);
  setAttr('meta[property="og:locale:alternate"]', "content", meta.altLocale);
  setAttr('meta[name="description"]', "content", meta.description);
  ensureHreflang();

  // Statischer SEO-/Screenreader-Text: nur die aktive Sprache sichtbar
  document.querySelectorAll("#seo-content [data-seo-lang]").forEach((el) => {
    el.hidden = el.getAttribute("data-seo-lang") !== l;
  });

  if (updateUrl && typeof window !== "undefined" && window.history?.replaceState) {
    try {
      const url = new URL(window.location.href);
      if (l === "en") url.searchParams.set("lang", "en");
      else url.searchParams.delete("lang");
      if (url.href !== window.location.href) {
        window.history.replaceState(window.history.state, "", url);
      }
    } catch {}
  }
}
