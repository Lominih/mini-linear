"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface UseKeyboardShortcutsOptions {
  onSearchFocus?: () => void;
  onModalClose?: () => void;
}

export function useKeyboardShortcuts(
  options: UseKeyboardShortcutsOptions = {}
) {
  const router = useRouter();
  const { onSearchFocus, onModalClose } = options;
  const pendingKeyRef = useRef<string | null>(null);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Ctrl+K / Cmd+K → focus search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onSearchFocus?.();
        return;
      }

      // Escape → close modals (skip if in input)
      if (e.key === "Escape" && !isInput) {
        onModalClose?.();
        return;
      }

      // Vim-style navigation: g+d = dashboard, g+p = projects
      if (isInput) return;

      if (pendingKeyRef.current === "g") {
        if (pendingTimeoutRef.current) {
          clearTimeout(pendingTimeoutRef.current);
          pendingTimeoutRef.current = null;
        }
        pendingKeyRef.current = null;

        if (e.key === "d") {
          router.push("/dashboard");
        } else if (e.key === "p") {
          router.push("/projects");
        }
        return;
      }

      if (e.key === "g") {
        pendingKeyRef.current = "g";
        pendingTimeoutRef.current = setTimeout(() => {
          pendingKeyRef.current = null;
          pendingTimeoutRef.current = null;
        }, 500);
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
      }
    };
  }, [router, onSearchFocus, onModalClose]);
}
