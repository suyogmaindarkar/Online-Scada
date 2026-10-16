// ═══════════════════════════════════════════════════════════
// App.jsx — Multi-Tenant + Super Admin Routing
// ═══════════════════════════════════════════════════════════

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SuperAdminAuthProvider } from './context/SuperAdminAuthContext';
import { ToastProvider } from './context/ToastContext';
import { AlarmNotificationProvider } from './context/AlarmNotificationContext';
import { ServerTimeProvider } from './context/ServerTimeContext';
import ProtectedRoute from './components/ProtectedRoute';
import SuperAdminProtectedRoute from './components/superAdmin/SuperAdminProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import ChatBot from './components/chatbot/ChatBot';
import Help from './pages/Help';
// Workspace auth pages
import WorkspaceLogin from './pages/WorkspaceLogin';
import UserSelection from './pages/UserSelection';

// Super admin pages
import SuperAdminLogin from './pages/SuperAdminLogin';
import SuperAdminDashboard from './pages/SuperAdminDashboard';

// Main app pages
import Dashboard from './pages/Dashboard';
import PLCManagement from './pages/PLCManagement';
import ConnectorAuthorize from './pages/ConnectorAuthorize';
import TagManagement from './pages/TagManagement';
import GraphicDesigner from './pages/GraphicDesigner';
import Runtime from './pages/Runtime';
import Alarms from './pages/Alarms';
import Trends from './pages/Trends';
import Recipes from './pages/Recipes';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Settings from './pages/Settings';

// ─── Role hierarchy ─────────────────────────────────────
const ROLE_ADMIN_ONLY = ['admin'];
const ROLE_ENGINEER = ['admin', 'engineer'];
const ROLE_ALL = ['admin', 'engineer', 'operator', 'viewer'];

function App() {
  return (
    <SuperAdminAuthProvider>
      <AuthProvider>
        <ToastProvider>
          <AlarmNotificationProvider>
            <ServerTimeProvider>
              <BrowserRouter>
                <div className="font-sans h-screen" style={{ backgroundColor: '#F8FAFC', color: '#081B43' }}>
                  <Routes>
                    {/* ═══════ SUPER ADMIN ROUTES ═══════ */}
                    <Route path="/super-admin/login" element={<SuperAdminLogin />} />
                    <Route path="/super-admin/dashboard"
                      element={
                        <SuperAdminProtectedRoute>
                          <SuperAdminDashboard />
                        </SuperAdminProtectedRoute>
                      } />
                    <Route path="/super-admin" element={<Navigate to="/super-admin/dashboard" replace />} />

                    {/* ═══════ WORKSPACE AUTH ROUTES ═══════ */}
                    <Route path="/login" element={<WorkspaceLogin />} />
                    <Route path="/select-user" element={<UserSelection />} />
                    <Route path="/connector/authorize" element={<ConnectorAuthorize />} />

                    {/* ═══════ ADMIN + ENGINEER ONLY ═══════ */}
                    <Route path="/dashboard"
                      element={<ProtectedRoute allowedRoles={ROLE_ENGINEER}><MainLayout><Dashboard /></MainLayout></ProtectedRoute>} />
                    <Route path="/plc"
                      element={<ProtectedRoute allowedRoles={ROLE_ENGINEER}><MainLayout><PLCManagement /></MainLayout></ProtectedRoute>} />
                    <Route path="/tags"
                      element={<ProtectedRoute allowedRoles={ROLE_ENGINEER}><MainLayout><TagManagement /></MainLayout></ProtectedRoute>} />
                    <Route path="/edge-gateways" element={<Navigate to="/plc" replace />} />
                    <Route path="/designer"
                      element={<ProtectedRoute allowedRoles={ROLE_ENGINEER}><MainLayout><GraphicDesigner /></MainLayout></ProtectedRoute>} />
                    <Route path="/trends"
                      element={<ProtectedRoute allowedRoles={ROLE_ENGINEER}><MainLayout><Trends /></MainLayout></ProtectedRoute>} />
                    <Route path="/recipes"
                      element={<ProtectedRoute allowedRoles={ROLE_ENGINEER}><MainLayout><Recipes /></MainLayout></ProtectedRoute>} />
                    <Route path="/reports"
                      element={<ProtectedRoute allowedRoles={ROLE_ENGINEER}><MainLayout><Reports /></MainLayout></ProtectedRoute>} />

                    {/* ═══════ ADMIN ONLY ═══════ */}
                    <Route path="/users"
                      element={<ProtectedRoute allowedRoles={ROLE_ADMIN_ONLY}><MainLayout><Users /></MainLayout></ProtectedRoute>} />
                    <Route path="/settings"
                      element={<ProtectedRoute allowedRoles={ROLE_ADMIN_ONLY}><MainLayout><Settings /></MainLayout></ProtectedRoute>} />

                    {/* ═══════ ALARMS + RUNTIME — All roles ═══════ */}
                    <Route path="/alarms"
                      element={<ProtectedRoute allowedRoles={ROLE_ALL}><MainLayout><Alarms /></MainLayout></ProtectedRoute>} />
                    <Route path="/runtime"
                      element={<ProtectedRoute allowedRoles={ROLE_ALL}><Runtime /></ProtectedRoute>} />

                    {/* ═══════ ROOT + CATCH-ALL ═══════ */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    {/* ═══════ HELP — All Roles ═══════ */}
                    <Route path="/help"
                      element={<ProtectedRoute allowedRoles={ROLE_ALL}><MainLayout><Help /></MainLayout></ProtectedRoute>} />

                  </Routes>

                  {/* Chatbot — only for workspace users, NOT super admin */}
                  <ChatBot />
                </div>
              </BrowserRouter>
            </ServerTimeProvider>
          </AlarmNotificationProvider>
        </ToastProvider>
      </AuthProvider>
    </SuperAdminAuthProvider>
  );
}

export default App;
