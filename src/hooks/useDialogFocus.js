import { useEffect, useRef } from 'react';

const TABBABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const activeDialogStack = [];

function isVisible(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
  return element.getClientRects().length > 0;
}

export function getDialogTabbables(container) {
  if (!(container instanceof HTMLElement)) return [];
  return Array.from(container.querySelectorAll(TABBABLE_SELECTOR))
    .filter((element) => element.tabIndex >= 0 && isVisible(element));
}

/**
 * Keeps keyboard focus inside an active dialog, closes it with Escape, and
 * restores focus to the control that opened it.
 */
export function useDialogFocus({
  active,
  initialFocusRef,
  onClose,
}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return undefined;

    const dialog = dialogRef.current;
    if (!(dialog instanceof HTMLElement)) return undefined;
    activeDialogStack.push(dialog);

    const opener = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frameId = requestAnimationFrame(() => {
      const preferred = initialFocusRef?.current;
      const firstTabbable = getDialogTabbables(dialog)[0];
      const target = preferred instanceof HTMLElement && !preferred.disabled
        ? preferred
        : firstTabbable ?? dialog;
      target.focus({ preventScroll: true });
    });

    const handleKeyDown = (event) => {
      if (activeDialogStack.at(-1) !== dialog) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const tabbables = getDialogTabbables(dialog);
      if (tabbables.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = tabbables[0];
      const last = tabbables[tabbables.length - 1];
      const focused = document.activeElement;

      if (!dialog.contains(focused)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (event.shiftKey && focused === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && focused === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener('keydown', handleKeyDown, true);
      const stackIndex = activeDialogStack.lastIndexOf(dialog);
      if (stackIndex >= 0) activeDialogStack.splice(stackIndex, 1);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [active, initialFocusRef]);

  return dialogRef;
}
