/**
 * API Service Layer
 * Semua komunikasi dengan backend FastAPI
 */

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── EMPLOYEES ─────────────────────────────────────────────────────────────

export const employeeApi = {
  list: (dept) =>
    request(`/employees${dept ? `?department=${dept}` : ""}`),

  get: (id) => request(`/employees/${id}`),

  create: (data) =>
    request("/employees", { method: "POST", body: JSON.stringify(data) }),

  enrollFace: async (employeeId, imageBlob) => {
    const form = new FormData();
    form.append("file", imageBlob, "face.jpg");
    const res = await fetch(`${BASE_URL}/employees/${employeeId}/enroll-face`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};

// ─── ATTENDANCE ────────────────────────────────────────────────────────────

export const attendanceApi = {
  cardScan: (card_uid) =>
    request("/attendance/card-scan", {
      method: "POST",
      body: JSON.stringify({ card_uid }),
    }),

  verifyFace: (employee_id, image_base64) =>
    request("/attendance/verify-face", {
      method: "POST",
      body: JSON.stringify({ employee_id, image_base64 }),
    }),

  today: () => request("/attendance/today"),

  stats: (start, end) =>
    request(`/attendance/stats${start ? `?start_date=${start}&end_date=${end}` : ""}`),

  export: async (start_date, end_date) => {
    const data = await request(
      `/attendance/export?start_date=${start_date}&end_date=${end_date}`
    );
    return data;
  },
};
