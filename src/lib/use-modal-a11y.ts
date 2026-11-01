import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Shared accessibility hook for modals and drawers (TASK-010):
 * - Locks background page scroll while open
 * - Moves initial focus to the first interactive element or close button
 * - Traps Tab / Shift+Tab focus cycle inside the dialog
 * - Dismisses on Escape key press
 * - Restores focus to the triggering element on close
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(
  isOpenOrOptions: boolean | { isOpen: boolean; onClose: () => void },
  maybeOnClose?: () => void
) {
  const isOpen =
    typeof isOpenOrOptions === 'object' ? isOpenOrOptions.isOpen : isOpenOrOptions;
  const onClose =
    typeof isOpenOrOptions === 'object'
      ? isOpenOrOptions.onClose
      : maybeOnClose || (() => {});

  const containerRef = useRef<T | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        container.focus();
      }
    }, 20);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key === 'Tab') {
        const container = containerRef.current;
        if (!container) return;
        const focusable = Array.from(
          container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');

        if (focusable.length === 0) {
          event.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (event.shiftKey) {
          if (active === first || !container.contains(active)) {
            event.preventDefault();
            last.focus();
          }
        } else {
          if (active === last || !container.contains(active)) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        try {
          previousFocusRef.current.focus();
        } catch {
          // Ignore focus restore errors if element unmounted
        }
      }
    };
  }, [isOpen]);

  return containerRef;
}
