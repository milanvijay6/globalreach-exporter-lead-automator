import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { UserService } from '../services/userService';
import { UserManagementService } from '../services/userManagementService';
import { AuthService } from '../services/authService';
import { Logger } from '../services/loggerService';
import { Plus, Edit, Trash2, RefreshCw, Lock, Unlock, Key } from 'lucide-react';

interface UserManagementPanelProps {
  user: User; // Current logged-in user (must be admin or owner)
}

const UserManagementPanel: React.FC<UserManagementPanelProps> = ({ user }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Create user form state
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>(UserRole.SALES);
  const [newUserMobile, setNewUserMobile] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const allUsers = await UserService.getAllUsers();
      setUsers(allUsers);
    } catch (error) {
      Logger.error('[UserManagementPanel] Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserName || !newUserEmail || !newUserPassword) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      await UserManagementService.createUser(user.id, {
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        role: newUserRole,
        mobile: newUserMobile || undefined,
      });

      // Reset form
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole(UserRole.SALES);
      setNewUserMobile('');
      setShowCreateModal(false);

      await loadUsers();
      alert('User created successfully');
    } catch (error: any) {
      alert(`Failed to create user: ${error.message}`);
    }
  };

  const handleSuspend = async (targetUser: User) => {
    if (!confirm(`Suspend user ${targetUser.name}?`)) return;

    try {
      await UserManagementService.updateUserStatus(targetUser.id, 'suspended', user.id);
      await loadUsers();
    } catch (error: any) {
      alert(`Failed to suspend user: ${error.message}`);
    }
  };

  const handleActivate = async (targetUser: User) => {
    try {
      await UserManagementService.updateUserStatus(targetUser.id, 'active', user.id);
      await loadUsers();
    } catch (error: any) {
      alert(`Failed to activate user: ${error.message}`);
    }
  };

  const handleResetPassword = async (targetUser: User) => {
    const newPassword = prompt(`Enter new password for ${targetUser.name}:`);
    if (!newPassword) return;

    try {
      await UserManagementService.resetUserPassword(targetUser.id, newPassword, user.id);
      alert('Password reset successfully');
    } catch (error: any) {
      alert(`Failed to reset password: ${error.message}`);
    }
  };

  const handleResetPin = async (targetUser: User) => {
    const resetterPassword = prompt('Enter your password to confirm PIN reset:');
    if (!resetterPassword) return;

    try {
      await UserManagementService.resetUserPin(targetUser.id, user.id, resetterPassword);
      alert('PIN reset successfully');
    } catch (error: any) {
      alert(`Failed to reset PIN: ${error.message}`);
    }
  };

  // Check permissions
  if (user.role !== 'Admin' && user.role !== 'Owner') {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">Access denied. Admin or Owner access required.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
          <p className="text-sm text-slate-500 mt-1">Create and manage users</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadUsers}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" /> Create User
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left p-3 text-sm font-semibold text-slate-700">Name</th>
              <th className="text-left p-3 text-sm font-semibold text-slate-700">Email</th>
              <th className="text-left p-3 text-sm font-semibold text-slate-700">Role</th>
              <th className="text-left p-3 text-sm font-semibold text-slate-700">Status</th>
              <th className="text-left p-3 text-sm font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-3 text-sm">{u.name}</td>
                <td className="p-3 text-sm text-slate-600">{u.email}</td>
                <td className="p-3 text-sm">
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs">
                    {u.role}
                  </span>
                </td>
                <td className="p-3 text-sm">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      u.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : u.status === 'suspended'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {u.status}
                  </span>
                </td>
                <td className="p-3 text-sm">
                  <div className="flex gap-2">
                    {u.status === 'active' ? (
                      <button
                        onClick={() => handleSuspend(u)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Suspend"
                      >
                        <Lock className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleActivate(u)}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                        title="Activate"
                      >
                        <Unlock className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleResetPassword(u)}
                      className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                      title="Reset Password"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleResetPin(u)}
                      className="p-1 text-slate-600 hover:bg-slate-50 rounded"
                      title="Reset PIN"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Create New User</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value={UserRole.ADMIN}>Admin</option>
                  <option value={UserRole.SALES}>Sales</option>
                  <option value={UserRole.VIEWER}>Viewer</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Mobile (Optional)
                </label>
                <input
                  type="tel"
                  value={newUserMobile}
                  onChange={(e) => setNewUserMobile(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleCreateUser}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Create User
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewUserName('');
                  setNewUserEmail('');
                  setNewUserPassword('');
                  setNewUserRole(UserRole.SALES);
                  setNewUserMobile('');
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPanel;

