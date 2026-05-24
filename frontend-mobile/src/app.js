const API_BASE      = import.meta.env.VITE_API_URL ?? "/api";
const COUNTDOWN_SEC = 3;
const MAX_RETRY     = 3;
const AUTO_RESET_MS = 5000;

let state      = "idle";  // idle | countdown | verifying | result
let employee   = null;
let retryCount = 0;
let camStream  = null;
let cdInterval = null;
let resetTimer = null;

// ── Audio ─────────────────────────────────────────────────────────────────────

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

// ── Camera ────────────────────────────────────────────────────────────────────

async function startCamera() {
  const video = document.getElementById("video");
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    });
    video.srcObject = camStream;
    video.style.display = "block";
  } catch {
    showError("Kamera tidak dapat diakses. Izinkan akses kamera.");
  }
}

function stopCamera() {
  const video = document.getElementById("video");
  camStream?.getTracks().forEach((t) => t.stop());
  camStream = null;
  video.style.display = "none";
  video.srcObject = null;
}

function captureFrame() {
  const video = document.getElementById("video");
  if (!video?.videoWidth) return null;
  const c = document.createElement("canvas");
  c.width = video.videoWidth; c.height = video.videoHeight;
  c.getContext("2d").drawImage(video, 0, 0);
  return c.toDataURL("image/jpeg", 0.85);
}

// ── API ───────────────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const r = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.detail ?? `Server error ${r.status}`);
  }
  return r.json();
}

async function apiCardScan(uid) {
  return apiFetch("/attendance/card-scan", {
    method: "POST",
    body: JSON.stringify({ card_uid: uid }),
  });
}

async function apiVerifyFace(employeeId, imageBase64) {
  return apiFetch("/attendance/verify-face", {
    method: "POST",
    body: JSON.stringify({ employee_id: employeeId, image_base64: imageBase64 }),
  });
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function setMsg(m) { document.getElementById("statusMsg").textContent = m; }

function setOval(cls) {
  const el = document.getElementById("faceOval");
  el.className = cls ? `face-oval ${cls}` : "face-oval";
}

function setStep(n, err = false) {
  for (let i = 1; i <= 4; i++) {
    const dot  = document.getElementById("s" + i);
    const line = document.getElementById("l" + i);
    if (i < n)            { dot.className = "step-dot done";   if (line) line.className = "step-line done"; }
    else if (i === n && err) { dot.className = "step-dot error"; }
    else if (i === n)     { dot.className = "step-dot active"; }
    else                  { dot.className = "step-dot";         if (line) line.className = "step-line"; }
  }
}

function showError(msg) {
  const el = document.getElementById("errorMsg");
  el.textContent  = "⚠ " + msg;
  el.style.display = "block";
}

function hideError() { document.getElementById("errorMsg").style.display = "none"; }

function showEmployeeInfo(emp) {
  document.getElementById("idlePanel").classList.remove("visible");
  document.getElementById("manualPanel").classList.remove("visible");
  document.getElementById("empRow").classList.add("visible");
  document.getElementById("empAvatar").textContent = (emp.name || "??").substring(0, 2).toUpperCase();
  document.getElementById("empName").textContent   = emp.name || "-";
  document.getElementById("empDept").textContent   = `${emp.department || ""} · ${emp.employee_id || ""}`;
  const now = new Date();
  document.getElementById("empTime").textContent =
    String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
}

function updateClock() {
  const n = new Date();
  document.getElementById("clock").textContent =
    String(n.getHours()).padStart(2, "0") + ":" + String(n.getMinutes()).padStart(2, "0");
}

// ── Card scan ─────────────────────────────────────────────────────────────────

async function handleCardScan(uid) {
  if (!uid.trim() || state !== "idle") return;
  hideError();
  setMsg("Memproses kartu...");
  setStep(1);

  try {
    const res = await apiCardScan(uid.trim());
    if (res.status === "OK") {
      beepCard();
      employee   = res;
      retryCount = 0;
      showEmployeeInfo(res);
      setStep(2);
      await startCamera();
      startCountdown();
    } else if (res.status === "NO_FACE") {
      beepFail();
      showError("Wajah belum terdaftar untuk kartu ini. Hubungi admin.");
      setMsg("Menunggu kartu...");
    } else {
      beepFail();
      showError(res.message || "Kartu tidak dikenali");
      setMsg("Menunggu kartu...");
    }
  } catch (e) {
    showError(e.message || "Tidak dapat terhubung ke server");
    setMsg("Menunggu kartu...");
  }
}

// ── Countdown ─────────────────────────────────────────────────────────────────

function startCountdown() {
  state = "countdown";
  hideError();

  document.getElementById("idleSvg").style.opacity = "0";
  document.getElementById("scanLine").classList.add("active");
  document.getElementById("countdownWrap").classList.add("visible");
  document.getElementById("retryLabel").textContent =
    retryCount > 0 ? `Percobaan ke-${retryCount + 1}/${MAX_RETRY}` : "";
  setOval("scanning");

  let count = COUNTDOWN_SEC;
  const total = 175.9;
  document.getElementById("cdNum").textContent = count;
  document.getElementById("cdCircle").style.strokeDashoffset = "0";
  setMsg("Posisikan wajah dalam oval...");

  clearInterval(cdInterval);
  cdInterval = setInterval(() => {
    count--;
    document.getElementById("cdNum").textContent = count || "📸";
    document.getElementById("cdCircle").style.strokeDashoffset =
      String(total * (COUNTDOWN_SEC - count) / COUNTDOWN_SEC);

    if (count <= 0) {
      clearInterval(cdInterval);
      document.getElementById("countdownWrap").classList.remove("visible");
      document.getElementById("scanLine").classList.remove("active");
      doVerify();
    }
  }, 1000);
}

// ── Face verify ───────────────────────────────────────────────────────────────

async function doVerify() {
  state = "verifying";
  setStep(3);
  setMsg("Menganalisis wajah...");
  hideError();
  document.getElementById("verifyingOverlay").classList.add("visible");

  const frame = captureFrame();

  const handleRetry = async (msg) => {
    beepFail();
    retryCount++;
    document.getElementById("verifyingOverlay").classList.remove("visible");
    if (retryCount >= MAX_RETRY) {
      stopCamera();
      showResult(false, { message: `${msg}. Hubungi admin.` });
    } else {
      showError(`${msg} — percobaan ${retryCount}/${MAX_RETRY}`);
      await startCamera();
      startCountdown();
    }
  };

  if (!frame) { await handleRetry("Gagal mengambil gambar"); return; }

  try {
    const res = await apiVerifyFace(employee.employee_id, frame);
    document.getElementById("verifyingOverlay").classList.remove("visible");
    if (res.status === "SUCCESS") {
      stopCamera();
      beepSuccess();
      showResult(true, res);
    } else {
      await handleRetry(res.message || "Wajah tidak cocok");
    }
  } catch (e) {
    document.getElementById("verifyingOverlay").classList.remove("visible");
    await handleRetry(e.message || "Gagal verifikasi");
  }
}

// ── Result ────────────────────────────────────────────────────────────────────

function showResult(success, data) {
  state = "result";
  setStep(4, !success);
  setOval(success ? "success" : "fail");

  const overlay = document.getElementById("resultOverlay");
  const icon    = document.getElementById("resultIcon");

  if (success) {
    overlay.className = "result-overlay success";
    icon.className    = "result-icon-big s";
    icon.textContent  = "✓";
    document.getElementById("resultName").textContent = employee?.name || "";
    document.getElementById("resultTime").textContent = data.time || "";
    const badge = document.getElementById("resultBadge");
    badge.className   = `result-action-badge ${data.action === "check_in" ? "badge-in" : "badge-out"}`;
    badge.textContent = data.action === "check_in" ? "✓ CHECK IN" : "✓ CHECK OUT";
    document.getElementById("resultAccuracy").textContent =
      data.confidence != null ? `${((1 - data.confidence) * 100).toFixed(1)}% akurat` : "";
    setMsg("Absensi berhasil dicatat");
  } else {
    overlay.className = "result-overlay fail";
    icon.className    = "result-icon-big f";
    icon.textContent  = "✕";
    document.getElementById("resultName").textContent = data.message || "Akses Ditolak";
    document.getElementById("resultTime").textContent = "";
    const badge = document.getElementById("resultBadge");
    badge.className   = "result-action-badge badge-fail";
    badge.textContent = "AKSES DITOLAK";
    document.getElementById("resultAccuracy").textContent = "";
    setMsg(retryCount >= MAX_RETRY ? "Percobaan gagal — Hubungi admin" : "Verifikasi gagal");
  }

  resetTimer = setTimeout(resetAll, AUTO_RESET_MS);
}

// ── Reset ─────────────────────────────────────────────────────────────────────

function resetAll() {
  clearInterval(cdInterval);
  clearTimeout(resetTimer);
  stopCamera();
  state      = "idle";
  employee   = null;
  retryCount = 0;

  document.getElementById("idlePanel").classList.add("visible");
  document.getElementById("manualPanel").classList.remove("visible");
  document.getElementById("empRow").classList.remove("visible");
  document.getElementById("scanLine").classList.remove("active");
  document.getElementById("idleSvg").style.opacity = "0.10";
  document.getElementById("countdownWrap").classList.remove("visible");
  document.getElementById("resultOverlay").className = "result-overlay";
  document.getElementById("verifyingOverlay").classList.remove("visible");
  document.getElementById("cdNum").textContent = COUNTDOWN_SEC;
  document.getElementById("cdCircle").style.strokeDashoffset = "0";

  setOval("");
  hideError();
  setStep(1);
  setMsg("Menunggu kartu...");
  document.getElementById("cardInput").focus();
}

// ── Input events ──────────────────────────────────────────────────────────────

// Hidden input for physical HID RFID readers (emulate keyboard)
document.getElementById("cardInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const uid = e.target.value.trim();
    e.target.value = "";
    handleCardScan(uid);
  }
});

// Re-focus hidden input on body tap so HID keystrokes are captured
document.body.addEventListener("click", () => {
  if (state === "idle") document.getElementById("cardInput").focus();
});

// Manual entry
document.getElementById("manualBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  document.getElementById("idlePanel").classList.remove("visible");
  document.getElementById("manualPanel").classList.add("visible");
  document.getElementById("manualInput").focus();
});

document.getElementById("submitBtn").addEventListener("click", () => {
  const uid = document.getElementById("manualInput").value.trim();
  document.getElementById("manualInput").value = "";
  handleCardScan(uid);
});

document.getElementById("manualInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const uid = e.target.value.trim();
    e.target.value = "";
    handleCardScan(uid);
  }
});

document.getElementById("cancelBtn").addEventListener("click", () => {
  document.getElementById("manualPanel").classList.remove("visible");
  document.getElementById("idlePanel").classList.add("visible");
  document.getElementById("cardInput").focus();
});

// ── Init ──────────────────────────────────────────────────────────────────────

updateClock();
setInterval(updateClock, 30000);
resetAll();
