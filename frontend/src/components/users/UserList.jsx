import React from 'react';
import { Edit, Trash2, Key, Power, Shield, User as UserIcon } from 'lucide-react';

const ROLE_COLORS = {
  admin:    'bg-red-900 text-red-300 border-red-600',
  engineer: 'bg-blue-900 text-blue-300 border-blue-600',
  operator: 'bg-green-900 text-green-300 border-green-600',
  viewer:   'bg-slate-700 text-slate-300 border-slate-600',
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
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
        <UserIcon className="w-16 h-16 text-slate-600 mx-auto mb-3" />
        <h3 className="text-white text-xl font-semibold mb-2">No Users Found</h3>
        <p className="text-slate-400">Add users to get started</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-900 border-b border-slate-700">
          <tr>
            <th className="text-left text-slate-400 text-xs uppercase font-semibold p-4">User</th>
            <th className="text-left text-slate-400 text-xs uppercase font-semibold p-4">Email</th>
            <th className="text-left text-slate-400 text-xs uppercase font-semibold p-4">Role</th>
            <th className="text-left text-slate-400 text-xs uppercase font-semibold p-4">Status</th>
            <th className="text-left text-slate-400 text-xs uppercase font-semibold p-4">Created</th>
            <th className="text-center text-slate-400 text-xs uppercase font-semibold p-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isCurrentUser = currentUser?._id === user._id || currentUser?.id === user._id;

            return (
              <tr 
                key={user._id} 
                className={`border-b border-slate-700 hover:bg-slate-750 transition-colors ${
                  isCurrentUser ? 'bg-slate-750' : ''
                }`}
              >
                {/* User Info */}
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {user.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <div className="text-white font-medium flex items-center gap-2">
                        {user.name}
                        {isCurrentUser && (
                          <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500 text-xs">@{user.username || user.email.split('@')[0]}</div>
                    </div>
                  </div>
                </td>

                {/* Email */}
                <td className="p-4">
                  <span className="text-slate-300 text-sm">{user.email}</span>
                </td>

                {/* Role */}
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${ROLE_COLORS[user.role] || ROLE_COLORS.viewer}`}>
                    {ROLE_ICONS[user.role]} {user.role?.toUpperCase()}
                  </span>
                </td>

                {/* Status */}
                <td className="p-4">
                  <span className={`flex items-center gap-2 text-sm ${
                    user.isActive ? 'text-green-400' : 'text-red-400'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      user.isActive ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                    }`}></span>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>

                {/* Created */}
                <td className="p-4">
                  <span className="text-slate-400 text-sm">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </td>

                {/* Actions */}
                <td className="p-4">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onEdit(user)}
                      className="p-2 bg-blue-700 hover:bg-blue-600 rounded text-white"
                      title="Edit User"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onResetPassword(user)}
                      className="p-2 bg-yellow-700 hover:bg-yellow-600 rounded text-white"
                      title="Reset Password"
                    >
                      <Key className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onToggleActive(user)}
                      disabled={isCurrentUser}
                      className={`p-2 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                        user.isActive
                          ? 'bg-orange-700 hover:bg-orange-600'
                          : 'bg-green-700 hover:bg-green-600'
                      }`}
                      title={user.isActive ? 'Deactivate' : 'Activate'}
                    >
                      <Power className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onDelete(user)}
                      disabled={isCurrentUser}
                      className="p-2 bg-red-700 hover:bg-red-600 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete User"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default UserList;