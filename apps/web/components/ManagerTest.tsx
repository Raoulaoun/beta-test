"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { sx } from "../lib/sx.ts";
import type { ErrKey, ScoreResult } from "../lib/types.ts";
import { errorScreen, precheck } from "../lib/view.ts";
import { AppHeader, Footer } from "./Chrome.tsx";
import { Landing } from "./Landing.tsx";
import { Results } from "./Results.tsx";
import { Analyzing, ErrorCard } from "./Status.tsx";
import type { FormState } from "./LeadForm.tsx";

type Screen = "landing" | "analyzing" | "error" | "results";

export type Initial = {
  screen?: Screen;
  err?: ErrKey;
  tab?: "desktop" | "mobile";
  step?: number;
  result?: ScoreResult;
  fileName?: string;
  form?: Partial<FormState>;
  formErrors?: boolean;
};

const STEP_MS = 1000;  // design/flow: one step per second
const SETTLE_MS = 700; // design/flow: pause after the last step before results

export default function ManagerTest({ initial = {} }: { initial?: Initial }) {
  const [screen, setScreen] = useState<Screen>(initial.screen ?? "landing");
  const [err, setErr] = useState<ErrKey>(initial.err ?? "mt4");
  const [tab, setTab] = useState<"desktop" | "mobile">(initial.tab ?? "desktop");
  const [drag, setDrag] = useState(false);
  const [fileName, setFileName] = useState(initial.fileName ?? "ReportHistory.xlsx");
  const [step, setStep] = useState(initial.step ?? 0);
  const [result, setResult] = useState<ScoreResult | null>(initial.result ?? null);

  const run = useRef(0);
  const timers = useRef<{ iv?: ReturnType<typeof setInterval>; t?: ReturnType<typeof setTimeout> }>({});
  const pending = useRef<{ animDone: boolean; result: ScoreResult | null }>({ animDone: false, result: null });

  const stopTimers = () => { clearInterval(timers.current.iv); clearTimeout(timers.current.t); };
  useEffect(() => stopTimers, []);

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
      const res = await fetch("/api/score", { method: "POST", body: f, headers: { "content-type": "application/octet-stream" } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return showError(id, errorScreen(json?.error));
      pending.current.result = json as ScoreResult;
      finishIfReady(id);
    } catch {
      showError(id, errorScreen(undefined));
    }
  }, []);

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
      {screen === "results" && result && <Results r={result} initialForm={initial.form} showFormErrors={initial.formErrors} />}
      <Footer />
    </div>
  );
}
