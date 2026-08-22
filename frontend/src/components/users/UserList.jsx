import React from 'react';
import { Edit2, Trash2, Key, Power, User as UserIcon } from 'lucide-react';

// ─── Theme ───
const C = {
  card:       '#FFFFFF',
  cardSubtle: '#F8FAFC',
  cardHover:  '#EEF6FF',
  border:     '#E5E7EB',
  heading:    '#081B43',
  text:       '#334155',
  muted:      '#5F6B7A',
  subtle:     '#94A3B8',
  brand:      '#2563EB',
  success:    '#16A34A',
  warning:    '#F59E0B',
  danger:     '#DC2626',
  purple:     '#9333EA',
};

const ROLE_STYLES = {
  admin:    { bg: '#FEE2E2', text: '#B91C1C', border: '#FECACA' },
  engineer: { bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' },
  operator: { bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' },
  viewer:   { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
};

const ROLE_ICONS = {
  admin: '👑',
  engineer: '🔧',
  operator: '👷',
  viewer: '👁️',
};

const UserList = ({ users, currentUser, onEdit, onDelete, onResetPassword, onToggleActive }) => {
  if (!users || users.length === 0) {
    return (
      <div
        className="p-12 text-center rounded-2xl"
        style={{ background: C.card, border: `1px solid ${C.border}` }}
      >
        <UserIcon className="w-12 h-12 mx-auto mb-3" style={{ color: C.subtle }} />
        <h3 className="text-lg font-semibold mb-2" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>
          No Users Found
        </h3>
        <p style={{ color: C.muted }}>Add users to get started</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)',
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead style={{ background: C.cardSubtle, borderBottom: `1px solid ${C.border}` }}>
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>User</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Created</th>
              <th className="text-center px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, idx) => {
              const isCurrentUser = currentUser?._id === user._id || currentUser?.id === user._id;
              const roleStyle = ROLE_STYLES[user.role] || ROLE_STYLES.viewer;

              return (
                <tr 
                  key={user._id} 
                  style={{
                    borderBottom: idx < users.length - 1 ? `1px solid ${C.border}` : 'none',
                    background: isCurrentUser ? '#F8FAFC' : C.card,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.cardSubtle; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = isCurrentUser ? '#F8FAFC' : C.card; }}
                >
                  {/* User Info */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm flex-shrink-0">
                        {user.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-2" style={{ color: C.heading }}>
                          {user.name}
                          {isCurrentUser && (
                            <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-xs" style={{ color: C.muted }}>
                          @{user.username || user.email.split('@')[0]}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono" style={{ color: C.text }}>{user.email}</span>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3">
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5"
                      style={{
                        background: roleStyle.bg,
                        color: roleStyle.text,
                        border: `1px solid ${roleStyle.border}`,
                      }}
                    >
                      <span>{ROLE_ICONS[user.role]}</span>
                      <span>{user.role?.toUpperCase()}</span>
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        background: user.isActive ? '#DCFCE7' : '#F1F5F9',
                        color: user.isActive ? '#15803D' : '#64748B',
                      }}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}
                      />
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  {/* Created */}
                  <td className="px-4 py-3">
                    <span className="text-sm" style={{ color: C.muted }}>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <IconButton
                        onClick={() => onEdit(user)}
                        title="Edit User"
                        bg={C.brand}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </IconButton>

                      <IconButton
                        onClick={() => onResetPassword(user)}
                        title="Reset Password"
                        bg={C.warning}
                      >
                        <Key className="w-3.5 h-3.5" />
                      </IconButton>

                      <IconButton
                        onClick={() => onToggleActive(user)}
                        disabled={isCurrentUser}
                        bg={user.isActive ? '#EA580C' : C.success}
                        title={isCurrentUser ? 'Cannot deactivate yourself' : user.isActive ? 'Deactivate User' : 'Activate User'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </IconButton>

                      <IconButton
                        onClick={() => onDelete(user)}
                        disabled={isCurrentUser}
                        bg={C.danger}
                        title={isCurrentUser ? 'Cannot delete yourself' : 'Delete User'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const IconButton = ({ children, onClick, disabled, title, bg }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className="p-1.5 rounded transition-all text-white"
    style={{
      background: disabled ? '#CBD5E1' : bg,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
    }}
    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(1.1)'; }}
    onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(1)'; }}
  >
    {children}
  </button>
);

export default UserList;