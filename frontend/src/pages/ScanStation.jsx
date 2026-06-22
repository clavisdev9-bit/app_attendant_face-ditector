import { useState, useRef, useEffect, useCallback } from "react";
import { attendanceApi } from "../utils/api";

const STEP = { IDLE: "idle", COUNTDOWN: "countdown", VERIFYING: "verifying", RESULT: "result" };
const COUNTDOWN_SEC = 3;
const MAX_RETRY     = 3;
const AUTO_RESET_MS = 5000;

/* ── Design tokens (matches reference) ────────────────────────────────────── */
const C = {
  bg:     '#060812', s1: '#0c0f20', s2: '#111529', s3: '#181d35',
  bd:     'rgba(108,120,255,0.13)', bd2: 'rgba(108,120,255,0.28)',
  accent: '#6c78ff', green: '#3de8a0', red: '#ff5b5b',
  amber:  '#f0a500', purple: '#af9ef0',
  text:   '#dde1f5', muted: 'rgba(221,225,245,0.42)', dim: 'rgba(221,225,245,0.18)',
};

/* ── CSS keyframes ─────────────────────────────────────────────────────────── */
const TERM_CSS = `
  @keyframes blink       { 0%,100%{opacity:1} 50%{opacity:.2} }
  @keyframes wfPulse     { 0%,100%{opacity:1} 50%{opacity:.5} }
  @keyframes rfidPulse   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(1.06)} }
  @keyframes cdPulse     { from{opacity:.5;transform:scale(.92)} to{opacity:1;transform:scale(1)} }
  @keyframes spinT       { to{transform:rotate(360deg)} }
  @keyframes bioFill     { from{width:0!important} }
  @keyframes matchPulse  { 0%,100%{opacity:.7} 50%{opacity:1} }
  @keyframes lmShow      { to{opacity:.7} }
  @keyframes beam        { 0%{top:5%;opacity:0} 8%{opacity:1} 92%{opacity:1} 100%{top:95%;opacity:0} }
  @keyframes termFadeIn  { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }

  .blink { animation: blink 1.4s ease-in-out infinite; }
  .wf-active { animation: wfPulse 1.8s ease-in-out infinite; }
  .cd-num { animation: cdPulse .9s ease-in-out infinite alternate; font-family:monospace; }
  .ss-active { animation: wfPulse 1.8s ease-in-out infinite; }
  .term-anim { animation: termFadeIn .2s ease-out both; }

  .rfid-ring::before { content:''; position:absolute; inset:-10px; border-radius:50%; border:1px solid rgba(108,120,255,.15); animation:rfidPulse 2s ease-in-out infinite; }
  .rfid-ring::after  { content:''; position:absolute; inset:-22px; border-radius:50%; border:1px solid rgba(108,120,255,.07); animation:rfidPulse 2s ease-in-out infinite .45s; }

  .vp-scanlines { position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,.1) 3px,rgba(0,0,0,.1) 4px);pointer-events:none;z-index:8; }
  .vp-grid { position:absolute;inset:0;background-image:linear-gradient(rgba(108,120,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(108,120,255,.04) 1px,transparent 1px);background-size:36px 36px;pointer-events:none; }

  .scanbeam { position:absolute;left:0;right:0;height:2.5px;background:linear-gradient(90deg,transparent,rgba(108,120,255,.9),rgba(61,232,160,.5),transparent);animation:beam 2s linear infinite;filter:blur(.5px); }
  .scanbeam-purple { background:linear-gradient(90deg,transparent,rgba(175,158,240,.9),transparent); }

  .lm { position:absolute;width:4px;height:4px;border-radius:50%;opacity:0;animation:lmShow .3s ease forwards; }

  .fc { position:absolute;width:12px;height:12px;border-style:solid;border-width:0; }
  .fc-tl { top:-1px;left:-1px;border-top-width:2px;border-left-width:2px; }
  .fc-tr { top:-1px;right:-1px;border-top-width:2px;border-right-width:2px; }
  .fc-bl { bottom:-1px;left:-1px;border-bottom-width:2px;border-left-width:2px; }
  .fc-br { bottom:-1px;right:-1px;border-bottom-width:2px;border-right-width:2px; }

  .conf-bar { transition:width .4s ease; }
  .bio-bar  { animation:bioFill .8s ease forwards; }
`;

/* ── Audio ─────────────────────────────────────────────────────────────────── */
function beep(freq, dur) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.frequency.value = freq; osc.type = "sine";
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur / 1000);
    osc.start(); osc.stop(ctx.currentTime + dur / 1000);
  } catch {}
}
const beepCard    = () => beep(880, 150);
const beepSuccess = () => beep(1047, 500);
const beepFail    = () => { beep(330, 250); setTimeout(() => beep(220, 350), 300); };

/* ── Clock ─────────────────────────────────────────────────────────────────── */
function Clock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return <span style={{ fontFamily: "monospace", fontSize: 10, color: C.dim }}>{t.toLocaleTimeString("id-ID")}</span>;
}

/* ── Workflow bar ──────────────────────────────────────────────────────────── */
const WF = ["TAP RFID","CEK DB","VALID?","KAMERA","DETEKSI","WAJAH?","MATCHING","COCOK?","TERCATAT"];

function wfIndex(step, loading, result) {
  if (loading) return 1;
  if (step === STEP.COUNTDOWN)                              return 3;
  if (step === STEP.VERIFYING)                              return 6;
  if (step === STEP.RESULT && result?.status === "SUCCESS") return 8;
  if (step === STEP.RESULT)                                 return 7;
  return 0;
}

function WorkflowBar({ step, loading, result }) {
  const idx = wfIndex(step, loading, result);
  const isErr = step === STEP.RESULT && result?.status !== "SUCCESS";
  return (
    <div style={{ display:"flex", alignItems:"center", padding:"8px 20px", gap:0, borderBottom:`1px solid ${C.bd}`, background:C.s1, flexShrink:0, overflowX:"auto" }}>
      {WF.map((lbl, i) => {
        const done   = i < idx;
        const active = i === idx;
        const err    = isErr && active;
        const s = done  ? { color:C.green,  borderColor:"rgba(61,232,160,.25)",   background:"rgba(61,232,160,.07)" }
                : err   ? { color:C.red,    borderColor:"rgba(255,91,91,.25)",     background:"rgba(255,91,91,.08)" }
                : active? { color:C.accent, borderColor:"rgba(108,120,255,.35)",   background:"rgba(108,120,255,.1)", className:"wf-active" }
                :          { color:C.dim,   borderColor:"transparent",             background:"transparent" };
        return (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:0, flexShrink:0 }}>
            <div className={active && !err ? "wf-active" : ""} style={{ padding:"3px 10px", borderRadius:20, fontSize:9, fontFamily:"monospace", fontWeight:600, letterSpacing:".04em", border:"1px solid", whiteSpace:"nowrap", transition:"all .3s", color:s.color, borderColor:s.borderColor, background:s.background }}>
              {done ? "✓ " : ""}{lbl}
            </div>
            {i < WF.length - 1 && <span style={{ color:C.dim, fontSize:10, padding:"0 3px" }}>›</span>}
          </div>
        );
      })}
    </div>
  );
}

/* ── Stage steps (right panel) ─────────────────────────────────────────────── */
const STAGES = [
  { label:"Menunggu karyawan",   sub:"Standby mode" },
  { label:"Tap kartu RFID/NFC",  sub:"Baca UID kartu" },
  { label:"Cek database",        sub:"Cari UID → data karyawan" },
  { label:"Kamera aktif",        sub:"Countdown + feedback UI" },
  { label:"Deteksi wajah",       sub:"Face detection dalam frame" },
  { label:"Face matching",       sub:"Bandingkan encoding wajah" },
  { label:"Catat absensi",       sub:"Simpan ke database" },
];

function stageIndex(step, loading) {
  if (loading)                    return 2;
  if (step === STEP.COUNTDOWN)    return 3;
  if (step === STEP.VERIFYING)    return 4;
  if (step === STEP.RESULT)       return 6;
  return 0;
}

function StageSteps({ step, loading, result }) {
  const idx   = stageIndex(step, loading);
  const isErr = step === STEP.RESULT && result?.status !== "SUCCESS";
  return (
    <div style={{ padding:"14px 18px", borderBottom:`1px solid ${C.bd}` }}>
      <div style={{ fontFamily:"monospace", fontSize:9, color:C.dim, textTransform:"uppercase", letterSpacing:".08em", marginBottom:10 }}>ALUR ABSENSI OTOMATIS</div>
      {STAGES.map((s, i) => {
        const done   = i < idx;
        const active = i === idx;
        const err    = isErr && active;
        const dot = done  ? { bg:"rgba(61,232,160,.1)", bd:C.green,  color:C.green,  txt:"✓" }
                  : err   ? { bg:"rgba(255,91,91,.1)",  bd:C.red,    color:C.red,    txt:"✕" }
                  : active? { bg:"rgba(108,120,255,.12)",bd:C.accent, color:C.accent, txt:String(i+1), cls:"ss-active" }
                  :          { bg:"transparent",         bd:C.bd2,    color:C.dim,    txt:String(i+1) };
        return (
          <div key={i}>
            <div style={{ display:"flex", alignItems:"center", gap:9 }}>
              <div className={dot.cls || ""} style={{ width:20, height:20, borderRadius:"50%", border:"1.5px solid", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"monospace", fontSize:8, transition:"all .3s", background:dot.bg, borderColor:dot.bd, color:dot.color }}>
                {dot.txt}
              </div>
              <div>
                <div style={{ fontSize:12, color:active||done ? C.text : C.muted, fontWeight:active?500:400, transition:"color .3s" }}>{s.label}</div>
                <div style={{ fontFamily:"monospace", fontSize:9, color:C.dim }}>{s.sub}</div>
              </div>
            </div>
            {i < STAGES.length - 1 && <div style={{ width:1, height:10, background:C.bd, marginLeft:9, marginTop:3, marginBottom:3 }} />}
          </div>
        );
      })}
    </div>
  );
}

/* ── Identity card ─────────────────────────────────────────────────────────── */
function IdentityCard({ employee }) {
  if (!employee) return null;
  const initials = (employee.name || "??").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{ padding:"14px 18px", borderBottom:`1px solid ${C.bd}` }} className="term-anim">
      <div style={{ fontFamily:"monospace", fontSize:9, color:C.dim, textTransform:"uppercase", letterSpacing:".08em", marginBottom:10 }}>IDENTITAS KARYAWAN</div>
      <div style={{ background:C.s2, border:`1px solid ${C.bd}`, borderRadius:10, padding:14, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-30, right:-30, width:90, height:90, borderRadius:"50%", background:"radial-gradient(circle,rgba(108,120,255,.1) 0%,transparent 70%)" }} />
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
          <div style={{ width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg,#3C3489,#6c78ff)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"monospace", fontSize:13, fontWeight:600, color:"#fff", border:"2px solid rgba(108,120,255,.35)", flexShrink:0 }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:500, color:C.text }}>{employee.name}</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{employee.department}</div>
            <div style={{ display:"inline-flex", alignItems:"center", gap:3, fontFamily:"monospace", fontSize:8, padding:"2px 6px", borderRadius:20, background:"rgba(61,232,160,.08)", color:C.green, border:"1px solid rgba(61,232,160,.2)", marginTop:4 }}>✓ TERVERIFIKASI</div>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {[["ID", `#${String(employee.employee_id||0).padStart(6,"0")}`], ["Status","Hadir"]].map(([l, v]) => (
            <div key={l} style={{ background:"rgba(0,0,0,.25)", borderRadius:6, padding:"7px 9px" }}>
              <div style={{ fontFamily:"monospace", fontSize:8, color:C.dim, textTransform:"uppercase", letterSpacing:".04em", marginBottom:3 }}>{l}</div>
              <div style={{ fontSize:12, fontWeight:500, color:C.text }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Match score ───────────────────────────────────────────────────────────── */
function MatchScore({ result, verifying }) {
  if (!result && !verifying) return null;
  const pct     = result ? Math.round((1 - result.confidence) * 100) : null;
  const success = result?.status === "SUCCESS";
  const BIO     = [["Geometri", success?97:52, C.accent], ["Tekstur", success?94:48, C.accent], ["Liveness", 100, C.green]];
  return (
    <div style={{ padding:"14px 18px", borderBottom:`1px solid ${C.bd}` }} className="term-anim">
      <div style={{ fontFamily:"monospace", fontSize:9, color:C.dim, textTransform:"uppercase", letterSpacing:".08em", marginBottom:10 }}>SKOR BIOMETRIK</div>
      {pct !== null ? (
        <>
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:10 }}>
            <div style={{ fontFamily:"monospace", fontSize:36, fontWeight:600, lineHeight:1, color:success?C.green:C.red }}>
              {pct}<span style={{ fontSize:16, color:C.muted }}>%</span>
            </div>
            <div>
              <div style={{ fontSize:12, fontWeight:500, color:C.text, marginBottom:3 }}>{success?"Confidence tinggi":"Tidak cocok"}</div>
              <div style={{ fontSize:11, color:C.muted }}>Threshold: 85%</div>
            </div>
          </div>
          {BIO.map(([lbl, val, col]) => (
            <div key={lbl} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              <span style={{ fontFamily:"monospace", fontSize:8, color:C.dim, width:54, textTransform:"uppercase", letterSpacing:".04em" }}>{lbl}</span>
              <div style={{ flex:1, height:3, background:"rgba(255,255,255,.05)", borderRadius:2, overflow:"hidden" }}>
                <div className="bio-bar" style={{ height:"100%", borderRadius:2, background:col, width:`${val}%` }} />
              </div>
              <span style={{ fontFamily:"monospace", fontSize:9, color:C.muted, width:24, textAlign:"right" }}>{val}%</span>
            </div>
          ))}
        </>
      ) : (
        <div style={{ display:"flex", alignItems:"center", gap:8, color:C.muted, fontSize:12 }}>
          <div style={{ width:14, height:14, borderRadius:"50%", border:`2px solid transparent`, borderTopColor:C.accent, animation:"spinT 1s linear infinite" }} />
          Memproses encoding wajah…
        </div>
      )}
    </div>
  );
}

/* ── Recent log ────────────────────────────────────────────────────────────── */
function RecentLog() {
  const [records, setRecords] = useState([]);
  useEffect(() => {
    attendanceApi.today().then(setRecords).catch(() => {});
    const t = setInterval(() => attendanceApi.today().then(setRecords).catch(() => {}), 15000);
    return () => clearInterval(t);
  }, []);

  const ini = n => (n||"??").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const AVG = { present:"rgba(61,232,160,.1)",  late:"rgba(240,165,0,.12)", absent:"rgba(255,91,91,.1)" };
  const AVC = { present:C.green, late:C.amber, absent:C.red };
  const BADGE = {
    present:{ bg:"rgba(61,232,160,.1)", c:C.green, bd:"rgba(61,232,160,.2)", t:"MASUK" },
    late:   { bg:"rgba(240,165,0,.1)",  c:C.amber, bd:"rgba(240,165,0,.2)",  t:"TERLAMBAT" },
    absent: { bg:"rgba(255,91,91,.1)",  c:C.red,   bd:"rgba(255,91,91,.2)",  t:"ABSEN" },
  };
  return (
    <div style={{ padding:"14px 18px", flex:1, overflow:"hidden" }}>
      <div style={{ fontFamily:"monospace", fontSize:9, color:C.dim, textTransform:"uppercase", letterSpacing:".08em", marginBottom:10 }}>AKTIVITAS TERBARU</div>
      <div style={{ display:"flex", flexDirection:"column", gap:6, overflowY:"auto", maxHeight:200 }}>
        {records.length === 0
          ? <div style={{ fontSize:11, color:C.dim, textAlign:"center", padding:"16px 0" }}>Belum ada aktivitas</div>
          : [...records].reverse().slice(0,7).map((r, i) => {
              const b = BADGE[r.status] || BADGE.absent;
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:9, padding:"7px 9px", background:C.s2, borderRadius:7, border:`1px solid ${C.bd}` }}>
                  <div style={{ width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:600, background:AVG[r.status]||AVG.absent, color:AVC[r.status]||AVC.absent, flexShrink:0 }}>{ini(r.name)}</div>
                  <span style={{ fontFamily:"monospace", fontSize:9, color:C.dim, width:40, flexShrink:0 }}>{r.check_in||"--:--"}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, fontWeight:500, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</div>
                    <div style={{ fontSize:10, color:C.dim, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.department}</div>
                  </div>
                  <div style={{ fontFamily:"monospace", fontSize:8, padding:"2px 6px", borderRadius:20, fontWeight:600, background:b.bg, color:b.c, border:`1px solid ${b.bd}`, flexShrink:0 }}>{b.t}</div>
                </div>
              );
            })
        }
      </div>
    </div>
  );
}

/* ── Corner brackets helper ────────────────────────────────────────────────── */
function CornerBrackets({ color }) {
  return ["tl","tr","bl","br"].map(k => (
    <div key={k} className={`fc fc-${k}`} style={{ borderColor: color, position:"absolute" }} />
  ));
}

/* ── Main component ─────────────────────────────────────────────────────────── */
export default function ScanStation() {
  const [step, setStep]               = useState(STEP.IDLE);
  const [cardInput, setCardInput]     = useState("");
  const [lastUID, setLastUID]         = useState("");
  const [employee, setEmployee]       = useState(null);
  const [result, setResult]           = useState(null);
  const [countdown, setCountdown]     = useState(COUNTDOWN_SEC);
  const [retryCount, setRetryCount]   = useState(0);
  const [cameraOn, setCameraOn]       = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const [error, setError]             = useState(null);
  const [confidence, setConfidence]   = useState(0);

  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const cardRef     = useRef(null);
  const resetTimer  = useRef(null);
  const employeeRef = useRef(null);
  const retryRef    = useRef(0);
  const confIv      = useRef(null);

  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video:{ width:{ideal:1280}, height:{ideal:720}, facingMode:"user" } });
      if (videoRef.current) videoRef.current.srcObject = s;
      streamRef.current = s; setCameraOn(true);
    } catch { setError("Kamera tidak dapat diakses."); }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop()); setCameraOn(false);
  }, []);

  const captureFrame = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0); return c.toDataURL("image/jpeg", 0.85);
  }, []);

  const resetAll = useCallback(() => {
    stopCamera(); clearTimeout(resetTimer.current); clearInterval(confIv.current);
    setStep(STEP.IDLE); setCardInput(""); setEmployee(null); setLastUID("");
    employeeRef.current = null; setResult(null); setError(null);
    setRetryCount(0); retryRef.current = 0; setCountdown(COUNTDOWN_SEC); setConfidence(0);
  }, [stopCamera]);

  const scheduleReset = useCallback(() => {
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(resetAll, AUTO_RESET_MS);
  }, [resetAll]);

  const animConf = useCallback(() => {
    clearInterval(confIv.current); let v = 30;
    confIv.current = setInterval(() => {
      v = Math.min(92, v + 7 + Math.random() * 6); setConfidence(Math.round(v));
      if (v >= 92) clearInterval(confIv.current);
    }, 180);
  }, []);

  const doVerify = useCallback(async () => {
    const emp = employeeRef.current; if (!emp) return;
    setError(null); setStep(STEP.VERIFYING); animConf();
    const frame = captureFrame();

    const retry = async (msg) => {
      beepFail(); clearInterval(confIv.current); setConfidence(0);
      const n = retryRef.current + 1; retryRef.current = n; setRetryCount(n);
      if (n >= MAX_RETRY) { stopCamera(); setResult({ status:"MISMATCH", message:msg }); setStep(STEP.RESULT); scheduleReset(); }
      else { setError(`${msg} — percobaan ${n}/${MAX_RETRY}`); await startCamera(); setStep(STEP.COUNTDOWN); }
    };

    if (!frame) { await retry("Gagal mengambil gambar"); return; }
    try {
      const res = await attendanceApi.verifyFace(emp.employee_id, frame);
      clearInterval(confIv.current);
      if (res.status === "SUCCESS") {
        setConfidence(Math.round((1 - res.confidence) * 100));
        stopCamera(); beepSuccess(); setResult(res); setStep(STEP.RESULT); scheduleReset();
      } else await retry(res.message || "Wajah tidak cocok");
    } catch (e) { clearInterval(confIv.current); await retry(e.message || "Gagal verifikasi"); }
  }, [captureFrame, stopCamera, startCamera, scheduleReset, animConf]);

  useEffect(() => {
    if (step !== STEP.COUNTDOWN) return;
    setCountdown(COUNTDOWN_SEC); let cnt = COUNTDOWN_SEC;
    const iv = setInterval(() => { cnt--; setCountdown(cnt); if (cnt <= 0) { clearInterval(iv); doVerify(); } }, 1000);
    return () => clearInterval(iv);
  }, [step, doVerify]);

  const handleCard = async (uid) => {
    if (!uid.trim() || step !== STEP.IDLE || cardLoading) return;
    setCardLoading(true); setError(null); setLastUID(uid.trim());
    try {
      const res = await attendanceApi.cardScan(uid.trim());
      if (res.status === "OK") {
        beepCard(); employeeRef.current = res; retryRef.current = 0;
        setEmployee(res); setRetryCount(0); setCardInput("");
        await startCamera(); setStep(STEP.COUNTDOWN);
      } else if (res.status === "NO_FACE") {
        beepFail(); setError("Wajah belum terdaftar. Hubungi admin."); setCardInput(""); cardRef.current?.focus();
      } else { beepFail(); setError(res.message || "Kartu tidak dikenali"); setCardInput(""); cardRef.current?.focus(); }
    } catch (e) { setError(e.message); }
    finally { setCardLoading(false); }
  };

  useEffect(() => { if (step === STEP.IDLE) setTimeout(() => cardRef.current?.focus(), 80); }, [step]);
  useEffect(() => () => { stopCamera(); clearTimeout(resetTimer.current); clearInterval(confIv.current); }, [stopCamera]);

  const inFace   = step === STEP.COUNTDOWN || step === STEP.VERIFYING;
  const hasCard  = !!lastUID || !!employee || cardLoading;
  const chipOk   = hasCard && !error;
  const isErr    = step === STEP.RESULT && result?.status !== "SUCCESS";
  const LM       = [[30,22],[65,22],[50,38],[35,55],[65,55],[50,65]];

  const vpMsg =
    step === STEP.IDLE      ? "Menunggu tap kartu RFID…"    :
    cardLoading             ? "Membaca UID… cek database…"  :
    step === STEP.COUNTDOWN ? `Countdown ${countdown}s — posisikan wajah…` :
    step === STEP.VERIFYING ? "Membandingkan encoding wajah…" :
    result?.status === "SUCCESS" ? "Absensi berhasil dicatat. Selamat bekerja!" :
                              "Akses ditolak — hubungi admin.";

  return (
    <>
      <style>{TERM_CSS}</style>

      {/* Break out of AdminLayout p-6 padding */}
      <div style={{ margin:"-1.5rem", background:C.bg, color:C.text, display:"flex", flexDirection:"column", minHeight:"calc(100vh - 60px)", overflow:"hidden", fontFamily:"'Inter',sans-serif" }}>

        {/* Workflow bar */}
        <WorkflowBar step={step} loading={cardLoading} result={result} />

        {/* Two-column body */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 360px", flex:1, minHeight:0 }}>

          {/* ── LEFT: Camera panel ───────────────────────────────────────── */}
          <div style={{ display:"flex", flexDirection:"column", borderRight:`1px solid ${C.bd}` }}>

            {/* Camera topbar */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 20px", borderBottom:`1px solid ${C.bd}`, background:C.s1, flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, fontFamily:"monospace", fontSize:10, color:C.dim, letterSpacing:".06em", textTransform:"uppercase" }}>
                <div className="blink" style={{ width:6, height:6, borderRadius:"50%", background:C.green }} />
                LIVE · CAM-01 · Pintu Utama
              </div>
              <Clock />
            </div>

            {/* Viewport */}
            <div style={{ flex:1, padding:"14px 18px 0", display:"flex", flexDirection:"column", gap:10, minHeight:0 }}>
              <div style={{ position:"relative", background:"#04050f", borderRadius:10, border:`1px solid ${C.bd}`, flex:1, minHeight:260, overflow:"hidden" }}>
                <div className="vp-scanlines" />
                <div className="vp-grid" />

                {/* Corner markers */}
                {["tl","tr","bl","br"].map(k => (
                  <div key={k} style={{ position:"absolute", width:18, height:18, borderColor:"rgba(108,120,255,.3)", borderStyle:"solid",
                    ...(k==="tl"?{top:12,left:12,borderWidth:"2px 0 0 2px"}:k==="tr"?{top:12,right:12,borderWidth:"2px 2px 0 0"}:k==="bl"?{bottom:12,left:12,borderWidth:"0 0 2px 2px"}:{bottom:12,right:12,borderWidth:"0 2px 2px 0"}) }} />
                ))}

                {/* State chip */}
                <div style={{ position:"absolute", top:12, left:14, zIndex:9, display:"flex", alignItems:"center", gap:5, fontFamily:"monospace", fontSize:9, padding:"3px 8px", borderRadius:4, background:"rgba(4,5,15,.78)", border:`1px solid ${C.bd2}`, backdropFilter:"blur(4px)" }}>
                  <div className="blink" style={{ width:6, height:6, borderRadius:"50%",
                    background: step===STEP.RESULT ? (isErr?C.red:C.green) : step===STEP.IDLE ? C.dim : C.accent }} />
                  {step===STEP.IDLE?"STANDBY":step===STEP.COUNTDOWN?`COUNTDOWN ${countdown}`:step===STEP.VERIFYING?"MATCHING":isErr?"DITOLAK":"TERCATAT"}
                </div>

                {/* Top-right readout */}
                <div style={{ position:"absolute", top:12, right:14, fontFamily:"monospace", fontSize:9, color:C.dim, textAlign:"right", lineHeight:1.9, letterSpacing:".04em", zIndex:9 }}>
                  RES 1920×1080<br />FOV 84°<br />IR AUTO
                </div>

                {/* Live video */}
                <video ref={videoRef} autoPlay playsInline muted
                  style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", display:cameraOn?"block":"none" }} />

                {/* IDLE: RFID ring */}
                {step===STEP.IDLE && !cardLoading && (
                  <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20, zIndex:5 }}>
                    <div className="rfid-ring" style={{ width:100, height:100, borderRadius:"50%", border:"2px solid rgba(108,120,255,.3)", display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
                      <span style={{ fontSize:38, opacity:.5 }}>📡</span>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontFamily:"monospace", fontSize:12, color:C.muted, letterSpacing:".06em" }}>TAP KARTU RFID / NFC</div>
                      <div style={{ fontSize:11, color:C.dim, marginTop:4 }}>untuk memulai absensi</div>
                    </div>
                  </div>
                )}

                {/* DB check */}
                {cardLoading && (
                  <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, zIndex:5 }}>
                    <div style={{ position:"relative", width:70, height:70 }}>
                      <div style={{ position:"absolute", inset:0, borderRadius:"50%", border:"2px solid rgba(108,120,255,.15)" }} />
                      <div style={{ position:"absolute", inset:0, borderRadius:"50%", border:"2px solid transparent", borderTopColor:C.accent, animation:"spinT .8s linear infinite" }} />
                      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26 }}>🗄️</div>
                    </div>
                    <div style={{ fontFamily:"monospace", fontSize:11, color:C.muted, letterSpacing:".05em" }}>QUERY DATABASE…</div>
                  </div>
                )}

                {/* COUNTDOWN: face guide box + big number */}
                {step===STEP.COUNTDOWN && cameraOn && (
                  <div style={{ position:"absolute", inset:0, zIndex:6, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
                    <div style={{ position:"relative", width:160, height:200 }}>
                      <div style={{ position:"absolute", inset:0, border:`1.5px solid ${C.accent}`, borderRadius:4 }} />
                      <CornerBrackets color={C.accent} />
                      <div className="scanbeam" />
                    </div>
                    <div className="cd-num" style={{ fontSize:64, fontWeight:600, color:C.accent, lineHeight:1, marginTop:16 }}>{countdown}</div>
                    <div style={{ fontFamily:"monospace", fontSize:11, color:C.muted, marginTop:8 }}>Posisikan wajah dalam kotak</div>
                  </div>
                )}

                {/* VERIFYING: purple matching face box + landmarks */}
                {step===STEP.VERIFYING && cameraOn && (
                  <div style={{ position:"absolute", inset:0, zIndex:6, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
                    <div style={{ position:"relative", width:160, height:200 }}>
                      <div style={{ position:"absolute", inset:0, border:`1.5px solid ${C.purple}`, borderRadius:4, animation:"matchPulse 1.5s ease-in-out infinite" }} />
                      <CornerBrackets color={C.purple} />
                      {LM.map(([l, t], i) => (
                        <div key={i} className="lm" style={{ left:`${l}%`, top:`${t}%`, background:C.purple, animationDelay:`${i*.08}s` }} />
                      ))}
                      <div className="scanbeam scanbeam-purple" />
                    </div>
                  </div>
                )}

                {/* RESULT: success overlay */}
                {step===STEP.RESULT && result?.status==="SUCCESS" && (
                  <div style={{ position:"absolute", inset:0, zIndex:10, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, background:"radial-gradient(ellipse at center,rgba(61,232,160,.15) 0%,transparent 70%)" }}>
                    <span style={{ fontSize:56 }}>✅</span>
                    <div style={{ fontFamily:"monospace", fontSize:13, fontWeight:600, color:C.green, letterSpacing:".04em" }}>ABSENSI BERHASIL</div>
                    <div style={{ fontFamily:"monospace", fontSize:10, color:C.muted }}>{employee?.name} · {result.time} · {result.action==="check_in"?"CHECK IN":"CHECK OUT"}</div>
                  </div>
                )}

                {/* RESULT: denied overlay */}
                {step===STEP.RESULT && isErr && (
                  <div style={{ position:"absolute", inset:0, zIndex:10, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, background:"radial-gradient(ellipse at center,rgba(255,91,91,.15) 0%,transparent 70%)" }}>
                    <span style={{ fontSize:56 }}>❌</span>
                    <div style={{ fontFamily:"monospace", fontSize:13, fontWeight:600, color:C.red, letterSpacing:".04em" }}>AKSES DITOLAK</div>
                    <div style={{ fontFamily:"monospace", fontSize:10, color:C.muted }}>{result.message}</div>
                  </div>
                )}

                {/* Retry indicator */}
                {retryCount > 0 && inFace && (
                  <div style={{ position:"absolute", bottom:38, left:"50%", transform:"translateX(-50%)", zIndex:9, fontFamily:"monospace", fontSize:10, color:C.amber, background:"rgba(0,0,0,.7)", padding:"3px 10px", borderRadius:20, border:`1px solid rgba(240,165,0,.3)`, whiteSpace:"nowrap" }}>
                    ⚠ Percobaan {retryCount + 1}/{MAX_RETRY}
                  </div>
                )}

                {/* Bottom status bar */}
                <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"20px 14px 10px", background:"linear-gradient(0deg,rgba(4,5,15,.9) 0%,transparent)", display:"flex", alignItems:"flex-end", justifyContent:"space-between", zIndex:7, pointerEvents:"none" }}>
                  <div style={{ fontFamily:"monospace", fontSize:9, color:C.accent, letterSpacing:".05em" }}>{vpMsg}</div>
                  <div style={{ fontFamily:"monospace", fontSize:9, color:C.dim }}>30fps · 4ms</div>
                </div>
              </div>

              {/* Confidence strip */}
              <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                <span style={{ fontFamily:"monospace", fontSize:9, color:C.dim, width:72, textTransform:"uppercase", letterSpacing:".06em" }}>Confidence</span>
                <div style={{ flex:1, height:3, background:C.s2, borderRadius:2, overflow:"hidden" }}>
                  <div className="conf-bar" style={{ height:"100%", borderRadius:2, background:`linear-gradient(90deg,${C.accent},${C.green})`, width:`${confidence}%` }} />
                </div>
                <span style={{ fontFamily:"monospace", fontSize:10, color:C.green, width:32, textAlign:"right" }}>{confidence>0?`${confidence}%`:"—"}</span>
              </div>

              {/* RFID input field */}
              <div style={{ display:"flex", gap:8, paddingBottom:14, flexShrink:0 }}>
                <input
                  ref={cardRef}
                  style={{ flex:1, background:C.s2, border:`1px solid ${C.bd}`, borderRadius:7, padding:"8px 12px", fontFamily:"monospace", fontSize:12, color:C.text, outline:"none", letterSpacing:".02em", transition:"border-color .15s" }}
                  placeholder={cardLoading ? "Memproses kartu…" : "Tap kartu atau ketik UID…"}
                  value={cardInput}
                  onChange={e => setCardInput(e.target.value)}
                  onKeyDown={e => { if (e.key==="Enter") handleCard(cardInput); }}
                  onFocus={e => e.target.style.borderColor = C.bd2}
                  onBlur={e  => e.target.style.borderColor = C.bd}
                  disabled={step !== STEP.IDLE || cardLoading}
                  autoFocus
                />
                <button
                  onClick={() => handleCard(cardInput)}
                  disabled={!cardInput.trim() || step !== STEP.IDLE || cardLoading}
                  style={{ padding:"8px 18px", background:C.accent, color:"#fff", border:"none", borderRadius:7, fontFamily:"monospace", fontSize:11, fontWeight:600, cursor:"pointer", letterSpacing:".04em", opacity:cardInput.trim()&&step===STEP.IDLE?1:.4, transition:"opacity .15s" }}
                >
                  SCAN
                </button>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Control panel ─────────────────────────────────────── */}
          <div style={{ background:C.s1, display:"flex", flexDirection:"column", overflowY:"auto" }}>

            <StageSteps step={step} loading={cardLoading} result={result} />

            {/* RFID card section */}
            <div style={{ padding:"14px 18px", borderBottom:`1px solid ${C.bd}` }}>
              <div style={{ fontFamily:"monospace", fontSize:9, color:C.dim, textTransform:"uppercase", letterSpacing:".08em", marginBottom:10 }}>KARTU RFID / NFC</div>
              <div style={{ background:C.s2, border:`1px solid ${C.bd}`, borderRadius:10, padding:"10px 14px", display:"flex", alignItems:"center", gap:12, marginBottom: error ? 8 : 0 }}>
                <span style={{ fontSize:18, color:hasCard&&!error?C.green:C.dim }}>💳</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"monospace", fontSize:11, color:C.accent, letterSpacing:".06em" }}>
                    {lastUID ? `UID: ${lastUID.toUpperCase()}` : "── ── ── ── ──"}
                  </div>
                  <div style={{ fontSize:11, color:C.dim, marginTop:2 }}>
                    {cardLoading?"Memproses kartu…":employee?"Karyawan ditemukan":"Belum ada kartu terdeteksi"}
                  </div>
                </div>
                <div style={{ fontFamily:"monospace", fontSize:9, padding:"2px 8px", borderRadius:20, fontWeight:600,
                  background: chipOk?"rgba(61,232,160,.1)":error?"rgba(255,91,91,.1)":C.s3,
                  color:       chipOk?C.green:error?C.red:C.dim,
                  border:     `1px solid ${chipOk?"rgba(61,232,160,.2)":error?"rgba(255,91,91,.2)":C.bd}`,
                }}>
                  {chipOk?"VALID":error?"ERROR":"IDLE"}
                </div>
              </div>
              {error && (
                <div className="term-anim" style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 11px", background:"rgba(255,91,91,.07)", border:"1px solid rgba(255,91,91,.2)", borderRadius:7, fontSize:11, color:C.red }}>
                  ⚠ {error}
                </div>
              )}
            </div>

            {(inFace || step===STEP.RESULT) && <IdentityCard employee={employee} />}
            <MatchScore result={step===STEP.RESULT?result:null} verifying={step===STEP.VERIFYING} />

            <RecentLog />

            {/* Action button */}
            <div style={{ padding:"14px 18px", flexShrink:0, borderTop:`1px solid ${C.bd}`, display:"flex", gap:8 }}>
              {step === STEP.RESULT ? (
                <button onClick={resetAll} style={{ flex:1, padding:10, borderRadius:7, border:"none", fontFamily:"monospace", fontSize:11, fontWeight:600, letterSpacing:".04em", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                  background:isErr?C.red:C.green, color:isErr?"#fff":"#021a0e" }}>
                  {isErr ? "↺ COBA LAGI" : "✓ ABSENSI TERCATAT"}
                </button>
              ) : inFace ? (
                <button onClick={resetAll} style={{ flex:1, padding:10, borderRadius:7, fontFamily:"monospace", fontSize:11, fontWeight:600, letterSpacing:".04em", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                  background:"rgba(255,91,91,.1)", color:C.red, border:"1px solid rgba(255,91,91,.2)" }}>
                  ✕ BATALKAN
                </button>
              ) : (
                <button onClick={() => cardRef.current?.focus()} style={{ flex:1, padding:10, borderRadius:7, border:"none", fontFamily:"monospace", fontSize:11, fontWeight:600, letterSpacing:".04em", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                  background:C.accent, color:"#fff" }}>
                  💳 TAP KARTU
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
