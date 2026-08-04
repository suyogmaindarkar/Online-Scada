import React, { useState } from 'react';
import { X, Key, Eye, EyeOff } from 'lucide-react';

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
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-md border border-slate-700">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Key className="w-6 h-6 text-yellow-500" />
            Reset Password
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* User Info */}
          <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
            <div className="text-slate-400 text-xs">Resetting password for:</div>
            <div className="text-white font-medium">{user.name}</div>
            <div className="text-slate-500 text-sm">{user.email}</div>
          </div>

          {error && (
            <div className="bg-red-900 border border-red-600 text-red-200 rounded-lg p-3 text-sm">
              ❌ {error}
            </div>
          )}

          {/* Generate Button */}
          <button
            type="button"
            onClick={generateRandomPassword}
            className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm"
          >
            🎲 Generate Random Password
          </button>

          {/* New Password */}
          <div>
            <label className="text-slate-300 text-sm mb-1 block">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-700 text-white rounded px-3 py-2 pr-10 border border-slate-600 focus:border-blue-500 outline-none"
                placeholder="Min 6 characters"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-slate-300 text-sm mb-1 block">Confirm Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:border-blue-500 outline-none"
              placeholder="Re-enter password"
              required
            />
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
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-slate-700 text-white rounded"
            >
              {saving ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordModal;