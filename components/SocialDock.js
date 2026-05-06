"use client";

import { motion } from "framer-motion";
import { Github, Linkedin, Mail } from "lucide-react";

const LINKS = [
  {
    label: "GitHub",
    href: "https://github.com/numan7272",
    icon: Github,
    hoverColor: "#f4f4f5",
    hoverGlow: "rgba(244, 244, 245, 0.35)",
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com/in/numan-yesil",
    icon: Linkedin,
    hoverColor: "#0A66C2",
    hoverGlow: "rgba(10, 102, 194, 0.55)",
  },
  {
    label: "Email",
    href: "mailto:numan.yesil72@gmail.com",
    icon: Mail,
    hoverColor: "#22d3ee",
    hoverGlow: "rgba(34, 211, 238, 0.55)",
  },
];

export default function SocialDock() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
      <motion.nav
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        aria-label="Social links"
        className="pointer-events-auto"
      >
        <div className="relative">
          {/* Ambient glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-4 rounded-full bg-gradient-to-r from-cyan-500/15 via-indigo-500/10 to-cyan-500/15 blur-2xl"
          />

          <div className="relative flex items-center gap-1 rounded-full border border-white/[0.08] bg-zinc-900/60 px-2 py-2 shadow-[0_12px_48px_rgba(0,0,0,0.55)] backdrop-blur-2xl ring-1 ring-white/[0.04]">
            {LINKS.map(({ label, href, icon: Icon, hoverColor, hoverGlow }) => (
              <motion.a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                whileHover={{ scale: 1.2, y: -4 }}
                whileTap={{ scale: 0.93 }}
                transition={{ type: "spring", damping: 14, stiffness: 340 }}
                className="group relative inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition-colors duration-300 hover:text-[var(--hover-color)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                style={{ "--hover-color": hoverColor }}
              >
                {/* Hover halo */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    boxShadow: `0 0 20px ${hoverGlow}, 0 0 6px ${hoverGlow}`,
                    backgroundColor: "rgba(255,255,255,0.03)",
                  }}
                />
                <Icon
                  size={18}
                  strokeWidth={2}
                  className="relative z-10 transition-transform duration-300 group-hover:drop-shadow-[0_0_6px_var(--hover-color)]"
                />
                {/* Tooltip */}
                <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-zinc-950/90 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-200 opacity-0 shadow-lg backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100">
                  {label}
                </span>
              </motion.a>
            ))}
          </div>
        </div>
      </motion.nav>
    </div>
  );
}
