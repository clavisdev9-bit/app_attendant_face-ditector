import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../utils/api';
import { appName, currentYear } from '../context/constants';
import IconifyIcon from '../components/wrappers/IconifyIcon';

const FEATURES = [
  { icon: 'bx:fingerprint',    label: 'Verifikasi Wajah',   desc: 'Biometrik real-time dengan AI' },
  { icon: 'bx:credit-card',    label: 'Kartu RFID',         desc: 'Tap & go dalam 1 detik' },
  { icon: 'bx:map-pin',        label: 'WFH & GPS',          desc: 'Absensi dari mana saja' },
  { icon: 'bx:bar-chart-alt-2',label: 'Dashboard Live',     desc: 'Laporan & analitik instan' },
];

function SetupPanel({ onDone }) {
  const [su,   setSu]   = useState('');
  const [sp,   setSp]   = useState('');
  const [sp2,  setSp2]  = useState('');
  const [msg,  setMsg]  = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSetup(e) {
    e.preventDefault();
    if (!su.trim() || !sp) return;
    if (sp !== sp2) { setMsg({ ok: false, text: 'Password tidak cocok' }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const r = await authApi.bootstrap(su.trim(), sp);
      setMsg({ ok: true, text: r.message });
      onDone(su.trim());
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSetup} className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
          <IconifyIcon icon="bx:shield" className="text-amber-600 dark:text-amber-400 text-sm" />
        </div>
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
          Setup awal — buat akun Super Admin
        </p>
      </div>
      <div>
        <label className="input-label">Username</label>
        <input className="input" type="text" value={su} onChange={(e) => setSu(e.target.value)}
          placeholder="Contoh: superadmin" autoComplete="off" disabled={busy} />
      </div>
      <div>
        <label className="input-label">Password</label>
        <input className="input" type="password" value={sp} onChange={(e) => setSp(e.target.value)}
          placeholder="Min. 8 karakter" autoComplete="new-password" disabled={busy} />
      </div>
      <div>
        <label className="input-label">Konfirmasi Password</label>
        <input className="input" type="password" value={sp2} onChange={(e) => setSp2(e.target.value)}
          placeholder="Ulangi password" autoComplete="new-password" disabled={busy} />
      </div>
      {msg && (
        <div className={`${msg.ok ? 'alert-success' : 'alert-danger'} text-sm`}>
          <IconifyIcon icon={msg.ok ? 'bx:check-circle' : 'bx:error-circle'} className="text-base flex-shrink-0" />
          {msg.text}
        </div>
      )}
      <button type="submit" className="btn-primary w-full" disabled={busy || !su.trim() || !sp || !sp2}>
        {busy ? <><span className="spinner w-4 h-4" /> Membuat akun…</> : <><IconifyIcon icon="bx:user-plus" className="text-base" /> Buat Akun Super Admin</>}
      </button>
    </form>
  );
}

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPw,   setShowPw]   = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message || 'Username atau password salah');
    } finally {
      setLoading(false);
    }
  }

  function handleSetupDone(createdUsername) {
    setUsername(createdUsername);
    setShowSetup(false);
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel ── */}
      <div
        className="hidden lg:flex flex-col justify-between p-12 text-white"
        style={{ width: '46%', background: 'linear-gradient(160deg, #042C53 0%, #185FA5 100%)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
            <IconifyIcon icon="bx:fingerprint" className="text-2xl text-white" />
          </div>
          <span className="text-xl font-bold tracking-wide">{appName}</span>
        </div>

        {/* Hero text */}
        <div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Sistem Kehadiran<br />
            <span className="text-blue-300">Modern & Cerdas</span>
          </h1>
          <p className="text-blue-200 text-base mb-10 max-w-sm leading-relaxed">
            Kelola kehadiran karyawan dengan teknologi pengenalan wajah, RFID, dan GPS terintegrasi.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <div key={f.label} className="bg-white/8 border border-white/10 rounded-xl p-4 hover:bg-white/12 transition">
                <div className="flex items-center gap-2 mb-1.5">
                  <IconifyIcon icon={f.icon} className="text-blue-300 text-lg" />
                  <span className="font-semibold text-sm">{f.label}</span>
                </div>
                <p className="text-blue-300/80 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-blue-400 text-xs">
          {currentYear} © {appName} — Attendance Management System
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-slate-50 dark:bg-slate-900">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
            <IconifyIcon icon="bx:fingerprint" className="text-white text-xl" />
          </div>
          <span className="text-xl font-bold text-primary-700 dark:text-primary-400">{appName}</span>
        </div>

        <div className="w-full max-w-sm">
          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Selamat Datang</h2>
            <p className="text-slate-500 text-sm">Masuk untuk mengakses sistem kehadiran</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Username */}
            <div>
              <label className="input-label" htmlFor="u">Username</label>
              <div className="relative">
                <IconifyIcon icon="bx:user" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="u"
                  type="text"
                  className="input pl-9"
                  placeholder="Masukkan username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="input-label" htmlFor="p">Password</label>
              <div className="relative">
                <IconifyIcon icon="bx:lock-alt" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="p"
                  type={showPw ? 'text' : 'password'}
                  className="input pl-9 pr-10"
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  onClick={() => setShowPw((v) => !v)}
                  tabIndex={-1}
                >
                  <IconifyIcon icon={showPw ? 'bx:hide' : 'bx:show'} />
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="alert-danger text-sm">
                <IconifyIcon icon="bx:error-circle" className="text-base flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="btn-primary w-full py-2.5 text-sm font-semibold"
              disabled={loading || !username.trim() || !password}
            >
              {loading ? (
                <><span className="spinner w-4 h-4" /> Memverifikasi…</>
              ) : (
                <><IconifyIcon icon="bx:log-in" className="text-base" /> Masuk ke Sistem</>
              )}
            </button>
          </form>

          {/* Setup awal */}
          <div className="mt-4">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700
                         bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left"
              onClick={() => setShowSetup((v) => !v)}
            >
              <span className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <IconifyIcon icon="bx:cog" className="text-base text-slate-400" />
                Setup awal / Buat akun Super Admin
              </span>
              <IconifyIcon
                icon="bx:chevron-down"
                className={`text-slate-400 text-base transition-transform duration-200 ${showSetup ? 'rotate-180' : ''}`}
              />
            </button>

            {showSetup && (
              <div className="mt-2 p-4 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10">
                <SetupPanel onDone={handleSetupDone} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
