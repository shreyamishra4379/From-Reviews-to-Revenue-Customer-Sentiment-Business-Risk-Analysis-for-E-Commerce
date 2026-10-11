"use client";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

// The saved preference is "light" | "dark" | "system". <html data-theme> always holds
// the resolved theme ("light" or "dark"); globals.css styles [data-theme="dark"].

type Pref = "light" | "dark" | "system";
const KEY = "theme";
const OPTIONS: { value: Pref; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

function apply(pref: Pref) {
  const dark = pref === "dark" || (pref === "system" && darkQuery().matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

/** Inline script for <head>: applies the saved theme before first paint (no flash). */
export const themeInitScript = `(function(){try{var p=localStorage.getItem("${KEY}")||"system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;

export default function ThemeSwitch() {
  const [pref, setPref] = useState<Pref>("system");

  useEffect(() => {
    let saved: Pref = "system";
    try {
      const v = localStorage.getItem(KEY);
      if (v === "light" || v === "dark" || v === "system") saved = v;
    } catch { /* storage unavailable: follow the system */ }
    setPref(saved);
  }, []);

  // While on "system", follow the device when it switches between light and dark.
  useEffect(() => {
    apply(pref);
    if (pref !== "system") return;
    const mq = darkQuery();
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const choose = (p: Pref) => {
    // Fade colors for this one change only (see .theme-changing in globals.css).
    const root = document.documentElement;
    root.classList.add("theme-changing");
    window.setTimeout(() => root.classList.remove("theme-changing"), 300);
    setPref(p);
    try { localStorage.setItem(KEY, p); } catch { /* not persisted */ }
  };

  return (
    <div className="theme-switch" role="group" aria-label="Color theme">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button key={value} type="button" aria-pressed={pref === value} onClick={() => choose(value)}
          title={value === "system" ? "Match your device setting" : `${label} theme`}>
          <Icon size={13} strokeWidth={2} />{label}
        </button>
      ))}
    </div>
  );
}
