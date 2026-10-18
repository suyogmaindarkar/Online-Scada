import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : 'https://onlinescada-api.onrender.com/api');

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const url = config.url || '';
    let token = null;

    if (url.includes('/super-admin') && !url.includes('/super-admin/login')) {
      token = localStorage.getItem('superAdminToken');
    } else if (url.includes('/workspace/verify')) {
      // Workspace verification is intentionally unauthenticated.
    } else if (url.includes('/workspace/login-user') || url.includes('/workspace/users')) {
      token = localStorage.getItem('workspaceToken');
    } else {
      token = localStorage.getItem('userToken');
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const code = error.response?.data?.code;
    const currentPath = window.location.pathname;

    const publicPaths = ['/login', '/select-user'];
    if (publicPaths.includes(currentPath) || currentPath.startsWith('/super-admin')) {
      return Promise.reject(error);
    }

    const criticalCodes = [
      'TOKEN_EXPIRED',
      'NO_USER_TOKEN',
      'USER_NOT_FOUND',
      'USER_INACTIVE',
      'WORKSPACE_INACCESSIBLE',
      'TENANT_MISMATCH',
    ];

    if (criticalCodes.includes(code)) {
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
    }

    return Promise.reject(error);
  }
);

export const getTemplateScreen = (screens) => screens?.find(s => s.isTemplate === true) || null;
export const getRegularScreens = (screens) => screens?.filter(s => !s.isTemplate && !s.isPopup) || [];
export const getPopupScreens = (screens) => screens?.filter(s => s.isPopup === true) || [];
export const mergeTemplateElements = (screenElements, templateScreen) => {
  if (!templateScreen || !Array.isArray(templateScreen.elements)) return screenElements || [];
  const templateEls = templateScreen.elements.map(el => ({ ...el, _isTemplateElement: true }));
  return [...templateEls, ...(screenElements || [])];
};

export const workspaceAPI = {
  verify: (slug, adminEmail, adminPassword) => api.post('/workspace/verify', { slug, adminEmail, adminPassword }),
  getUsers: () => api.get('/workspace/users'),
  loginUser: (userId, password) => api.post('/workspace/login-user', { userId, password }),
  getMe: () => api.get('/workspace/me'),
  logoutUser: () => api.post('/workspace/logout-user'),
  logoutAll: () => api.post('/workspace/logout-all'),
};

export const signupAPI = {
  manual: (companyName, fullName, email, password) => api.post('/signup/manual', { companyName, fullName, email, password }),
};

export const superAdminAPI = {
  login: (email, password) => api.post('/super-admin/login', { email, password }),
  listCompanies: () => api.get('/super-admin/companies'),
  createCompany: (data) => api.post('/super-admin/companies', data),
  updateCompany: (id, data) => api.put(`/super-admin/companies/${id}`, data),
  deleteCompany: (id) => api.delete(`/super-admin/companies/${id}`, { data: { confirm: 'DELETE' } }),
  resetCompanyAdminPassword: (id, newPassword) => api.post(`/super-admin/companies/${id}/reset-admin`, { newPassword }),
  exportAllUsersCSV: () => api.get('/super-admin/users/export', { responseType: 'blob' }),
};

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  getAllUsers: () => api.get('/auth/users'),
  updateUser: (id, data) => api.put(`/auth/users/${id}`, data),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
};

export const userAPI = {
  getAll: (filters = {}) => api.get(`/users?${new URLSearchParams(filters)}`),
  getOne: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  resetPassword: (id, newPassword) => api.put(`/users/${id}/reset-password`, { newPassword }),
  changePassword: (currentPassword, newPassword) => api.put('/users/change-password', { currentPassword, newPassword }),
  toggleActive: (id) => api.put(`/users/${id}/toggle-active`),
  getStats: () => api.get('/users/stats'),
};

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
  importCSV: (csvText, mode = 'create') => api.post('/plc/import/csv', { csvText, mode }),
};

// Factory Connector install/pairing flow
export const pairingAPI = {
  create: () => api.post('/edge-pairing'),
  status: () => api.get('/edge-pairing/status'),
};
// Remote equipment start/stop/restart
export const equipmentAPI = {
  start: (id) => api.post('/equipment/' + id + '/start'),
  stop:  (id) => api.post('/equipment/' + id + '/stop'),
  restart: (id) => api.post('/equipment/' + id + '/restart'),
   connectorStatus: () => api.get('/edge/status'),
};

export const tagAPI = {
  getAll: (filters = {}) => api.get(`/tags?${new URLSearchParams(filters)}`),
  getOne: (id) => api.get(`/tags/${id}`),
  create: (data) => api.post('/tags', data),
  bulkCreate: (tags) => api.post('/tags/bulk', { tags }),
  update: (id, data) => api.put(`/tags/${id}`, data),
  delete: (id) => api.delete(`/tags/${id}`),
  writeValue: (tagName, value) => api.post('/tags/write', { tagName, value }),
  getGroups: () => api.get('/tags/groups'),
  exportCSV: () => api.get('/tags/export/csv', { responseType: 'blob' }),
  downloadTemplate: () => api.get('/tags/template/csv', { responseType: 'blob' }),
  importCSV: (csvText, mode = 'create') => api.post('/tags/import/csv', { csvText, mode }),
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
  startScan: (options = {}) => api.post('/discovery/start', options),
  getProgress: () => api.get('/discovery/status'),
  cancelScan: () => api.post('/discovery/cancel'),
  probeDevice: (ip, ports) => api.post('/discovery/probe', { ip, ports }),
};

export const alarmAPI = {
  getAll: (filters = {}) => api.get(`/alarms?${new URLSearchParams(filters)}`),
  getActive: () => api.get('/alarms/active'),
  getActiveAlarms: () => api.get('/alarms/active'),
  getHistory: (filters = {}) => api.get(`/alarms/history?${new URLSearchParams(filters)}`),
  getOne: (id) => api.get(`/alarms/${id}`),
  create: (data) => api.post('/alarms', data),
  update: (id, data) => api.put(`/alarms/${id}`, data),
  delete: (id) => api.delete(`/alarms/${id}`),
  acknowledge: (id) => api.post(`/alarms/${id}/acknowledge`),
  acknowledgeAll: () => api.post('/alarms/acknowledge-all'),
  getAllAlarms: () => api.get('/alarms'),
  acknowledgeAlarm: (id) => api.post(`/alarms/${id}/acknowledge`),
};

export const recipeAPI = {
  getAll: (filters = {}) => api.get(`/recipes?${new URLSearchParams(filters)}`),
  getOne: (id) => api.get(`/recipes/${id}`),
  create: (data) => api.post('/recipes', data),
  update: (id, data) => api.put(`/recipes/${id}`, data),
  delete: (id) => api.delete(`/recipes/${id}`),
  execute: (id, note = '') => api.post(`/recipes/${id}/execute`, { note }),
  snapshot: (data) => api.post('/recipes/snapshot', data),
  getCategories: () => api.get('/recipes/categories'),
  duplicate: (id, newName) => api.post(`/recipes/${id}/duplicate`, { newName }),
  getLogs: (filters = {}) => api.get(`/recipes/logs?${new URLSearchParams(filters)}`),
  getLog: (logId) => api.get(`/recipes/logs/${logId}`),
  getVersions: (id) => api.get(`/recipes/${id}/versions`),
  restoreVersion: (id, versionIndex) => api.post(`/recipes/${id}/restore/${versionIndex}`),
};

export const settingsAPI = {
  getAll: () => api.get('/settings'),
  getSystemInfo: () => api.get('/settings/system-info'),
  update: (section, data) => api.put('/settings', { section, data }),
  exportBackup: (type = 'all') => api.get(`/settings/backup/export?type=${type}`),
  importBackup: (backup, options) => api.post('/settings/backup/import', { backup, options }),
  reset: (section = null) => api.post('/settings/reset', { section }),
};

export const deviceAuthorizationAPI = {
  details: (userCode) => api.get('/device-authorization/details', { params: { userCode } }),
  approve: (userCode) => api.post('/device-authorization/approve', { userCode }),
};

export default api;

export const getTagHistory = (tagId, timeRange = '1h', aggregation = '10s') =>
  api.get(`/trends/history/${tagId}`, { params: { timeRange, aggregation } });

export const getMultipleTagsHistory = (tagIds, timeRange = '1h', aggregation = '10s') =>
  api.post('/trends/history/multiple', { tagIds, timeRange, aggregation });

export const getCustomRangeHistory = (tagIds, startTime, endTime, aggregation = '1m') =>
  api.post('/trends/history/custom', { tagIds, startTime, endTime, aggregation });

export const getTagStats = (tagId, timeRange = '1h') =>
  api.get(`/trends/stats/${tagId}`, { params: { timeRange } });
