import { ABOUT } from "../../data/about.js";
import { getLang } from "../../data/content.js";
import "./experience-file.css";

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** A discoverable document inside the HQ's simulated desktop. */
export function experienceFile(id) {
  const item = ABOUT[getLang()].sections.find((section) => section.id === id);
  const file = element("article", `experience-file experience-${id}`);
  file.lang = getLang();
  const header = element("header");
  header.append(element("p", "experience-category", item.category),
    element("span", "experience-status", item.status),
    element("h2", "", item.title),
    element("p", "experience-meta", item.meta));
  file.append(header, element("p", "experience-summary", item.summary));
  const facts = element("dl", "experience-facts");
  for (const [value, label] of item.facts) {
    const fact = element("div");
    fact.append(element("dt", "", label), element("dd", "", value));
    facts.append(fact);
  }
  file.append(facts);
  for (const [label, body] of item.details) {
    const details = element("details");
    details.append(element("summary", "", label), element("p", "", body));
    file.append(details);
  }
  const skills = element("ul", "experience-skills");
  item.skills.forEach((skill) => skills.append(element("li", "", skill)));
  file.append(skills);
  const links = element("footer", "experience-links");
  for (const { label, href } of item.links) {
    const link = element("a", "", `${label} ↗`);
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    links.append(link);
  }
  file.append(links);
  return file;
}
