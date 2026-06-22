/**
 * API Service Layer
 * Semua komunikasi dengan backend FastAPI
 */

const BASE_URL  = import.meta.env.VITE_API_URL  || "http://localhost:8000/api";
const BASE_V2   = BASE_URL.replace(/\/api$/, "") + "/api/v2";

function getAuthHeader() {
  const token = localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handleUnauthorized() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  // Dispatch custom event so AuthContext can react without a hard reload
  window.dispatchEvent(new Event("auth:logout"));
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
    ...options,
  });
  if (res.status === 401) { handleUnauthorized(); throw new Error("Sesi habis, silakan login kembali"); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function requestV2(path, options = {}) {
  const res = await fetch(`${BASE_V2}${path}`, {
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
    ...options,
  });
  if (res.status === 401) { handleUnauthorized(); throw new Error("Sesi habis, silakan login kembali"); }
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

  update: (id, data) =>
    request(`/employees/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id) =>
    request(`/employees/${id}`, { method: "DELETE" }),

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

  wfhCheckin: (employee_id, image_base64, latitude, longitude) =>
    requestV2("/attendance/wfh-checkin", {
      method: "POST",
      body: JSON.stringify({ employee_id, image_base64, latitude, longitude }),
    }),
};

// ─── AUTH ──────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (username, password) => {
    const form = new URLSearchParams({ username, password });
    const res = await fetch(`${BASE_V2}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Login gagal" }));
      throw new Error(err.detail || "Login gagal");
    }
    return res.json();
  },
  me: () => requestV2("/auth/me"),
  bootstrap: async (username, password) => {
    const res = await fetch(`${BASE_V2}/auth/bootstrap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({ detail: "Gagal menghubungi server" }));
    if (!res.ok) throw new Error(data.detail || "Bootstrap gagal");
    return data;
  },
};

// ─── MASTER DATA ───────────────────────────────────────────────────────────

export const masterApi = {
  getCompany:  ()     => requestV2("/master/company"),
  upsertCompany: (d)  => requestV2("/master/company", { method: "PUT", body: JSON.stringify(d) }),

  listDepts:   ()     => requestV2("/master/departments"),
  deptTree:    ()     => requestV2("/master/departments/tree"),
  createDept:  (d)    => requestV2("/master/departments", { method: "POST", body: JSON.stringify(d) }),
  updateDept:  (id,d) => requestV2(`/master/departments/${id}`, { method: "PUT", body: JSON.stringify(d) }),
  deleteDept:  (id)   => requestV2(`/master/departments/${id}`, { method: "DELETE" }),

  listLocations:  ()     => requestV2("/master/locations"),
  createLocation: (d)    => requestV2("/master/locations", { method: "POST", body: JSON.stringify(d) }),
  updateLocation: (id,d) => requestV2(`/master/locations/${id}`, { method: "PUT", body: JSON.stringify(d) }),
  deleteLocation: (id)   => requestV2(`/master/locations/${id}`, { method: "DELETE" }),

  listPositions:  ()     => requestV2("/master/positions"),
  createPosition: (d)    => requestV2("/master/positions", { method: "POST", body: JSON.stringify(d) }),
  updatePosition: (id,d) => requestV2(`/master/positions/${id}`, { method: "PUT", body: JSON.stringify(d) }),
  deletePosition: (id)   => requestV2(`/master/positions/${id}`, { method: "DELETE" }),
};

// ─── SHIFTS ────────────────────────────────────────────────────────────────

export const shiftApi = {
  listShifts:    ()     => requestV2("/shifts"),
  createShift:   (d)    => requestV2("/shifts", { method: "POST", body: JSON.stringify(d) }),
  updateShift:   (id,d) => requestV2(`/shifts/${id}`, { method: "PUT", body: JSON.stringify(d) }),
  deleteShift:   (id)   => requestV2(`/shifts/${id}`, { method: "DELETE" }),

  listSchedules:  (emp) => requestV2(`/schedules${emp ? `?employee_id=${emp}` : ""}`),
  createSchedule: (d)   => requestV2("/schedules", { method: "POST", body: JSON.stringify(d) }),
  deleteSchedule: (id)  => requestV2(`/schedules/${id}`, { method: "DELETE" }),

  listHolidays:  (year) => requestV2(`/holidays${year ? `?year=${year}` : ""}`),
  createHoliday: (d)    => requestV2("/holidays", { method: "POST", body: JSON.stringify(d) }),
  deleteHoliday: (id)   => requestV2(`/holidays/${id}`, { method: "DELETE" }),
};

// ─── LEAVE ─────────────────────────────────────────────────────────────────

export const leaveApi = {
  listTypes:    ()     => requestV2("/master/leave-types"),
  createType:   (d)    => requestV2("/master/leave-types", { method: "POST", body: JSON.stringify(d) }),
  updateType:   (id,d) => requestV2(`/master/leave-types/${id}`,  { method: "PUT",    body: JSON.stringify(d) }),
  deleteType:   (id)   => requestV2(`/master/leave-types/${id}`,  { method: "DELETE" }),

  listPermissionTypes:   ()     => requestV2("/master/permission-types"),
  createPermissionType:  (d)    => requestV2("/master/permission-types", { method: "POST", body: JSON.stringify(d) }),
  updatePermissionType:  (id,d) => requestV2(`/master/permission-types/${id}`, { method: "PUT",    body: JSON.stringify(d) }),
  deletePermissionType:  (id)   => requestV2(`/master/permission-types/${id}`, { method: "DELETE" }),

  listBalances: (emp, year) => requestV2(`/leave-balances?${emp ? `employee_id=${emp}&` : ""}${year ? `year=${year}` : ""}`),
  generateAnnual: (year)   => requestV2(`/leave-balances/generate-annual?year=${year}`, { method: "POST" }),

  listRequests: (emp, status) => requestV2(`/leave-requests?${emp ? `employee_id=${emp}&` : ""}${status ? `status=${status}` : ""}`),
  createRequest: (d)         => requestV2("/leave-requests", { method: "POST", body: JSON.stringify(d) }),
  approve: (id, notes)       => requestV2(`/leave-requests/${id}/approve`, { method: "POST", body: JSON.stringify({ notes }) }),
  reject:  (id, notes)       => requestV2(`/leave-requests/${id}/reject`,  { method: "POST", body: JSON.stringify({ notes }) }),
  cancel:  (id)              => requestV2(`/leave-requests/${id}/cancel`,   { method: "POST" }),
};

// ─── OVERTIME ──────────────────────────────────────────────────────────────

export const overtimeApi = {
  listRules:    ()     => requestV2("/master/overtime-rules"),
  createRule:   (d)    => requestV2("/master/overtime-rules", { method: "POST", body: JSON.stringify(d) }),
  updateRule:   (id,d) => requestV2(`/master/overtime-rules/${id}`, { method: "PUT",    body: JSON.stringify(d) }),
  deleteRule:   (id)   => requestV2(`/master/overtime-rules/${id}`, { method: "DELETE" }),

  listRequests: (emp, status) => requestV2(`/overtime-requests?${emp ? `employee_id=${emp}&` : ""}${status ? `status=${status}` : ""}`),
  createRequest: (d)          => requestV2("/overtime-requests", { method: "POST", body: JSON.stringify(d) }),
  approve:       (id)         => requestV2(`/overtime-requests/${id}/approve`,  { method: "POST", body: JSON.stringify({}) }),
  reject:        (id)         => requestV2(`/overtime-requests/${id}/reject`,   { method: "POST", body: JSON.stringify({}) }),
  complete:      (id)         => requestV2(`/overtime-requests/${id}/complete`,  { method: "POST" }),
  deleteRequest: (id)         => requestV2(`/overtime-requests/${id}`,           { method: "DELETE" }),
};

// ─── WFH ───────────────────────────────────────────────────────────────────

export const wfhApi = {
  listRules:    ()     => requestV2("/master/wfh-rules"),
  createRule:   (d)    => requestV2("/master/wfh-rules", { method: "POST", body: JSON.stringify(d) }),
  updateRule:   (id,d) => requestV2(`/master/wfh-rules/${id}`, { method: "PUT",    body: JSON.stringify(d) }),
  deleteRule:   (id)   => requestV2(`/master/wfh-rules/${id}`, { method: "DELETE" }),

  listRequests: (emp, status) => requestV2(`/wfh-requests?${emp ? `employee_id=${emp}&` : ""}${status ? `status=${status}` : ""}`),
  createRequest: (d)          => requestV2("/wfh-requests", { method: "POST", body: JSON.stringify(d) }),
  approve:       (id)         => requestV2(`/wfh-requests/${id}/approve`, { method: "POST", body: JSON.stringify({}) }),
  reject:        (id)         => requestV2(`/wfh-requests/${id}/reject`,  { method: "POST", body: JSON.stringify({}) }),
  deleteRequest: (id)         => requestV2(`/wfh-requests/${id}`,          { method: "DELETE" }),
};

// ─── USERS ─────────────────────────────────────────────────────────────────

export const userApi = {
  listRoles:  () => requestV2("/master/roles"),
  listUsers:  () => requestV2("/users"),
  createUser: (d)    => requestV2("/users", { method: "POST", body: JSON.stringify(d) }),
  updateUser: (id,d) => requestV2(`/users/${id}`, { method: "PUT", body: JSON.stringify(d) }),
  seedDefaults: ()   => requestV2("/users/seed-defaults", { method: "POST" }),
};

// ─── REPORTS V2 ────────────────────────────────────────────────────────────

export const reportsApi = {
  departmentSummary: (start, end) =>
    requestV2(`/reports/department-summary?start_date=${start}&end_date=${end}`),

  leaveSummary: (year, emp) =>
    requestV2(`/reports/leave-summary?year=${year}${emp ? `&employee_id=${emp}` : ""}`),

  overtimeSummary: (start, end, emp) =>
    requestV2(`/reports/overtime-summary?start_date=${start}&end_date=${end}${emp ? `&employee_id=${emp}` : ""}`),

  payrollExport: (start, end) =>
    requestV2(`/reports/payroll-export?start_date=${start}&end_date=${end}`),
};
