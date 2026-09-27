import { useEffect, useId, useRef, type ReactNode } from "react";

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    const previousFocus = previousFocusRef.current;
    const modal = modalRef.current;
    const focusable = () =>
      Array.from(
        modal?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
    if (!modal?.contains(document.activeElement))
      (focusable()[0] ?? modal)?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) {
        event.preventDefault();
        modal?.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === modal)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trapFocus);
    return () => {
      document.removeEventListener("keydown", trapFocus);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="modal-mask show"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h3 id={titleId}>{title}</h3>
        {children}
      </div>
    </div>
  );
}
