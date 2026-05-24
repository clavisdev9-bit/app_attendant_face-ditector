import { useState, useRef, useEffect, useCallback } from "react";
import { attendanceApi } from "../utils/api";

const STEP = { IDLE: "idle", COUNTDOWN: "countdown", VERIFYING: "verifying", RESULT: "result" };
const COUNTDOWN_SEC = 3;
const MAX_RETRY     = 3;
const AUTO_RESET_MS = 5000;

// ── Audio ────────────────────────────────────────────────────────────────────

function beep(freq, dur) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
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

// ── Clock ────────────────────────────────────────────────────────────────────

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-muted)" }}>
      {time.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      &nbsp;
      <span style={{ color: "var(--accent)", fontSize: 15 }}>{time.toLocaleTimeString("id-ID")}</span>
    </div>
  );
}

// ── State machine bar ────────────────────────────────────────────────────────

const STATE_STEPS = ["IDLE", "SCANNING", "VERIFYING", "RESULT"];

function StateBar({ step, result }) {
  const current =
    step === STEP.IDLE       ? "IDLE"      :
    step === STEP.COUNTDOWN  ? "SCANNING"  :
    step === STEP.VERIFYING  ? "VERIFYING" : "RESULT";

  const color =
    current === "RESULT"
      ? (result?.status === "SUCCESS" ? "#4ade80" : "var(--red)")
      : "var(--accent)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      {STATE_STEPS.map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            padding: "3px 10px", borderRadius: 20, fontSize: 10,
            fontFamily: "var(--font-mono)", fontWeight: 600, letterSpacing: "0.06em",
            background: current === s ? `${color}22` : "transparent",
            color:      current === s ? color : "var(--text-dim)",
            border:     `1px solid ${current === s ? color : "var(--border)"}`,
            transition: "all 0.3s ease",
          }}>
            {s}
          </div>
          {i < STATE_STEPS.length - 1 && (
            <span style={{ color: "var(--text-dim)", fontSize: 9 }}>›</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ScanStation() {
  const [step, setStep]             = useState(STEP.IDLE);
  const [cardInput, setCardInput]   = useState("");
  const [employee, setEmployee]     = useState(null);
  const [result, setResult]         = useState(null);
  const [countdown, setCountdown]   = useState(COUNTDOWN_SEC);
  const [retryCount, setRetryCount] = useState(0);
  const [cameraOn, setCameraOn]     = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const [error, setError]           = useState(null);

  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const cardRef     = useRef(null);
  const resetTimer  = useRef(null);
  const employeeRef = useRef(null);  // avoid stale closure in async callbacks
  const retryRef    = useRef(0);

  // ── Camera ────────────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      setError("Kamera tidak dapat diakses. Izinkan akses kamera di browser.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCameraOn(false);
  }, []);

  const captureFrame = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    return c.toDataURL("image/jpeg", 0.85);
  }, []);

  // ── Reset ─────────────────────────────────────────────────────────────────

  const resetAll = useCallback(() => {
    stopCamera();
    clearTimeout(resetTimer.current);
    setStep(STEP.IDLE);
    setCardInput("");
    setEmployee(null);
    employeeRef.current = null;
    setResult(null);
    setError(null);
    setRetryCount(0);
    retryRef.current = 0;
    setCountdown(COUNTDOWN_SEC);
  }, [stopCamera]);

  const scheduleReset = useCallback(() => {
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(resetAll, AUTO_RESET_MS);
  }, [resetAll]);

  // ── Auto verify (called when countdown hits 0) ────────────────────────────

  const doVerify = useCallback(async () => {
    const emp = employeeRef.current;
    if (!emp) return;

    setError(null);
    setStep(STEP.VERIFYING);
    const frame = captureFrame();

    const handleRetry = async (msg) => {
      beepFail();
      const n = retryRef.current + 1;
      retryRef.current = n;
      setRetryCount(n);
      if (n >= MAX_RETRY) {
        stopCamera();
        setResult({ status: "MISMATCH", message: msg });
        setStep(STEP.RESULT);
        scheduleReset();
      } else {
        setError(`${msg} — percobaan ${n}/${MAX_RETRY}`);
        await startCamera();
        setStep(STEP.COUNTDOWN);
      }
    };

    if (!frame) {
      await handleRetry("Gagal mengambil gambar dari kamera");
      return;
    }

    try {
      const res = await attendanceApi.verifyFace(emp.employee_id, frame);
      if (res.status === "SUCCESS") {
        stopCamera();
        beepSuccess();
        setResult(res);
        setStep(STEP.RESULT);
        scheduleReset();
      } else {
        await handleRetry(res.message || "Wajah tidak cocok");
      }
    } catch (e) {
      await handleRetry(e.message || "Gagal verifikasi");
    }
  }, [captureFrame, stopCamera, startCamera, scheduleReset]);

  // ── Countdown effect — fires whenever step becomes COUNTDOWN ──────────────

  useEffect(() => {
    if (step !== STEP.COUNTDOWN) return;
    setCountdown(COUNTDOWN_SEC);

    let count = COUNTDOWN_SEC;
    const interval = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(interval);
        doVerify();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [step, doVerify]);

  // ── Card scan ─────────────────────────────────────────────────────────────

  const handleCardSubmit = async (uid) => {
    if (!uid.trim() || step !== STEP.IDLE || cardLoading) return;
    setCardLoading(true);
    setError(null);
    try {
      const res = await attendanceApi.cardScan(uid.trim());
      if (res.status === "OK") {
        beepCard();
        employeeRef.current = res;
        retryRef.current    = 0;
        setEmployee(res);
        setRetryCount(0);
        setCardInput("");
        await startCamera();
        setStep(STEP.COUNTDOWN);
      } else if (res.status === "NO_FACE") {
        beepFail();
        setError("Wajah belum terdaftar untuk kartu ini. Hubungi admin.");
        setCardInput("");
        cardRef.current?.focus();
      } else {
        beepFail();
        setError(res.message || "Kartu tidak dikenali");
        setCardInput("");
        cardRef.current?.focus();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setCardLoading(false);
    }
  };

  // ── Focus management ──────────────────────────────────────────────────────

  useEffect(() => {
    if (step === STEP.IDLE) setTimeout(() => cardRef.current?.focus(), 80);
  }, [step]);

  useEffect(() => () => { stopCamera(); clearTimeout(resetTimer.current); }, [stopCamera]);

  // ── Render ────────────────────────────────────────────────────────────────

  const inFacePhase = step === STEP.COUNTDOWN || step === STEP.VERIFYING;

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div>
        <div className="page-header flex items-center justify-between">
          <div>
            <h1 className="page-title">Terminal Absensi</h1>
            <p className="page-sub">Tap kartu → Verifikasi wajah otomatis</p>
          </div>
          <Clock />
        </div>

        <div className="scan-layout">

          {/* ── Camera panel ─────────────────────────────────────────────── */}
          <div className="camera-box" style={{ position: "relative", overflow: "hidden" }}>
            <video ref={videoRef} autoPlay playsInline muted
              style={{ display: cameraOn ? "block" : "none" }} />

            {/* Idle placeholder */}
            {!cameraOn && step !== STEP.RESULT && (
              <div style={{ textAlign: "center", color: "var(--text-dim)" }}>
                <div style={{ fontSize: 64, marginBottom: 12 }}>⬡</div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.1em" }}>
                  KAMERA TIDAK AKTIF
                </p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                  Scan kartu terlebih dahulu
                </p>
              </div>
            )}

            {/* Corner brackets + oval face guide */}
            {cameraOn && (
              <div className="camera-overlay">
                <div className="corner corner-tl" />
                <div className="corner corner-tr" />
                <div className="corner corner-bl" />
                <div className="corner corner-br" />
                <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                  <ellipse cx="50%" cy="50%" rx="27%" ry="37%"
                    fill="none"
                    stroke={step === STEP.COUNTDOWN ? "rgba(93,202,165,0.6)" : "rgba(93,202,165,0.25)"}
                    strokeWidth="2"
                    strokeDasharray="10 5" />
                </svg>
              </div>
            )}

            {/* Countdown overlay */}
            {step === STEP.COUNTDOWN && (
              <div style={{
                position: "absolute", inset: 0, zIndex: 10,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                background: "rgba(0,0,0,0.35)",
              }}>
                <div style={{
                  width: 96, height: 96, borderRadius: "50%",
                  border: "3px solid var(--accent)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: countdown === 0 ? 34 : 48,
                  fontWeight: 800, color: "var(--accent)",
                  fontFamily: "var(--font-mono)",
                  boxShadow: "0 0 28px rgba(93,202,165,0.35)",
                  transition: "font-size 0.15s ease",
                }}>
                  {countdown === 0 ? "📸" : countdown}
                </div>
                {retryCount > 0 && (
                  <p style={{ color: "#f59e0b", fontSize: 11, marginTop: 10, fontFamily: "var(--font-mono)" }}>
                    Percobaan ke-{retryCount + 1}/{MAX_RETRY}
                  </p>
                )}
                <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: retryCount > 0 ? 4 : 10 }}>
                  Posisikan wajah dalam oval
                </p>
              </div>
            )}

            {/* Verifying overlay */}
            {step === STEP.VERIFYING && (
              <div style={{
                position: "absolute", inset: 0, zIndex: 10,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                background: "rgba(0,0,0,0.5)",
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  border: "3px solid transparent",
                  borderTopColor: "#a78bfa",
                  animation: "spin 0.8s linear infinite",
                  marginBottom: 14,
                }} />
                <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Memverifikasi wajah...</p>
              </div>
            )}

            {/* Employee name badge */}
            {employee && inFacePhase && (
              <div className="camera-status">
                Verifikasi: <strong style={{ color: "var(--accent)" }}>{employee.name}</strong>
              </div>
            )}
          </div>

          {/* ── Control panel ────────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* State machine bar */}
            <div className="card">
              <p className="card-title" style={{ marginBottom: 10 }}>◈ Status</p>
              <StateBar step={step} result={result} />
              {retryCount > 0 && step !== STEP.RESULT && (
                <p style={{ fontSize: 11, color: "#f59e0b", fontFamily: "var(--font-mono)", marginTop: 8 }}>
                  ⚠ Percobaan {retryCount}/{MAX_RETRY} — pastikan wajah terkena cahaya cukup
                </p>
              )}
            </div>

            {/* RFID input */}
            <div className="card">
              <p className="card-title">◈ Scan Kartu RFID / NFC</p>
              <input
                ref={cardRef}
                className="card-field"
                placeholder={cardLoading ? "Memproses kartu..." : "Tempelkan kartu atau ketik UID..."}
                value={cardInput}
                onChange={(e) => setCardInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCardSubmit(cardInput); }}
                disabled={step !== STEP.IDLE || cardLoading}
                autoFocus
              />
              <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8, fontFamily: "var(--font-mono)" }}>
                Untuk reader fisik: pastikan reader terhubung sebagai HID keyboard
              </p>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: "var(--red-dim)", border: "1px solid rgba(255,77,106,0.3)",
                borderRadius: "var(--radius-lg)", padding: 16,
                color: "var(--red)", fontSize: 13, animation: "slideUp 0.2s ease",
              }}>
                ⚠ {error}
              </div>
            )}

            {/* Employee info card during face phase */}
            {employee && inFacePhase && (
              <div className="card" style={{ animation: "slideUp 0.3s ease" }}>
                <p className="card-title">◈ Karyawan Terdeteksi</p>
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontWeight: 800, fontSize: 18, marginBottom: 2 }}>{employee.name}</p>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
                    {employee.department}
                  </p>
                </div>
                <div style={{
                  padding: "8px 12px",
                  background: step === STEP.COUNTDOWN ? "rgba(93,202,165,0.08)" : "rgba(167,139,250,0.08)",
                  borderRadius: 8,
                  border: `1px solid ${step === STEP.COUNTDOWN ? "rgba(93,202,165,0.25)" : "rgba(167,139,250,0.25)"}`,
                  fontFamily: "var(--font-mono)", fontSize: 12,
                  color: step === STEP.COUNTDOWN ? "var(--accent)" : "#a78bfa",
                }}>
                  {step === STEP.COUNTDOWN
                    ? `📷 Pengambilan foto dalam ${countdown} detik...`
                    : "⟳ Memverifikasi identitas..."}
                </div>
                <button
                  className="btn btn-outline w-full mt-4"
                  style={{ justifyContent: "center" }}
                  onClick={resetAll}
                >
                  Batal
                </button>
              </div>
            )}

            {/* Result */}
            {step === STEP.RESULT && result && (
              <div className={`result-panel ${result.status === "SUCCESS" ? "success" : "error"}`}>
                <div className="result-icon">
                  {result.status === "SUCCESS" ? "✓" : "✕"}
                </div>

                {result.status === "SUCCESS" ? (
                  <>
                    <p className="result-name">{employee?.name}</p>
                    <p className="result-dept">{employee?.department}</p>
                    <p className="result-time">{result.time}</p>
                    <p className="result-action">
                      {result.action === "check_in" ? "🟢 CHECK IN berhasil" : "🔴 CHECK OUT berhasil"}
                    </p>
                    <p style={{ textAlign: "center", fontSize: 11, marginTop: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                      Akurasi: {((1 - result.confidence) * 100).toFixed(1)}%
                    </p>
                  </>
                ) : (
                  <>
                    <p className="result-name" style={{ color: "var(--red)" }}>Akses Ditolak</p>
                    <p className="result-dept">{result.message}</p>
                  </>
                )}

                <p style={{ textAlign: "center", fontSize: 11, marginTop: 16, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                  Mereset otomatis dalam {AUTO_RESET_MS / 1000} detik...
                </p>

                <button
                  className="btn btn-outline w-full mt-4"
                  style={{ justifyContent: "center" }}
                  onClick={resetAll}
                >
                  Selesai / Karyawan Berikutnya
                </button>
              </div>
            )}

            {/* Recent log */}
            <RecentLog />
          </div>
        </div>
      </div>
    </>
  );
}

// ── Recent log ───────────────────────────────────────────────────────────────

function RecentLog() {
  const [records, setRecords] = useState([]);
  useEffect(() => {
    attendanceApi.today().then(setRecords).catch(() => {});
    const t = setInterval(() => {
      attendanceApi.today().then(setRecords).catch(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="card" style={{ flex: 1, overflow: "hidden" }}>
      <p className="card-title">◈ Log Hari Ini ({records.length})</p>
      <div style={{ overflowY: "auto", maxHeight: 240 }}>
        {records.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>
            Belum ada absensi hari ini
          </p>
        )}
        {[...records].reverse().map((r, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "8px 0", borderBottom: "1px solid var(--border)",
          }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {r.department}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)" }}>
                {r.check_in}
              </p>
              <span className={`badge badge-${r.status === "present" ? "present" : r.status === "late" ? "late" : "absent"}`}>
                {r.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
