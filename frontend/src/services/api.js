/**
 * QueryBridge – API service layer.
 * Talks to the FastAPI/Flask backend mounted under REACT_APP_BACKEND_URL + /api.
 */
import axios from 'axios';

// Vite injects REACT_APP_BACKEND_URL via vite.config.js define.
// const RAW_BASE = import.meta.env.REACT_APP_BACKEND_URL || '';
const RAW_BASE = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:5000';
const API_BASE = `${RAW_BASE.replace(/\/$/, '')}/api`;

const AUTH_TOKEN_KEY = 'QUERYBRIDGE_AUTH_TOKEN';
const AUTH_USER_KEY = 'QUERYBRIDGE_AUTH_USER';
const ACTIVE_WS_KEY = 'QUERYBRIDGE_ACTIVE_WS';

export const getApiUrl = () => API_BASE;
console.log("VITE_BACKEND_URL =", import.meta.env.VITE_BACKEND_URL);

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/* ─── Auth ─────────────────────────────────────────────────────────────── */

export const getStoredAuth = () => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const raw = localStorage.getItem(AUTH_USER_KEY);
  if (!token || !raw) return null;
  try { return { token, user: JSON.parse(raw) }; }
  catch { localStorage.removeItem(AUTH_TOKEN_KEY); localStorage.removeItem(AUTH_USER_KEY); return null; }
};

const persistAuth = ({ token, user }) => {
   console.log("TOKEN RECEIVED:", token);
   console.log("USER RECEIVED:", user);
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  return { token, user };
};

const errMsg = (e, fallback) =>
  e?.response?.data?.message || e?.response?.data?.error || fallback;

const wrap = async (fn) => {
  try { const { data } = await fn(); return { success: true, ...data }; }
  catch (e) {
    if (e?.response?.status === 401) logoutUser();
    return { success: false, error: errMsg(e, 'Request failed.'),
             status: e?.response?.status, payload: e?.response?.data };
  }
};

export const registerUser = ({ name, email, password }) =>
  wrap(async () => {
    const r = await api.post('/auth/register', { name, email, password });
    persistAuth(r.data);
    return r;
  });

export const loginUser = ({ email, password }) =>
  wrap(async () => {
    const r = await api.post('/auth/login', { email, password });
    persistAuth(r.data);
    return r;
  });

export const fetchCurrentUser = () =>
  wrap(async () => {
    const r = await api.get('/auth/me');
    const cur = getStoredAuth();
    if (cur?.token) persistAuth({ token: cur.token, user: r.data.user });
    return r;
  });

export const logoutUser = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(ACTIVE_WS_KEY);
};

/* ─── Active workspace persistence ─────────────────────────────────────── */

export const getActiveWorkspaceId = () => {
  const v = localStorage.getItem(ACTIVE_WS_KEY);
  return v ? parseInt(v, 10) : null;
};
export const setActiveWorkspaceId = (id) =>
  id ? localStorage.setItem(ACTIVE_WS_KEY, String(id))
     : localStorage.removeItem(ACTIVE_WS_KEY);

/* ─── Workspaces ──────────────────────────────────────────────────────── */

export const listWorkspaces = () => wrap(() => api.get('/workspaces'));
export const createWorkspace = (name, description) =>
  wrap(() => api.post('/workspaces', { name, description }));
export const getWorkspace = (id) => wrap(() => api.get(`/workspaces/${id}`));
export const listMembers = (id) => wrap(() => api.get(`/workspaces/${id}/members`));
export const inviteMember = (id, email, role) =>
  wrap(() => api.post(`/workspaces/${id}/members`, { email, role }));
export const updateMember = (id, userId, role) =>
  wrap(() => api.patch(`/workspaces/${id}/members/${userId}`, { role }));
export const removeMember = (id, userId) =>
  wrap(() => api.delete(`/workspaces/${id}/members/${userId}`));

/* ─── Databases ────────────────────────────────────────────────────────── */

export const listDatabases = (wsId) =>
  wrap(() => api.get(`/workspaces/${wsId}/databases`));
export const testDatabase = (wsId, payload) =>
  wrap(() => api.post(`/workspaces/${wsId}/databases/test`, payload));
export const createDatabase = (wsId, payload) =>
  wrap(() => api.post(`/workspaces/${wsId}/databases`, payload));
export const updateDatabase = (wsId, dbId, payload) =>
  wrap(() => api.patch(`/workspaces/${wsId}/databases/${dbId}`, payload));
export const deleteDatabase = (wsId, dbId) =>
  wrap(() => api.delete(`/workspaces/${wsId}/databases/${dbId}`));
export const refreshSchema = (wsId, dbId) =>
  wrap(() => api.post(`/workspaces/${wsId}/databases/${dbId}/refresh-schema`));
export const getDatabaseSchema = (wsId, dbId) =>
  wrap(() => api.get(`/workspaces/${wsId}/databases/${dbId}/schema`));
export const listDbPermissions = (wsId, dbId) =>
  wrap(() => api.get(`/workspaces/${wsId}/databases/${dbId}/permissions`));
export const grantDbPermission = (wsId, dbId, userId, role) =>
  wrap(() => api.post(`/workspaces/${wsId}/databases/${dbId}/permissions`,
                       { user_id: userId, role }));
export const revokeDbPermission = (wsId, dbId, userId) =>
  wrap(() => api.delete(`/workspaces/${wsId}/databases/${dbId}/permissions/${userId}`));
export const setTablePermissions = (wsId, dbId, userId, mode, tables) =>
  wrap(() => api.post(`/workspaces/${wsId}/databases/${dbId}/table-permissions`,
                       { user_id: userId, mode, tables }));

/* ─── Access requests ─────────────────────────────────────────────────── */

export const requestAccess = (wsId, dbId, requested_role, reason) =>
  wrap(() => api.post(`/workspaces/${wsId}/access-requests`,
                       { db_id: dbId, requested_role, reason }));
export const listAccessRequests = (wsId, status = '') =>
  wrap(() => api.get(`/workspaces/${wsId}/access-requests${status ? `?status=${status}` : ''}`));
export const approveRequest = (wsId, reqId) =>
  wrap(() => api.post(`/workspaces/${wsId}/access-requests/${reqId}/approve`));
export const rejectRequest = (wsId, reqId) =>
  wrap(() => api.post(`/workspaces/${wsId}/access-requests/${reqId}/reject`));

/* ─── High-risk approvals ─────────────────────────────────────────────── */

export const listApprovals = (wsId) =>
  wrap(() => api.get(`/workspaces/${wsId}/approvals`));
export const approveQuery = (wsId, apId) =>
  wrap(() => api.post(`/workspaces/${wsId}/approvals/${apId}/approve`));
export const rejectQuery = (wsId, apId, blockPattern = false) =>
  wrap(() => api.post(`/workspaces/${wsId}/approvals/${apId}/reject`,
                       { block_pattern: !!blockPattern }));

/* ─── Audit & Analytics ───────────────────────────────────────────────── */

export const listAudit = (wsId, params = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([_, v]) => v));
  return wrap(() => api.get(`/workspaces/${wsId}/audit?${qs.toString()}`));
};
export const getAnalytics = (wsId) =>
  wrap(() => api.get(`/workspaces/${wsId}/analytics/overview`));

/* ─── Generate ────────────────────────────────────────────────────────── */

export const generateQuery = (wsId, dbId, prompt) =>
  wrap(() => api.post(`/workspaces/${wsId}/databases/${dbId}/generate`, { prompt }));

/* ─── History ─────────────────────────────────────────────────────────── */

export const getHistory = (params = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined && v !== ''));
  return wrap(() => api.get(`/history?${qs.toString()}`));
};
export const toggleFavoriteHistory = (id) =>
  wrap(() => api.post(`/history/${id}/favorite`));
export const deleteHistory = (id) => wrap(() => api.delete(`/history/${id}`));

/* ─── User search ─────────────────────────────────────────────────────── */
export const searchUsers = (q) =>
  wrap(() => api.get(`/users/search?q=${encodeURIComponent(q || '')}`));

/* ─── Misc ────────────────────────────────────────────────────────────── */

// export const getRoles = () => wrap(() => api.get('/roles'));
export const getHealth = () => wrap(() => api.get('/health'));
export const getRoles = async () => ({
  success: true,
  roles: [
    { id: "platform_admin", name: "Platform Admin" },
    { id: "workspace_admin", name: "Workspace Admin" },
    { id: "editor", name: "Editor" },
    { id: "viewer", name: "Viewer" }
  ]
});