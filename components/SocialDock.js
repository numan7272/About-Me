"use client";

import { motion } from "framer-motion";
import { Github, Linkedin, MessageSquare } from "lucide-react";

const LINKS = [
  {
    label: "GitHub",
    href: "#",
    icon: Github,
    // GitHub doesn't really have a brand color — use a neutral white-ish
    hoverColor: "#f4f4f5",
    hoverGlow: "rgba(244, 244, 245, 0.35)",
  },
  {
    label: "LinkedIn",
    href: "#",
    icon: Linkedin,
    hoverColor: "#0A66C2",
    hoverGlow: "rgba(10, 102, 194, 0.55)",
  },
  {
    label: "Discord",
    href: "#",
    icon: MessageSquare,
    hoverColor: "#5865F2",
    hoverGlow: "rgba(88, 101, 242, 0.55)",
  },
];

export default function SocialDock() {
  return (
    // Outer wrapper is pointer-events-none so panning the 3D map still works
    // when the cursor is anywhere except directly on the dock itself.
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
      <motion.nav
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        aria-label="Social links"
        className="pointer-events-auto"
      >
        <div className="relative">
          {/* Ambient glow underneath */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-3 rounded-full bg-gradient-to-r from-cyan-500/10 via-indigo-500/10 to-fuchsia-500/10 blur-2xl"
          />

          <div className="relative flex items-center gap-1 rounded-full border border-white/10 bg-zinc-900/55 px-2 py-2 shadow-[0_10px_40px_rgba(0,0,0,0.45)] backdrop-blur-2xl ring-1 ring-white/5">
            {LINKS.map(({ label, href, icon: Icon, hoverColor, hoverGlow }) => (
              <motion.a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                whileHover={{ scale: 1.18, y: -3 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", damping: 16, stiffness: 320 }}
                className="group relative inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-300 transition-colors duration-300 hover:text-[var(--hover-color)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                style={{
                  // CSS var trick lets Tailwind hover use the per-link brand color.
                  "--hover-color": hoverColor,
                }}
              >
                {/* Hover halo */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    boxShadow: `0 0 18px ${hoverGlow}, 0 0 4px ${hoverGlow}`,
                    backgroundColor: "rgba(255,255,255,0.04)",
                  }}
                />
                <Icon
                  size={18}
                  strokeWidth={2}
                  className="relative z-10 transition-transform duration-300 group-hover:drop-shadow-[0_0_6px_var(--hover-color)]"
                />
                {/* Tooltip */}
                <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-zinc-950/85 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-200 opacity-0 shadow-lg backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100">
                  {label}
                </span>
              </motion.a>
            ))}

            {/* Divider + small status indicator */}
            <span aria-hidden className="mx-1 h-5 w-px bg-white/10" />
            <div className="mr-2 flex items-center gap-1.5 px-1 text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-400">
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Online
            </div>
          </div>
        </div>
      </motion.nav>
    </div>
  );
}
