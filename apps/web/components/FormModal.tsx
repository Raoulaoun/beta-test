"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// The lead form in a dialog: centered on desktop, a full-height bottom sheet on phones.
// Built from the design's exit prompt (overlay, white card, close button).
//
// - Focus moves in on open (the first field on desktop; the sheet itself on phones, so the
//   keyboard doesn't cover the benefits before the visitor taps a field), is trapped while
//   open (the rest of the page is inert), and returns to the opening button on close.
// - X, Esc, and a click outside (desktop only) close it. Closing keeps what was typed:
//   the form's state lives with the inline form.
// - Phones: the sheet follows the visual viewport, so with the keyboard up it shrinks to the
//   visible area and the focused field is scrolled into view above the keyboard.

const DESKTOP = "(min-width:900px)";
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

type Props = { titleId: string; firstFieldId: string; returnTo: HTMLElement | null; onClose: () => void; children: React.ReactNode };

export function FormModal({ titleId, firstFieldId, returnTo, onClose, children }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const close = useRef(onClose);
  close.current = onClose;

  // Portal host; everything else on the page becomes inert while the dialog is open.
  useEffect(() => {
    const el = document.createElement("div");
    el.setAttribute("data-modal-host", "");
    document.body.appendChild(el);
    host.current = el;
    const others = Array.from(document.body.children).filter((c) => c !== el && !c.hasAttribute("inert")) as HTMLElement[];
    others.forEach((c) => c.setAttribute("inert", ""));
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = "hidden";
    setMounted(true);
    return () => {
      others.forEach((c) => c.removeAttribute("inert"));
      html.style.overflow = overflow;
      el.remove();
      if (returnTo && returnTo.isConnected) returnTo.focus({ preventScroll: true });
    };
  }, [returnTo]);

  // Initial focus.
  useEffect(() => {
    if (!mounted) return;
    const desktop = window.matchMedia(DESKTOP).matches;
    const target = desktop ? document.getElementById(firstFieldId) : panel.current;
    (target ?? panel.current)?.focus({ preventScroll: !desktop });
  }, [mounted, firstFieldId]);

  // Esc closes; Tab cycles inside the dialog.
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close.current(); return; }
      if (e.key !== "Tab" || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null || n === document.activeElement);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
      else if (!panel.current.contains(active)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mounted]);

  // Phones: size the sheet to the visible area (keyboard up or down) and keep the focused
  // field in view.
  useEffect(() => {
    if (!mounted) return;
    const vv = window.visualViewport;
    const ov = panel.current?.parentElement;
    if (!vv || !ov) return;
    const fit = () => {
      ov.style.setProperty("--mt-vvh", `${vv.height}px`);
      ov.style.setProperty("--mt-vvt", `${vv.offsetTop}px`);
    };
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      if (window.matchMedia(DESKTOP).matches || !t.matches("input, select, textarea")) return;
      setTimeout(() => t.scrollIntoView({ block: "center", behavior: "smooth" }), 280);
    };
    fit();
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    panel.current?.addEventListener("focusin", onFocusIn);
    const p = panel.current;
    return () => { vv.removeEventListener("resize", fit); vv.removeEventListener("scroll", fit); p?.removeEventListener("focusin", onFocusIn); };
  }, [mounted]);

  if (!mounted || !host.current) return null;
  return createPortal(
    <div className="mt-modal-ov" data-testid="form-modal"
      onMouseDown={(e) => { if (e.target === e.currentTarget && window.matchMedia(DESKTOP).matches) onClose(); }}>
      <div ref={panel} className="mt-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <button type="button" aria-label="Close" onClick={onClose} className="mt-modal-x">×</button>
        {children}
      </div>
    </div>,
    host.current,
  );
}
