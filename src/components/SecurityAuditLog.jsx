import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RiShieldCheckLine, RiAlertLine, RiEyeLine, RiDownloadLine, RiDeleteBin6Line } from 'react-icons/ri';

export default function SecurityAuditLog({ userEmail }) {
  const [securityLogs, setSecurityLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadSecurityLogs();
  }, [userEmail]);

  useEffect(() => {
    filterLogs();
  }, [securityLogs, filter]);

  const loadSecurityLogs = () => {
    try {
      const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
      // Filter logs for current user if provided
      const userLogs = userEmail ? logs.filter(log => log.details.userEmail === userEmail) : logs;
      setSecurityLogs(userLogs);
    } catch (error) {
      console.error('Error loading security logs:', error);
      setSecurityLogs([]);
    }
  };

  const filterLogs = () => {
    let filtered = [...securityLogs];
    if (filter !== 'all') {
      filtered = filtered.filter(log => log.event.toLowerCase().includes(filter.toLowerCase()));
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    setFilteredLogs(filtered);
  };

  const clearLogs = () => {
    if (window.confirm('Are you sure you want to clear all security logs? This action cannot be undone.')) {
      localStorage.removeItem('security_logs');
      setSecurityLogs([]);
    }
  };

  const exportLogs = () => {
    const dataStr = JSON.stringify(securityLogs, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `security-audit-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const getEventIcon = (event) => {
    if (event.toLowerCase().includes('login') || event.toLowerCase().includes('auth')) {
      return <RiShieldCheckLine className="h-5 w-5 text-green-400" />;
    } else if (event.toLowerCase().includes('failed') || event.toLowerCase().includes('error')) {
      return <RiAlertLine className="h-5 w-5 text-red-400" />;
    }
    return <RiEyeLine className="h-5 w-5 text-blue-400" />;
  };

  const getEventColor = (event) => {
    if (event.toLowerCase().includes('failed') || event.toLowerCase().includes('error')) {
      return 'text-red-400 bg-red-900/20';
    } else if (event.toLowerCase().includes('login') || event.toLowerCase().includes('success')) {
      return 'text-green-400 bg-green-900/20';
    }
    return 'text-blue-400 bg-blue-900/20';
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg">
      <div className="px-4 py-5 border-b border-gray-700 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg leading-6 font-medium text-white">Security Audit Log</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-400">
              Monitor security events and access patterns
            </p>
          </div>
          <div className="flex space-x-2">
            {securityLogs.length > 0 && (
              <>
                <button
                  onClick={exportLogs}
                  className="inline-flex items-center px-3 py-1 border border-gray-600 rounded-md text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600"
                >
                  <RiDownloadLine className="h-4 w-4 mr-1" /> Export
                </button>
                <button
                  onClick={clearLogs}
                  className="inline-flex items-center px-3 py-1 border border-red-600 rounded-md text-sm font-medium text-red-400 bg-red-900/20 hover:bg-red-900/40"
                >
                  <RiDeleteBin6Line className="h-4 w-4 mr-1" /> Clear
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="px-4 py-5 sm:p-6">
        {/* Filter Controls */}
        <div className="mb-4 flex flex-wrap gap-2">
          {['all', 'login', 'failed', 'upload', 'access'].map((filterOption) => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === filterOption
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
            </button>
          ))}
        </div>

        {/* Security Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center">
              <RiShieldCheckLine className="h-8 w-8 text-green-400 mr-3" />
              <div>
                <div className="text-2xl font-bold text-white">
                  {securityLogs.filter(log => log.event.toLowerCase().includes('login')).length}
                </div>
                <div className="text-gray-400 text-sm">Login Events</div>
              </div>
            </div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center">
              <RiAlertLine className="h-8 w-8 text-red-400 mr-3" />
              <div>
                <div className="text-2xl font-bold text-white">
                  {securityLogs.filter(log => log.event.toLowerCase().includes('failed')).length}
                </div>
                <div className="text-gray-400 text-sm">Failed Attempts</div>
              </div>
            </div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center">
              <RiEyeLine className="h-8 w-8 text-blue-400 mr-3" />
              <div>
                <div className="text-2xl font-bold text-white">{securityLogs.length}</div>
                <div className="text-gray-400 text-sm">Total Events</div>
              </div>
            </div>
          </div>
        </div>

        {/* Security Log Entries */}
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8">
            <RiShieldCheckLine className="mx-auto h-12 w-12 text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No security events</h3>
            <p className="text-gray-400">Security events will appear here when they occur.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredLogs.map((log, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`p-4 rounded-lg border ${getEventColor(log.event)} border-gray-600`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {getEventIcon(log.event)}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-white">{log.event}</span>
                        <span className="text-xs text-gray-400">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                      {log.details && (
                        <div className="mt-2 text-sm text-gray-300">
                          {log.details.userEmail && (
                            <div>User: {log.details.userEmail}</div>
                          )}
                          {log.details.error && (
                            <div className="text-red-300">Error: {log.details.error}</div>
                          )}
                          {log.details.ip && (
                            <div>IP: {log.details.ip}</div>
                          )}
                          {log.details.userAgent && (
                            <div className="text-xs text-gray-400 mt-1 truncate">
                              User Agent: {log.details.userAgent}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}