import React, { useState } from 'react';
import { Key, Eye, EyeOff, AlertTriangle, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';

const ResetPasswordModal = ({ user, onSubmit, onClose }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setSaving(true);
      await onSubmit(user._id, newPassword);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
    setConfirmPassword(pwd);
    setShowPassword(true);
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Reset Password"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4" style={{ fontFamily: "'Inter', sans-serif" }}>
        {/* User Info */}
        <div className="bg-[#F8FAFC] rounded-lg p-3.5 border border-slate-200">
          <div className="text-slate-500 text-xs font-medium">Resetting password for:</div>
          <div className="text-slate-900 font-semibold text-sm mt-0.5">{user.name}</div>
          <div className="text-slate-500 text-xs font-mono">{user.email}</div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Generate Button */}
        <button
          type="button"
          onClick={generateRandomPassword}
          className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-[#2563EB] border border-blue-200 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
        >
          🎲 Generate Random Password
        </button>

        {/* New Password */}
        <div>
          <label className="text-xs font-semibold uppercase text-slate-600 mb-1.5 block">New Password *</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-[#F8FAFC] text-slate-900 rounded-lg px-3 py-2 pr-10 text-sm border border-slate-200 focus:border-[#2563EB] focus:bg-white outline-none transition-colors"
              placeholder="Min 6 characters"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label className="text-xs font-semibold uppercase text-slate-600 mb-1.5 block">Confirm Password *</label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-[#F8FAFC] text-slate-900 rounded-lg px-3 py-2 text-sm border border-slate-200 focus:border-[#2563EB] focus:bg-white outline-none transition-colors"
            placeholder="Re-enter password"
            required
          />
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
            className="px-5 py-2 bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 text-white font-medium text-sm rounded-lg shadow-sm flex items-center gap-2 transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{saving ? 'Resetting...' : 'Reset Password'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ResetPasswordModal;