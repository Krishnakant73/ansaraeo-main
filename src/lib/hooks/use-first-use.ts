"use client";

import { useCallback, useEffect, useState } from "react";

// ============================================================
// useFirstUse — remember whether this browser has seen a particular
// hint before. Contextual first-use chips are the redesign's answer to
// the traditional guided-tour tax (see Section 17 of the redesign):
// don't teach the UI, surface one small note on first hover of a novel
// concept, dismiss on scroll, never bring it back.
//
// Storage is localStorage under a namespaced key. If localStorage is
// unavailable (private mode, some embedded WebViews), the hook returns
// `firstUse=false` — better to under-hint than to spam.
// ============================================================

const NAMESPACE = "aeo:first-use:";

export function useFirstUse(key: string): { firstUse: boolean; dismiss: () => void } {
  const [firstUse, setFirstUse] = useState(false);

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(NAMESPACE + key);
      setFirstUse(!seen);
    } catch {
      setFirstUse(false);
    }
  }, [key]);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(NAMESPACE + key, "1");
    } catch {
      // Ignore — dismiss is a hint, not a critical write.
    }
    setFirstUse(false);
  }, [key]);

  return { firstUse, dismiss };
}
