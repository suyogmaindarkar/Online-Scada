import React, { useState, useEffect } from 'react';
import { X, User, Mail, Lock, Shield } from 'lucide-react';

const ROLES = [
  { value: 'admin',    label: '👑 Admin',    desc: 'Full system access' },
  { value: 'engineer', label: '🔧 Engineer', desc: 'Configure & operate' },
  { value: 'operator', label: '👷 Operator', desc: 'Operate system' },
  { value: 'viewer',   label: '👁️ Viewer',   desc: 'View only access' },
];

const UserForm = ({ user, onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'viewer',
    isActive: true,
  });

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        username: user.username || '',
        email: user.email || '',
        password: '',
        role: user.role || 'viewer',
        isActive: user.isActive !== undefined ? user.isActive : true,
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.email) {
      setError('Name and email are required');
      return;
    }

    if (!user && !formData.password) {
      setError('Password is required for new user');
      return;
    }

    if (!user && formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    const dataToSend = { ...formData };
    // Don't send empty password when editing
    if (user && !formData.password) {
      delete dataToSend.password;
    }

    try {
      setSaving(true);
      await onSubmit(dataToSend);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-md border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-6 h-6 text-blue-500" />
            {user ? 'Edit User' : 'Add New User'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-900 border border-red-600 text-red-200 rounded-lg p-3 text-sm">
              ❌ {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="text-slate-300 text-sm mb-1 block">Full Name *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-700 text-white rounded pl-10 pr-3 py-2 border border-slate-600 focus:border-blue-500 outline-none"
                placeholder="John Doe"
                required
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="text-slate-300 text-sm mb-1 block">Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:border-blue-500 outline-none"
              placeholder="johndoe (auto from email if empty)"
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-slate-300 text-sm mb-1 block">Email *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-700 text-white rounded pl-10 pr-3 py-2 border border-slate-600 focus:border-blue-500 outline-none"
                placeholder="john@example.com"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-slate-300 text-sm mb-1 block">
              {user ? 'Password (leave blank to keep current)' : 'Password *'}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full bg-slate-700 text-white rounded pl-10 pr-3 py-2 border border-slate-600 focus:border-blue-500 outline-none"
                placeholder={user ? '••••••••' : 'Min 6 characters'}
                minLength={user ? 0 : 6}
              />
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="text-slate-300 text-sm mb-2 block flex items-center gap-1">
              <Shield className="w-4 h-4" /> Role *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, role: r.value })}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    formData.role === r.value
                      ? 'bg-blue-900 border-blue-500 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <div className="text-sm font-semibold">{r.label}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-700">
            <div>
              <div className="text-white text-sm font-medium">Account Status</div>
              <div className="text-slate-400 text-xs">
                {formData.isActive ? 'User can login' : 'User cannot login'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.isActive ? 'bg-green-600' : 'bg-slate-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formData.isActive ? 'translate-x-6' : 'translate-x-1'
              }`}/>
            </button>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded"
            >
              {saving ? 'Saving...' : user ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserForm;