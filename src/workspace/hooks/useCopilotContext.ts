"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { CopilotContext } from "../core";

// ============================================================
// useCopilotContext — reads the workspace's copilot context from
// the DOM contract (data-copilot-context on the shell root) and
// re-reads on route or tab change. Zero coupling: Copilot only
// depends on this hook + the DOM attribute; UWE only writes to it.
// ============================================================

function readFromDom(): CopilotContext | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector<HTMLElement>("[data-copilot-context]");
  if (!el) return null;
  const raw = el.getAttribute("data-copilot-context");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CopilotContext;
    if (parsed && typeof parsed === "object" && parsed.kind && parsed.id) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function useCopilotContext(): CopilotContext | null {
  const pathname = usePathname();
  const [ctx, setCtx] = useState<CopilotContext | null>(null);

  useEffect(() => {
    // Give the shell a tick to render before reading.
    const raf = requestAnimationFrame(() => setCtx(readFromDom()));
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  useEffect(() => {
    function onSwitch() {
      setCtx(readFromDom());
    }
    window.addEventListener("workspace:tab-switched", onSwitch as EventListener);
    return () => window.removeEventListener("workspace:tab-switched", onSwitch as EventListener);
  }, []);

  return ctx;
}
