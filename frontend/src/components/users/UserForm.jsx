import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, Shield, AlertTriangle, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';

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
    <Modal
      isOpen={true}
      onClose={onClose}
      title={user ? `Edit User: ${user.name}` : 'Add New User'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4" style={{ fontFamily: "'Inter', sans-serif" }}>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Name */}
        <div>
          <label className="text-xs font-semibold uppercase text-slate-600 mb-1.5 block">Full Name *</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-[#F8FAFC] text-slate-900 rounded-lg pl-10 pr-3 py-2 text-sm border border-slate-200 focus:border-[#2563EB] focus:bg-white outline-none transition-colors"
              placeholder="e.g. John Doe"
              required
            />
          </div>
        </div>

        {/* Username */}
        <div>
          <label className="text-xs font-semibold uppercase text-slate-600 mb-1.5 block">Username</label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            className="w-full bg-[#F8FAFC] text-slate-900 rounded-lg px-3 py-2 text-sm border border-slate-200 focus:border-[#2563EB] focus:bg-white outline-none transition-colors"
            placeholder="johndoe (auto from email if empty)"
          />
        </div>

        {/* Email */}
        <div>
          <label className="text-xs font-semibold uppercase text-slate-600 mb-1.5 block">Email *</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-[#F8FAFC] text-slate-900 rounded-lg pl-10 pr-3 py-2 text-sm border border-slate-200 focus:border-[#2563EB] focus:bg-white outline-none transition-colors"
              placeholder="john@example.com"
              required
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="text-xs font-semibold uppercase text-slate-600 mb-1.5 block">
            {user ? 'Password (leave blank to keep current)' : 'Password *'}
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-[#F8FAFC] text-slate-900 rounded-lg pl-10 pr-3 py-2 text-sm border border-slate-200 focus:border-[#2563EB] focus:bg-white outline-none transition-colors"
              placeholder={user ? '••••••••' : 'Min 6 characters'}
              minLength={user ? 0 : 6}
            />
          </div>
        </div>

        {/* Role */}
        <div>
          <label className="text-xs font-semibold uppercase text-slate-600 mb-1.5 block flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-slate-500" /> Role *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setFormData({ ...formData, role: r.value })}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  formData.role === r.value
                    ? 'bg-blue-50 border-[#2563EB] text-[#1E40AF] shadow-xs'
                    : 'bg-[#F8FAFC] border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="text-xs font-bold">{r.label}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{r.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Active Status */}
        <div className="flex items-center justify-between bg-[#F8FAFC] p-3 rounded-lg border border-slate-200">
          <div>
            <div className="text-slate-800 text-xs font-bold">Account Status</div>
            <div className="text-slate-500 text-[11px]">
              {formData.isActive ? 'User can log in to the system' : 'User is deactivated'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.isActive ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              formData.isActive ? 'translate-x-6' : 'translate-x-1'
            }`}/>
          </button>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-lg transition-colors border border-slate-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-medium text-sm rounded-lg shadow-sm flex items-center gap-2 transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{saving ? 'Saving...' : user ? 'Update User' : 'Create User'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default UserForm;