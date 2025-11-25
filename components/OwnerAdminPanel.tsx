import React, { useState, useEffect } from 'react';
import { User, PendingUser, UserRole } from '../types';
import { SignupService } from '../services/signupService';
import { UserService } from '../services/userService';
import { AuthService } from '../services/authService';
import { OwnerAuthService } from '../services/ownerAuthService';
import { Logger } from '../services/loggerService';
import { CheckCircle, XCircle, Users, Shield, Code, RefreshCw, Eye, EyeOff } from 'lucide-react';

interface OwnerAdminPanelProps {
  user: User;
  onSourceCodeAccess?: () => void;
}

const OwnerAdminPanel: React.FC<OwnerAdminPanelProps> = ({ user, onSourceCodeAccess }) => {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'users' | 'source'>('pending');
  
  // Approval state
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvalPassword, setApprovalPassword] = useState('');
  const [approvalRole, setApprovalRole] = useState<UserRole>(UserRole.SALES);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedPendingUser, setSelectedPendingUser] = useState<PendingUser | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pending, users] = await Promise.all([
        SignupService.getPendingUsers(),
        UserService.getAllUsers(),
      ]);
      setPendingUsers(pending);
      setAllUsers(users);
    } catch (error) {
      Logger.error('[OwnerAdminPanel] Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (pendingUser: PendingUser) => {
    setSelectedPendingUser(pendingUser);
    setApprovalRole(pendingUser.requestedRole);
    setShowApprovalModal(true);
  };

  const confirmApprove = async () => {
    if (!selectedPendingUser || !approvalPassword) {
      alert('Please enter a password for the new user');
      return;
    }

    try {
      setApprovingId(selectedPendingUser.id);
      await SignupService.approveUser(
        selectedPendingUser.id,
        user.id,
        approvalPassword,
        approvalRole
      );
      
      setShowApprovalModal(false);
      setApprovalPassword('');
      setSelectedPendingUser(null);
      await loadData();
      alert('User approved successfully');
    } catch (error: any) {
      alert(`Failed to approve user: ${error.message}`);
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (pendingUser: PendingUser) => {
    if (!confirm(`Reject signup request from ${pendingUser.name} (${pendingUser.email})?`)) {
      return;
    }

    try {
      await SignupService.rejectUser(pendingUser.id, user.id, 'Rejected by owner');
      await loadData();
      alert('User rejected');
    } catch (error: any) {
      alert(`Failed to reject user: ${error.message}`);
    }
  };

  // Verify owner access
  if (!OwnerAuthService.isOwner(user)) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">Access denied. Owner access required.</p>
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
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-6 h-6" /> Owner Admin Panel
          </h2>
          <p className="text-sm text-slate-500 mt-1">Manage user signups and access</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 border-b-2 font-medium text-sm ${
              activeTab === 'pending'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Pending Requests ({pendingUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 border-b-2 font-medium text-sm ${
              activeTab === 'users'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            All Users ({allUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('source')}
            className={`px-4 py-2 border-b-2 font-medium text-sm ${
              activeTab === 'source'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Code className="w-4 h-4 inline mr-1" /> Source Code Access
          </button>
        </nav>
      </div>

      {/* Pending Requests Tab */}
      {activeTab === 'pending' && (
        <div>
          {pendingUsers.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-lg">
              <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">No pending signup requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingUsers.map((pending) => (
                <div
                  key={pending.id}
                  className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900">{pending.name}</h3>
                      <p className="text-sm text-slate-600">{pending.email}</p>
                      {pending.mobile && (
                        <p className="text-sm text-slate-500">{pending.mobile}</p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded">
                          {pending.requestedRole}
                        </span>
                        <span className="text-xs text-slate-500">
                          Requested {new Date(pending.requestedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(pending)}
                        disabled={approvingId === pending.id}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" /> Approve
                      </button>
                      <button
                        onClick={() => handleReject(pending)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Users Tab */}
      {activeTab === 'users' && (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left p-3 text-sm font-semibold text-slate-700">Name</th>
                  <th className="text-left p-3 text-sm font-semibold text-slate-700">Email</th>
                  <th className="text-left p-3 text-sm font-semibold text-slate-700">Role</th>
                  <th className="text-left p-3 text-sm font-semibold text-slate-700">Status</th>
                  <th className="text-left p-3 text-sm font-semibold text-slate-700">Created</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u) => (
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
                            : u.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-slate-500">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Source Code Access Tab */}
      {activeTab === 'source' && (
        <div className="p-6 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-start gap-4">
            <Code className="w-8 h-8 text-indigo-600 mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 mb-2">Source Code Access</h3>
              <p className="text-sm text-slate-600 mb-4">
                Access to source code, configuration files, and logs requires owner re-authentication
                for security purposes.
              </p>
              <button
                onClick={() => {
                  if (onSourceCodeAccess) {
                    onSourceCodeAccess();
                  } else {
                    alert('Source code access feature not yet implemented');
                  }
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Request Source Code Access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedPendingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Approve User</h3>
            <p className="text-sm text-slate-600 mb-4">
              Approving: <strong>{selectedPendingUser.name}</strong> ({selectedPendingUser.email})
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Assign Role
                </label>
                <select
                  value={approvalRole}
                  onChange={(e) => setApprovalRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value={UserRole.ADMIN}>Admin</option>
                  <option value={UserRole.SALES}>Sales</option>
                  <option value={UserRole.VIEWER}>Viewer</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Set Password
                </label>
                <input
                  type="password"
                  value={approvalPassword}
                  onChange={(e) => setApprovalPassword(e.target.value)}
                  placeholder="Enter password for new user"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  This password will be sent to the user
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={confirmApprove}
                disabled={!approvalPassword || approvingId === selectedPendingUser.id}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {approvingId === selectedPendingUser.id ? 'Approving...' : 'Approve'}
              </button>
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setApprovalPassword('');
                  setSelectedPendingUser(null);
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

export default OwnerAdminPanel;

