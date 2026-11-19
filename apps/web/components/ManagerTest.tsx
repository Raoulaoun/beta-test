"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { sx } from "../lib/sx.ts";
import type { ErrKey, ScoreResult } from "../lib/types.ts";
import { errorScreen, precheck } from "../lib/view.ts";
import { AppHeader, Footer } from "./Chrome.tsx";
import { Landing, type Tab } from "./Landing.tsx";
import { Results, type FormOpen } from "./Results.tsx";
import { Analyzing, ErrorCard } from "./Status.tsx";
import type { FormState } from "./LeadForm.tsx";
import { Sent } from "./Sent.tsx";
import { ExitPrompt } from "./ExitPrompt.tsx";
import type { Links } from "../lib/server/settings.ts";
import { captureAttribution, exitPromptAllowed, formOpened, forgetSaved, loadSaved, progress, saveForLater, sendEvent, type FormSource } from "../lib/client.ts";

type Screen = "landing" | "analyzing" | "error" | "results" | "sent";

export type Initial = {
  screen?: Screen;
  err?: ErrKey;
  tab?: Tab;
  step?: number;
  result?: ScoreResult;
  fileName?: string;
  form?: Partial<FormState>;
  formErrors?: boolean;
  sentTo?: string;
  exitOpen?: boolean;
  formOpen?: FormSource; // design preview: the lead form already open in the modal
  preview?: boolean; // design preview: no saved result, no events
};

const STEP_MS = 1000;  // design/flow: one step per second
const SETTLE_MS = 700; // design/flow: pause after the last step before results

export default function ManagerTest({ initial = {}, links }: { initial?: Initial; links: Links }) {
  const [screen, setScreen] = useState<Screen>(initial.screen ?? "landing");
  const [err, setErr] = useState<ErrKey>(initial.err ?? "notstatement");
  const [tab, setTab] = useState<Tab>(initial.tab ?? "desktop");
  const [drag, setDrag] = useState(false);
  const [fileName, setFileName] = useState(initial.fileName ?? "ReportHistory.xlsx");
  const [step, setStep] = useState(initial.step ?? 0);
  const [result, setResult] = useState<ScoreResult | null>(initial.result ?? null);
  const [sentTo, setSentTo] = useState(initial.sentTo ?? "");
  const [exitOpen, setExitOpen] = useState(!!initial.exitOpen);
  const [formOpen, setFormOpen] = useState<FormOpen>(initial.formOpen ? { returnTo: null } : null);
  const beforeExit = useRef<HTMLElement | null>(null);
  const attribution = useRef("");

  const run = useRef(0);
  const timers = useRef<{ iv?: ReturnType<typeof setInterval>; t?: ReturnType<typeof setTimeout> }>({});
  const pending = useRef<{ animDone: boolean; result: ScoreResult | null }>({ animDone: false, result: null });

  const stopTimers = () => { clearInterval(timers.current.iv); clearTimeout(timers.current.t); };
  useEffect(() => stopTimers, []);

  // Attribution, landing visit, and a saved result the browser can reopen (30 days).
  useEffect(() => {
    if (initial.preview) return;
    attribution.current = captureAttribution();
    if (initial.screen && initial.screen !== "landing") return;
    const saved = loadSaved();
    if (!saved) { sendEvent("visit", attribution.current); return; }
    fetch(`/api/results/${saved.id}?token=${encodeURIComponent(saved.token)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((r) => {
        if (!r || r.converted) { forgetSaved(); sendEvent("visit", attribution.current); return; }
        setResult({ ...r, access_token: saved.token });
        setScreen("results");
      })
      .catch(() => sendEvent("visit", attribution.current));
  }, []);

  // Exit prompt: once per browser session, when the pointer leaves through the top of the
  // results page (desktop), as in design/flow.
  useEffect(() => {
    if (screen !== "results" || !result || result.saved_to_account || formOpen) return;
    const onLeave = (e: MouseEvent) => {
      if (e.clientY > 0 || e.relatedTarget) return;
      if (!exitPromptAllowed()) return;
      beforeExit.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setExitOpen(true);
      progress(result.result_id, result.access_token, "exit_prompt");
    };
    document.addEventListener("mouseout", onLeave);
    return () => document.removeEventListener("mouseout", onLeave);
  }, [screen, result, formOpen]);

  const finishIfReady = (id: number) => {
    const p = pending.current;
    if (id !== run.current || !p.animDone || !p.result) return;
    setResult(p.result);
    setScreen("results");
    window.scrollTo(0, 0);
  };

  const showError = (id: number, key: ErrKey) => {
    if (id !== run.current) return;
    stopTimers();
    setErr(key);
    setScreen("error");
    window.scrollTo(0, 0);
  };

  const handleFile = useCallback(async (f: File | undefined) => {
    if (!f) return;
    const id = ++run.current;
    stopTimers();
    setFileName(f.name || "statement");
    window.scrollTo(0, 0);
    const bad = precheck(f);
    if (bad) return showError(id, bad);
    sendEvent("upload_started", attribution.current);

    pending.current = { animDone: false, result: null };
    setStep(0);
    setScreen("analyzing");
    let s = 0;
    timers.current.iv = setInterval(() => {
      if (s >= 2) {
        clearInterval(timers.current.iv);
        timers.current.t = setTimeout(() => { pending.current.animDone = true; finishIfReady(id); }, SETTLE_MS);
      }
      s = Math.min(3, s + 1);
      setStep(s);
    }, STEP_MS);

    try {
      const qs = attribution.current ? `?${attribution.current}` : "";
      const res = await fetch(`/api/score${qs}`, { method: "POST", body: f, headers: { "content-type": "application/octet-stream" } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return showError(id, errorScreen(res.status, json?.error));
      pending.current.result = json as ScoreResult;
      if (json.result_id && json.access_token && !json.saved_to_account) saveForLater(json.result_id, json.access_token);
      finishIfReady(id);
    } catch {
      showError(id, errorScreen(undefined, undefined));
    }
  }, []);

  const onSent = (email: string) => {
    forgetSaved();
    setSentTo(email);
    setExitOpen(false);
    setFormOpen(null);
    setScreen("sent");
    window.scrollTo(0, 0);
  };
  // Every button that leads to the lead form opens it in the modal, and says which one it
  // was (form_opened). returnTo: where focus goes back when the modal closes.
  const openForm = (source: FormSource, returnTo: HTMLElement | null) => {
    setFormOpen({ returnTo });
    if (!initial.preview) formOpened(result?.result_id, result?.access_token, source);
  };
  const toForm = () => {
    setExitOpen(false);
    openForm("exit_prompt", beforeExit.current);
  };

  const goHome = (e: React.MouseEvent) => { e.preventDefault(); run.current++; stopTimers(); setScreen("landing"); window.scrollTo(0, 0); };
  const goExport = (e: React.MouseEvent) => {
    e.preventDefault();
    run.current++;
    stopTimers();
    setScreen("landing");
    setTimeout(() => { const el = document.getElementById("export"); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 12); }, 60);
  };

  return (
    <div style={sx("font-family:var(--site-font-body);color:#1C2430;background:#FAFAF8;min-height:100vh;overflow-x:clip")} data-screen={screen}>
      {screen === "landing" && <Landing tab={tab} setTab={setTab} drag={drag} setDrag={setDrag} onFile={handleFile} />}
      {screen !== "landing" && <AppHeader onHome={goHome} />}
      {screen === "analyzing" && <Analyzing fileName={fileName} step={step} />}
      {screen === "error" && <ErrorCard err={err} fileName={fileName} onFile={handleFile} onExport={goExport} />}
      {screen === "results" && result && <Results r={result} initialForm={initial.form} showFormErrors={initial.formErrors} onExport={goExport} onSent={onSent}
        formOpen={formOpen} onCloseForm={() => setFormOpen(null)} onOpenForm={(el, source) => openForm(source ?? "results_button", el)} />}
      {screen === "sent" && <Sent sentTo={sentTo} links={links} />}
      <Footer />
      {exitOpen && <ExitPrompt onClose={() => setExitOpen(false)} onToForm={toForm} />}
    </div>
  );
}
