import React, { useState, useEffect } from 'react';
import { Plus, Search, Users as UsersIcon, Shield, UserCheck, UserX } from 'lucide-react';
import { userAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import UserList from '../components/users/UserList';
import UserForm from '../components/users/UserForm';
import ResetPasswordModal from '../components/users/ResetPasswordModal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
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

  // ✅ T013: Replace window.confirm with ConfirmDialog state
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
        // ✅ T012: Toast instead of nothing
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
      // ✅ T012: Toast instead of nothing (errors were swallowed before)
      showToast(err.response?.data?.message || 'Operation failed', 'error');
      throw err; // Re-throw so UserForm can handle it too
    }
  };

  // ✅ T013: Triggered by ConfirmDialog — no window.confirm
  const handleDeleteConfirmed = async () => {
    if (!deleteConfirm) return;
    try {
      await userAPI.delete(deleteConfirm.user._id);
      // ✅ T012: Toast on success
      showToast(`User "${deleteConfirm.user.name}" deleted`, 'success');
      setDeleteConfirm(null);
      loadUsers();
      loadStats();
    } catch (err) {
      // ✅ T012: Toast instead of alert()
      showToast(err.response?.data?.message || 'Failed to delete user', 'error');
    }
  };

  const handleResetPassword = async (userId, newPassword) => {
    return await userAPI.resetPassword(userId, newPassword);
  };

  // ✅ T013: Triggered by ConfirmDialog — no window.confirm
  const handleToggleConfirmed = async () => {
    if (!toggleConfirm) return;
    try {
      await userAPI.toggleActive(toggleConfirm.user._id);
      const newStatus = toggleConfirm.user.isActive ? 'deactivated' : 'activated';
      // ✅ T012: Toast on success
      showToast(`User "${toggleConfirm.user.name}" ${newStatus}`, 'success');
      setToggleConfirm(null);
      loadUsers();
      loadStats();
    } catch (err) {
      // ✅ T012: Toast instead of alert()
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
      <div className="p-6">
        <div className="bg-red-900 border border-red-600 rounded-lg p-6 text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-red-200">Only administrators can access user management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <UsersIcon className="w-8 h-8 text-blue-500" />
            User Management
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage users and access permissions</p>
        </div>
        <button
          onClick={() => { setEditingUser(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          title="Add a new user"
        >
          <Plus className="w-5 h-5" />
          Add User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-900 rounded-lg">
              <UsersIcon className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="text-slate-400 text-sm">Total Users</div>
              <div className="text-2xl font-bold text-white">{stats?.total || 0}</div>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-900 rounded-lg">
              <UserCheck className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="text-slate-400 text-sm">Active</div>
              <div className="text-2xl font-bold text-green-400">{stats?.active || 0}</div>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-900 rounded-lg">
              <UserX className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <div className="text-slate-400 text-sm">Inactive</div>
              <div className="text-2xl font-bold text-red-400">{stats?.inactive || 0}</div>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-900 rounded-lg">
              <Shield className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="text-slate-400 text-sm">Admins</div>
              <div className="text-2xl font-bold text-purple-400">{stats?.byRole?.admin || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 mb-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-700 text-white rounded pl-10 pr-3 py-2 border border-slate-600 focus:border-blue-500 outline-none"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 outline-none"
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
            className="bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 outline-none"
          >
            <option value="">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900 border border-red-600 text-red-200 rounded-lg p-3 mb-4">
          ❌ {error}
        </div>
      )}

      {/* ✅ T014: Empty state when no users */}
      {loading ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
          <div className="text-slate-400">Loading users...</div>
        </div>
      ) : filteredUsers.length === 0 && !searchQuery && !filterRole && !filterStatus ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
          <UsersIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-2">No Users Yet</h3>
          <p className="text-slate-400 mb-4">Create the first user to get started</p>
          <button
            onClick={() => { setEditingUser(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>
      ) : (
        <UserList
          users={filteredUsers}
          currentUser={currentUser}
          onEdit={(user) => { setEditingUser(user); setShowForm(true); }}
          // ✅ T013: Pass ConfirmDialog trigger instead of internal window.confirm
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

      {/* ✅ T013: Delete user ConfirmDialog */}
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

      {/* ✅ T013: Toggle active ConfirmDialog */}
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