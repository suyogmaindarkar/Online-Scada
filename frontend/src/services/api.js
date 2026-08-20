import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ═══════════════════════════════════════════════════════════
// REQUEST INTERCEPTOR — Smart Token Attachment
// ═══════════════════════════════════════════════════════════
api.interceptors.request.use(
  (config) => {
    const url = config.url || '';

    // ─── Determine which token to use based on URL ───
    let token = null;

    if (url.includes('/super-admin') && !url.includes('/super-admin/login')) {
      // Super admin endpoints
      token = localStorage.getItem('superAdminToken');
    } else if (url.includes('/workspace/verify')) {
      // Public — no token needed
      token = null;
    } else if (url.includes('/workspace/login-user') || url.includes('/workspace/users')) {
      // Step 2 endpoints — use workspace token
      token = localStorage.getItem('workspaceToken');
    } else {
      // ✅ EVERYTHING ELSE — use userToken
      token = localStorage.getItem('userToken');
    }
 // ✅ ADD THIS DEBUG LINE:
    console.log(`[INTERCEPTOR] ${config.method?.toUpperCase()} ${url} | token=${token ? 'YES(' + token.substring(0, 10) + '...)' : 'NULL'}`);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ═══════════════════════════════════════════════════════════
// RESPONSE INTERCEPTOR — Handle 401 gracefully
// ✅ FIXED: Never redirects super-admin pages to /login
// ═══════════════════════════════════════════════════════════
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const code = error.response?.data?.code;
    const currentPath = window.location.pathname;

    // ─── Don't redirect if already on auth pages ───
    const publicPaths = ['/login', '/select-user'];
    if (publicPaths.includes(currentPath)) {
      return Promise.reject(error);
    }

    // ✅ NEW: Super-admin pages use different auth — never redirect to /login
    if (currentPath.startsWith('/super-admin')) {
      return Promise.reject(error);
    }

    // ─── Only redirect on specific critical auth failures ───
    // NOT on every 401 — some 401s are from background API calls
    // that shouldn't trigger a full redirect
    const criticalCodes = [
      'TOKEN_EXPIRED',
      'NO_USER_TOKEN',
      'USER_NOT_FOUND',
      'USER_INACTIVE',
      'WORKSPACE_INACCESSIBLE',
      'TENANT_MISMATCH',
    ];

    if (criticalCodes.includes(code)) {
      console.warn(`[API] Critical auth failure: ${code} — redirecting`);

      localStorage.removeItem('userToken');
      localStorage.removeItem('userData');

      const workspaceToken = localStorage.getItem('workspaceToken');
      if (workspaceToken && code === 'TOKEN_EXPIRED') {
        sessionStorage.setItem('authRedirectReason', 'Session expired. Please sign in again.');
        window.location.href = '/select-user';
      } else {
        localStorage.removeItem('workspaceToken');
        localStorage.removeItem('workspaceData');
        sessionStorage.setItem('authRedirectReason', 'Please log in again.');
        window.location.href = '/login';
      }
    } else {
      console.warn(`[API] 401 on ${error.config?.url}: ${error.response?.data?.message || 'Unauthorized'}`);
    }

    return Promise.reject(error);
  }
);

// ═══════════════════════════════════════════════════════════
// SCREEN TYPE UTILITIES
// ═══════════════════════════════════════════════════════════
export const getTemplateScreen = (screens) => {
  return screens?.find(s => s.isTemplate === true) || null;
};
export const getRegularScreens = (screens) => {
  return screens?.filter(s => !s.isTemplate && !s.isPopup) || [];
};
export const getPopupScreens = (screens) => {
  return screens?.filter(s => s.isPopup === true) || [];
};
export const mergeTemplateElements = (screenElements, templateScreen) => {
  if (!templateScreen || !Array.isArray(templateScreen.elements)) {
    return screenElements || [];
  }
  const templateEls = templateScreen.elements.map(el => ({
    ...el,
    _isTemplateElement: true,
  }));
  return [...templateEls, ...(screenElements || [])];
};

// ═══════════════════════════════════════════════════════════
// ✅ NEW: WORKSPACE API (Multi-Tenant Auth)
// ═══════════════════════════════════════════════════════════
export const workspaceAPI = {
  // Step 1: Verify workspace + admin credentials
  verify: (slug, adminEmail, adminPassword) =>
    api.post('/workspace/verify', { slug, adminEmail, adminPassword }),

  // Refresh user list (uses workspaceToken)
  getUsers: () => api.get('/workspace/users'),

  // Step 2: Login as specific user
  loginUser: (userId, password) =>
    api.post('/workspace/login-user', { userId, password }),

  // Get current user + company info (uses userToken)
  getMe: () => api.get('/workspace/me'),

  // Logout user only (keep workspace session)
  logoutUser: () => api.post('/workspace/logout-user'),

  // Full logout (clear both tokens)
  logoutAll: () => api.post('/workspace/logout-all'),
};

// ═══════════════════════════════════════════════════════════
// ✅ NEW: SUPER ADMIN API
// ═══════════════════════════════════════════════════════════
export const superAdminAPI = {
  login: (email, password) =>
    api.post('/super-admin/login', { email, password }),
  listCompanies: () => api.get('/super-admin/companies'),
  createCompany: (data) => api.post('/super-admin/companies', data),
  updateCompany: (id, data) => api.put(`/super-admin/companies/${id}`, data),
  deleteCompany: (id) => api.delete(`/super-admin/companies/${id}`, { data: { confirm: 'DELETE' } }),
  resetCompanyAdminPassword: (id, newPassword) =>
    api.post(`/super-admin/companies/${id}/reset-admin`, { newPassword }),
};

// ═══════════════════════════════════════════════════════════
// LEGACY AUTH APIs — kept for backward compat (return 410 now)
// ═══════════════════════════════════════════════════════════
export const authAPI = {
  login: (data) => api.post('/auth/login', data), // deprecated
  register: (data) => api.post('/auth/register', data), // deprecated
  getMe: () => api.get('/auth/me'),
  getAllUsers: () => api.get('/auth/users'),
  updateUser: (id, data) => api.put(`/auth/users/${id}`, data),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
};

// ═══════════════════════════════════════════════════════════
// USER MANAGEMENT APIs (scoped to current company)
// ═══════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════
// PLC / TAG / SCREEN / ALARM / RECIPE / SETTINGS APIs
// (unchanged — will be scoped by companyId in Phase 5)
// ═══════════════════════════════════════════════════════════
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

export const screenAPI = {
  getAll: () => api.get('/screens'),
  getOne: (id) => api.get(`/screens/${id}`),
  create: (data) => api.post('/screens', data),
  update: (id, data) => api.put(`/screens/${id}`, data),
  delete: (id) => api.delete(`/screens/${id}`),
};

export const discoveryAPI = {
  getNetworks: () => api.get('/discovery/networks'),
  startScan: (options = {}) => api.post('/discovery/scan', options),
  getProgress: () => api.get('/discovery/progress'),
  cancelScan: () => api.post('/discovery/cancel'),
  probeDevice: (ip, ports) => api.post('/discovery/probe', { ip, ports }),
};

export const graphicsAPI = {
  getAllGraphics: () => api.get('/graphics'),
  createGraphic: (data) => api.post('/graphics', data),
  updateGraphic: (id, data) => api.put(`/graphics/${id}`, data),
  deleteGraphic: (id) => api.delete(`/graphics/${id}`),
};

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
  getAllAlarms: () => api.get('/alarms'),
  getActiveAlarms: () => api.get('/alarms/active'),
  createAlarm: (data) => api.post('/alarms', data),
  updateAlarm: (id, data) => api.put(`/alarms/${id}`, data),
  deleteAlarm: (id) => api.delete(`/alarms/${id}`),
  acknowledgeAlarm: (id) => api.post(`/alarms/${id}/acknowledge`),
};

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
  duplicate: (id, newName) => api.post(`/recipes/${id}/duplicate`, { newName }),
  getLogs: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return api.get(`/recipes/logs?${params}`);
  },
  getLog: (logId) => api.get(`/recipes/logs/${logId}`),
  getVersions: (id) => api.get(`/recipes/${id}/versions`),
  restoreVersion: (id, versionIndex) => api.post(`/recipes/${id}/restore/${versionIndex}`),
};

export const settingsAPI = {
  getAll: () => api.get('/settings'),
  getSystemInfo: () => api.get('/settings/system-info'),
  update: (section, data) => api.put('/settings', { section, data }),
  exportBackup: (type = 'all') => api.get(`/settings/backup/export?type=${type}`),
  importBackup: (backup, options) =>
    api.post('/settings/backup/import', { backup, options }),
  reset: (section = null) => api.post('/settings/reset', { section }),
};

export default api;

// ─── TREND APIs ────────────────────────────────────────────
export const getTagHistory = (tagId, timeRange = '1h', aggregation = '10s') =>
  api.get(`/trends/history/${tagId}`, { params: { timeRange, aggregation } });

export const getMultipleTagsHistory = (tagIds, timeRange = '1h', aggregation = '10s') =>
  api.post('/trends/history/multiple', { tagIds, timeRange, aggregation });

export const getCustomRangeHistory = (tagIds, startTime, endTime, aggregation = '1m') =>
  api.post('/trends/history/custom', { tagIds, startTime, endTime, aggregation });

export const getTagStats = (tagId, timeRange = '1h') =>
  api.get(`/trends/stats/${tagId}`, { params: { timeRange } });