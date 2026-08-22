import React, { useState, useEffect } from 'react';
import { Plus, Search, Users as UsersIcon, Shield, UserCheck, UserX, AlertTriangle, Loader2 } from 'lucide-react';
import { userAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import UserList from '../components/users/UserList';
import UserForm from '../components/users/UserForm';
import ResetPasswordModal from '../components/users/ResetPasswordModal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useAuth } from '../context/AuthContext';

// ─── Theme ───
const C = {
  bg:         '#F8FAFC',
  card:       '#FFFFFF',
  cardSubtle: '#F8FAFC',
  cardHover:  '#EEF6FF',
  border:     '#E5E7EB',
  heading:    '#081B43',
  text:       '#334155',
  muted:      '#5F6B7A',
  subtle:     '#94A3B8',
  brand:      '#2563EB',
  brandDark:  '#0F3D91',
  btnPrimary: '#2563EB',
  btnHover:   '#1D4ED8',
  success:    '#16A34A',
  warning:    '#F59E0B',
  danger:     '#DC2626',
  purple:     '#9333EA',
};

const Users = () => {
  const { showToast } = useToast();

  // Get current user from localStorage
  const { userData: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState(null); // { user }
  const [toggleConfirm, setToggleConfirm] = useState(null); // { user }

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await userAPI.getAll();
      setUsers(res.data?.users || []);
    } catch (err) {
      console.error('Failed to load users', err);
      setError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await userAPI.getStats();
      setStats(res.data?.stats);
    } catch (err) {
      console.error('Failed to load stats', err);
    }
  };

  useEffect(() => {
    loadUsers();
    loadStats();
  }, []);

  const handleSubmit = async (data) => {
    try {
      if (editingUser) {
        await userAPI.update(editingUser._id, data);
        showToast(`User "${data.name || data.username}" updated successfully`, 'success');
      } else {
        await userAPI.create(data);
        showToast(`User "${data.name || data.username}" created successfully`, 'success');
      }
      setShowForm(false);
      setEditingUser(null);
      loadUsers();
      loadStats();
    } catch (err) {
      showToast(err.response?.data?.message || 'Operation failed', 'error');
      throw err;
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteConfirm) return;
    try {
      await userAPI.delete(deleteConfirm.user._id);
      showToast(`User "${deleteConfirm.user.name}" deleted`, 'success');
      setDeleteConfirm(null);
      loadUsers();
      loadStats();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete user', 'error');
    }
  };

  const handleResetPassword = async (userId, newPassword) => {
    return await userAPI.resetPassword(userId, newPassword);
  };

  const handleToggleConfirmed = async () => {
    if (!toggleConfirm) return;
    try {
      await userAPI.toggleActive(toggleConfirm.user._id);
      const newStatus = toggleConfirm.user.isActive ? 'deactivated' : 'activated';
      showToast(`User "${toggleConfirm.user.name}" ${newStatus}`, 'success');
      setToggleConfirm(null);
      loadUsers();
      loadStats();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to toggle status', 'error');
    }
  };

  // Filter users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = !filterRole || u.role === filterRole;
    const matchesStatus =
      filterStatus === '' ||
      (filterStatus === 'active' && u.isActive) ||
      (filterStatus === 'inactive' && !u.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const isAdmin = currentUser?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="p-6" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div
          className="rounded-2xl p-8 text-center max-w-lg mx-auto"
          style={{ background: '#FEE2E2', border: `1px solid ${C.danger}` }}
        >
          <Shield className="w-16 h-16 mx-auto mb-3" style={{ color: C.danger }} />
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#991B1B', fontFamily: "'Montserrat', sans-serif" }}>
            Access Denied
          </h2>
          <p className="text-sm" style={{ color: '#B91C1C' }}>
            Only administrators can access user management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div
        className="p-5 rounded-2xl"
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)',
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}
            >
              User Management
            </h1>
            <p className="text-sm mt-0.5" style={{ color: C.muted }}>
              Manage users and access permissions
            </p>
          </div>
          <button
            onClick={() => { setEditingUser(null); setShowForm(true); }}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
            title="Add a new user"
          >
            <Plus className="w-5 h-5 text-white" />
            <span className="text-white">+ Add User</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div
          className="p-4 rounded-2xl transition-all"
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl" style={{ background: '#EEF6FF' }}>
              <UsersIcon className="w-6 h-6" style={{ color: C.brand }} />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>Total Users</div>
              <div className="text-2xl font-bold mt-0.5" style={{ color: C.heading }}>{stats?.total ?? users.length}</div>
            </div>
          </div>
        </div>

        <div
          className="p-4 rounded-2xl transition-all"
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl" style={{ background: '#DCFCE7' }}>
              <UserCheck className="w-6 h-6" style={{ color: C.success }} />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>Active</div>
              <div className="text-2xl font-bold mt-0.5" style={{ color: C.success }}>
                {stats?.active ?? users.filter((u) => u.isActive).length}
              </div>
            </div>
          </div>
        </div>

        <div
          className="p-4 rounded-2xl transition-all"
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl" style={{ background: '#FEE2E2' }}>
              <UserX className="w-6 h-6" style={{ color: C.danger }} />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>Inactive</div>
              <div className="text-2xl font-bold mt-0.5" style={{ color: C.danger }}>
                {stats?.inactive ?? users.filter((u) => !u.isActive).length}
              </div>
            </div>
          </div>
        </div>

        <div
          className="p-4 rounded-2xl transition-all"
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl" style={{ background: '#F5F3FF' }}>
              <Shield className="w-6 h-6" style={{ color: C.purple }} />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>Admins</div>
              <div className="text-2xl font-bold mt-0.5" style={{ color: C.purple }}>
                {stats?.byRole?.admin ?? users.filter((u) => u.role === 'admin').length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        className="p-4 rounded-2xl"
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)',
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
            <input
              type="text"
              placeholder="Search users by name, email, username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg pl-10 pr-3 py-2 text-sm outline-none transition-colors"
              style={{
                background: C.cardSubtle,
                border: `1px solid ${C.border}`,
                color: C.heading,
              }}
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none transition-colors"
            style={{
              background: C.cardSubtle,
              border: `1px solid ${C.border}`,
              color: C.heading,
            }}
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="engineer">Engineer</option>
            <option value="operator">Operator</option>
            <option value="viewer">Viewer</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none transition-colors"
            style={{
              background: C.cardSubtle,
              border: `1px solid ${C.border}`,
              color: C.heading,
            }}
          >
            <option value="">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="p-3 rounded-lg text-sm flex items-center gap-2"
          style={{ background: '#FEE2E2', border: `1px solid ${C.danger}`, color: '#B91C1C' }}
        >
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* User Table / Empty state */}
      {loading ? (
        <div
          className="rounded-2xl p-16 text-center"
          style={{ background: C.card, border: `1px solid ${C.border}` }}
        >
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: C.brand }} />
          <div style={{ color: C.muted }}>Loading users...</div>
        </div>
      ) : filteredUsers.length === 0 && !searchQuery && !filterRole && !filterStatus ? (
        <div
          className="rounded-2xl p-16 text-center"
          style={{ background: C.card, border: `1px solid ${C.border}` }}
        >
          <UsersIcon className="w-12 h-12 mx-auto mb-3" style={{ color: C.subtle }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>
            No Users Yet
          </h3>
          <p className="text-sm mb-4" style={{ color: C.muted }}>Create the first user to get started</p>
          <button
            onClick={() => { setEditingUser(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium rounded-lg shadow-sm"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>+ Add User</span>
          </button>
        </div>
      ) : (
        <UserList
          users={filteredUsers}
          currentUser={currentUser}
          onEdit={(user) => { setEditingUser(user); setShowForm(true); }}
          onDelete={(user) => setDeleteConfirm({ user })}
          onResetPassword={(user) => setResetPasswordUser(user)}
          onToggleActive={(user) => setToggleConfirm({ user })}
        />
      )}

      {/* Form Modal */}
      {showForm && (
        <UserForm
          user={editingUser}
          onSubmit={handleSubmit}
          onClose={() => { setShowForm(false); setEditingUser(null); }}
        />
      )}

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <ResetPasswordModal
          user={resetPasswordUser}
          onSubmit={handleResetPassword}
          onClose={() => setResetPasswordUser(null)}
        />
      )}

      {/* Delete user ConfirmDialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirmed}
        title="Delete User?"
        message={`Are you sure you want to delete "${deleteConfirm?.user?.name}"? This action cannot be undone.`}
        confirmText="Delete User"
        confirmColor="red"
        icon="warning"
      />

      {/* Toggle active ConfirmDialog */}
      <ConfirmDialog
        isOpen={!!toggleConfirm}
        onClose={() => setToggleConfirm(null)}
        onConfirm={handleToggleConfirmed}
        title={toggleConfirm?.user?.isActive ? 'Deactivate User?' : 'Activate User?'}
        message={
          toggleConfirm?.user?.isActive
            ? `Deactivate "${toggleConfirm?.user?.name}"? They will not be able to log in.`
            : `Activate "${toggleConfirm?.user?.name}"? They will be able to log in again.`
        }
        confirmText={toggleConfirm?.user?.isActive ? 'Deactivate' : 'Activate'}
        confirmColor={toggleConfirm?.user?.isActive ? 'red' : 'green'}
        icon={toggleConfirm?.user?.isActive ? 'warning' : 'question'}
      />
    </div>
  );
};

export default Users;