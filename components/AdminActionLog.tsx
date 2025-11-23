import React, { useState, useEffect } from 'react';
import { Download, Filter, Search, Calendar, User as UserIcon } from 'lucide-react';
import { AdminAction, User } from '../types';
import { getAuditLogs, exportAuditLogs, getAuditStatistics } from '../services/auditService';
import { canViewAuditLogs } from '../services/permissionService';

interface AdminActionLogProps {
  user: User;
}

const AdminActionLog: React.FC<AdminActionLogProps> = ({ user }) => {
  const [logs, setLogs] = useState<AdminAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    userId: '',
    action: '',
    startDate: '',
    endDate: '',
    resource: '',
  });
  const [stats, setStats] = useState<{
    totalActions: number;
    actionsByType: Record<string, number>;
    actionsByUser: Record<string, number>;
    recentActions: AdminAction[];
  } | null>(null);

  useEffect(() => {
    if (canViewAuditLogs(user)) {
      loadLogs();
      loadStatistics();
    }
  }, [user, filters]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const filterParams: any = {};
      
      if (filters.userId) filterParams.userId = filters.userId;
      if (filters.action) filterParams.action = filters.action;
      if (filters.resource) filterParams.resource = filters.resource;
      if (filters.startDate) filterParams.startDate = new Date(filters.startDate).getTime();
      if (filters.endDate) filterParams.endDate = new Date(filters.endDate).getTime() + 24 * 60 * 60 * 1000 - 1;

      const auditLogs = await getAuditLogs(filterParams);
      setLogs(auditLogs);
    } catch (error) {
      console.error('[AdminActionLog] Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const statistics = await getAuditStatistics('7d');
      setStats(statistics);
    } catch (error) {
      console.error('[AdminActionLog] Failed to load statistics:', error);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const filterParams: any = {};
      if (filters.userId) filterParams.userId = filters.userId;
      if (filters.action) filterParams.action = filters.action;
      if (filters.startDate) filterParams.startDate = new Date(filters.startDate).getTime();
      if (filters.endDate) filterParams.endDate = new Date(filters.endDate).getTime() + 24 * 60 * 60 * 1000 - 1;

      const exported = await exportAuditLogs(format, filterParams);
      
      const blob = new Blob([exported], { 
        type: format === 'json' ? 'application/json' : 'text/csv' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[AdminActionLog] Failed to export:', error);
      alert('Failed to export audit logs');
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('delete') || action.includes('revoke')) return 'text-red-600 bg-red-50';
    if (action.includes('create') || action.includes('enable')) return 'text-green-600 bg-green-50';
    if (action.includes('update') || action.includes('modify')) return 'text-blue-600 bg-blue-50';
    return 'text-slate-600 bg-slate-50';
  };

  if (!canViewAuditLogs(user)) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>You don't have permission to view audit logs.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading audit logs...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <p className="text-sm text-slate-500 mb-1">Total Actions (7d)</p>
            <p className="text-2xl font-bold text-slate-800">{stats.totalActions}</p>
          </div>
          <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <p className="text-sm text-slate-500 mb-1">Action Types</p>
            <p className="text-2xl font-bold text-slate-800">{Object.keys(stats.actionsByType).length}</p>
          </div>
          <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <p className="text-sm text-slate-500 mb-1">Active Users</p>
            <p className="text-2xl font-bold text-slate-800">{Object.keys(stats.actionsByUser).length}</p>
          </div>
          <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <p className="text-sm text-slate-500 mb-1">Recent Actions</p>
            <p className="text-2xl font-bold text-slate-800">{stats.recentActions.length}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">User ID</label>
            <input
              type="text"
              value={filters.userId}
              onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
              placeholder="Filter by user"
              className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Action</label>
            <input
              type="text"
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              placeholder="Filter by action"
              className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => setFilters({ userId: '', action: '', startDate: '', endDate: '', resource: '' })}
              className="px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded"
            >
              Clear
            </button>
            <button
              onClick={() => handleExport('json')}
              className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-1"
            >
              <Download className="w-3 h-3" /> Export
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Resource</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No audit logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-800">{log.userName}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 font-mono text-xs">
                      {log.resource}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {Object.keys(log.details).length > 0 ? (
                        <details>
                          <summary className="cursor-pointer text-indigo-600 hover:text-indigo-700">
                            View Details
                          </summary>
                          <pre className="mt-2 text-xs bg-slate-50 p-2 rounded overflow-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminActionLog;
