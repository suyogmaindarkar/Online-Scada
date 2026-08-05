import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request interceptor — attach token ───────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor — T009: handle token expiry gracefully ──────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const code = error.response?.data?.code;
      const message = error.response?.data?.message || 'Session expired';

      // Clear auth data
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Only redirect if not already on login page
      if (window.location.pathname !== '/login') {
        // ✅ T009: Pass a reason message so Login page can show a toast
        const reason = code === 'TOKEN_EXPIRED'
          ? 'Your session has expired. Please log in again.'
          : message;

        // Store reason briefly so Login page can read + display it
        sessionStorage.setItem('authRedirectReason', reason);
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ===== AUTH APIs =====
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  getAllUsers: () => api.get('/auth/users'),
  updateUser: (id, data) => api.put(`/auth/users/${id}`, data),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
};

// ===== USER MANAGEMENT APIs =====
export const userAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return api.get(`/users?${params}`);
  },
  getOne: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  resetPassword: (id, newPassword) =>
    api.put(`/users/${id}/reset-password`, { newPassword }),
  changePassword: (currentPassword, newPassword) =>
    api.put('/users/change-password', { currentPassword, newPassword }),
  toggleActive: (id) => api.put(`/users/${id}/toggle-active`),
  getStats: () => api.get('/users/stats'),
};

// ===== PLC APIs =====
export const plcAPI = {
  getAll: () => api.get('/plc'),
  getOne: (id) => api.get(`/plc/${id}`),
  create: (data) => api.post('/plc', data),
  update: (id, data) => api.put(`/plc/${id}`, data),
  delete: (id) => api.delete(`/plc/${id}`),
  start: (id) => api.post(`/plc/${id}/start`),
  stop: (id) => api.post(`/plc/${id}/stop`),
  getStatus: (id) => api.get(`/plc/${id}/status`),
  testConnection: (id) => api.post(`/plc/${id}/test`),
   quickSimulation: () => api.post('/plc/quick-simulation'),
exportCSV: () => api.get('/plc/export/csv', { responseType: 'blob' }),
  downloadTemplate: () => api.get('/plc/template/csv', { responseType: 'blob' }),
  importCSV: (csvText, mode = 'create') =>
    api.post('/plc/import/csv', { csvText, mode }),
};

// ===== TAG APIs =====
export const tagAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return api.get(`/tags?${params}`);
  },
  getOne: (id) => api.get(`/tags/${id}`),
  create: (data) => api.post('/tags', data),
  bulkCreate: (tags) => api.post('/tags/bulk', { tags }),
  update: (id, data) => api.put(`/tags/${id}`, data),
  delete: (id) => api.delete(`/tags/${id}`),
  writeValue: (tagName, value) => api.post('/tags/write', { tagName, value }),
  getGroups: () => api.get('/tags/groups'),
exportCSV: () => api.get('/tags/export/csv', { responseType: 'blob' }),
  downloadTemplate: () => api.get('/tags/template/csv', { responseType: 'blob' }),
  importCSV: (csvText, mode = 'create') =>
    api.post('/tags/import/csv', { csvText, mode }),
};

// ===== SCREEN APIs =====
export const screenAPI = {
  getAll: () => api.get('/screens'),
  getOne: (id) => api.get(`/screens/${id}`),
  create: (data) => api.post('/screens', data),
  update: (id, data) => api.put(`/screens/${id}`, data),
  delete: (id) => api.delete(`/screens/${id}`),
};
// ===== DISCOVERY APIs =====
export const discoveryAPI = {
  getNetworks: () => api.get('/discovery/networks'),
  startScan: (options = {}) => api.post('/discovery/scan', options),
  getProgress: () => api.get('/discovery/progress'),
  cancelScan: () => api.post('/discovery/cancel'),
   probeDevice:  (ip, ports) => api.post('/discovery/probe', { ip, ports }),
};
// ===== GRAPHICS APIs =====
export const graphicsAPI = {
  getAllGraphics: () => api.get('/graphics'),
  createGraphic: (data) => api.post('/graphics', data),
  updateGraphic: (id, data) => api.put(`/graphics/${id}`, data),
  deleteGraphic: (id) => api.delete(`/graphics/${id}`),
};

// ===== ALARM APIs =====
export const alarmAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return api.get(`/alarms?${params}`);
  },
  getActive: () => api.get('/alarms/active'),
  getHistory: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return api.get(`/alarms/history?${params}`);
  },
  getOne: (id) => api.get(`/alarms/${id}`),
  create: (data) => api.post('/alarms', data),
  update: (id, data) => api.put(`/alarms/${id}`, data),
  delete: (id) => api.delete(`/alarms/${id}`),
  acknowledge: (id) => api.post(`/alarms/${id}/acknowledge`),
  acknowledgeAll: () => api.post('/alarms/acknowledge-all'),
  // Backward compatibility aliases
  getAllAlarms: () => api.get('/alarms'),
  getActiveAlarms: () => api.get('/alarms/active'),
  createAlarm: (data) => api.post('/alarms', data),
  updateAlarm: (id, data) => api.put(`/alarms/${id}`, data),
  deleteAlarm: (id) => api.delete(`/alarms/${id}`),
  acknowledgeAlarm: (id) => api.post(`/alarms/${id}/acknowledge`),
};

// ===== RECIPE APIs (updated) =====
export const recipeAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return api.get(`/recipes?${params}`);
  },
  getOne: (id) => api.get(`/recipes/${id}`),
  create: (data) => api.post('/recipes', data),
  update: (id, data) => api.put(`/recipes/${id}`, data),
  delete: (id) => api.delete(`/recipes/${id}`),
  execute: (id, note = '') => api.post(`/recipes/${id}/execute`, { note }),
  snapshot: (data) => api.post('/recipes/snapshot', data),
  getCategories: () => api.get('/recipes/categories'),

  // ✅ T054: Duplicate
  duplicate: (id, newName) => api.post(`/recipes/${id}/duplicate`, { newName }),

  // ✅ T052: Execution logs
  getLogs: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return api.get(`/recipes/logs?${params}`);
  },
  getLog: (logId) => api.get(`/recipes/logs/${logId}`),

  // ✅ T053: Version history
  getVersions: (id) => api.get(`/recipes/${id}/versions`),
  restoreVersion: (id, versionIndex) => api.post(`/recipes/${id}/restore/${versionIndex}`),
};

// ===== SETTINGS API =====
export const settingsAPI = {
  getAll: () => api.get('/settings'),
  getSystemInfo: () => api.get('/settings/system-info'),
  update: (section, data) => api.put('/settings', { section, data }),
  exportBackup: (type = 'all') => api.get(`/settings/backup/export?type=${type}`),
  importBackup: (backup, options) =>
    api.post('/settings/backup/import', { backup, options }),
  reset: (section = null) => api.post('/settings/reset', { section }),
};

// ===== DEFAULT EXPORT =====
export default api;

// ─── TREND APIs ────────────────────────────────────────────────────────────
export const getTagHistory = (tagId, timeRange = '1h', aggregation = '10s') =>
  api.get(`/trends/history/${tagId}`, { params: { timeRange, aggregation } });

export const getMultipleTagsHistory = (tagIds, timeRange = '1h', aggregation = '10s') =>
  api.post('/trends/history/multiple', { tagIds, timeRange, aggregation });

export const getCustomRangeHistory = (tagIds, startTime, endTime, aggregation = '1m') =>
  api.post('/trends/history/custom', { tagIds, startTime, endTime, aggregation });

export const getTagStats = (tagId, timeRange = '1h') =>
  api.get(`/trends/stats/${tagId}`, { params: { timeRange } });