import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AlarmNotificationProvider } from './context/AlarmNotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PLCManagement from './pages/PLCManagement';
import TagManagement from './pages/TagManagement';
import GraphicDesigner from './pages/GraphicDesigner';
import Runtime from './pages/Runtime';
import Alarms from './pages/Alarms';
import Trends from './pages/Trends';
import Recipes from './pages/Recipes';
import Reports from './pages/Reports';   // ✅ NEW
import Users from './pages/Users';
import Settings from './pages/Settings';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AlarmNotificationProvider>
          <BrowserRouter>
            <div
              className="font-sans h-screen"
              style={{ backgroundColor: '#F8FAFC', color: '#081B43' }}
            >
              <Routes>
                <Route path="/login" element={<Login />} />

                <Route path="/dashboard" element={<ProtectedRoute><MainLayout><Dashboard /></MainLayout></ProtectedRoute>} />
                <Route path="/plc"       element={<ProtectedRoute><MainLayout><PLCManagement /></MainLayout></ProtectedRoute>} />
                <Route path="/tags"      element={<ProtectedRoute><MainLayout><TagManagement /></MainLayout></ProtectedRoute>} />
                <Route path="/designer"  element={<ProtectedRoute><MainLayout><GraphicDesigner /></MainLayout></ProtectedRoute>} />
                <Route path="/runtime"   element={<ProtectedRoute><MainLayout><Runtime /></MainLayout></ProtectedRoute>} />
                <Route path="/alarms"    element={<ProtectedRoute><MainLayout><Alarms /></MainLayout></ProtectedRoute>} />
                <Route path="/trends"    element={<ProtectedRoute><MainLayout><Trends /></MainLayout></ProtectedRoute>} />
                <Route path="/recipes"   element={<ProtectedRoute><MainLayout><Recipes /></MainLayout></ProtectedRoute>} />
                <Route path="/reports"   element={<ProtectedRoute><MainLayout><Reports /></MainLayout></ProtectedRoute>} />  {/* ✅ NEW */}
                <Route path="/users"     element={<ProtectedRoute><MainLayout><Users /></MainLayout></ProtectedRoute>} />
                <Route path="/settings"  element={<ProtectedRoute><MainLayout><Settings /></MainLayout></ProtectedRoute>} />

                <Route path="/"  element={<Navigate to="/dashboard" replace />} />
                <Route path="*"  element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </div>
          </BrowserRouter>
        </AlarmNotificationProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;