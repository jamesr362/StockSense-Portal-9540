import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { RiTimeLine, RiUserLine, RiCloseLine, RiRefreshLine, RiAlertLine } from 'react-icons/ri';
import { getPasswordResetRequests, cancelPasswordReset } from '../services/auth';

export default function PasswordResetRequestsPanel({ adminEmail }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadRequests();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadRequests, 30000);
    return () => clearInterval(interval);
  }, [adminEmail]);

  const loadRequests = async () => {
    try {
      setError(null);
      const activeRequests = await getPasswordResetRequests(adminEmail);
      setRequests(activeRequests);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async (email) => {
    if (!window.confirm(`Are you sure you want to cancel the password reset request for ${email}?`)) {
      return;
    }

    try {
      await cancelPasswordReset(adminEmail, email);
      await loadRequests(); // Refresh the list
    } catch (err) {
      setError(err.message);
    }
  };

  const formatTimeRemaining = (expiresAt) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Expired';
    
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 60) return `${diffMins}m remaining`;
    
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;
    return `${diffHours}h ${remainingMins}m remaining`;
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'platformadmin': return 'text-red-400 bg-red-900/20';
      case 'admin': return 'text-purple-400 bg-purple-900/20';
      case 'user': default: return 'text-blue-400 bg-blue-900/20';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-white">Active Password Reset Requests</h3>
          <p className="text-sm text-gray-400">Monitor and manage pending password reset requests</p>
        </div>
        <button
          onClick={loadRequests}
          disabled={loading}
          className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <RiRefreshLine className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-md">
          <div className="flex items-center">
            <RiAlertLine className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        </div>
      )}

      {requests.length === 0 ? (
        <div className="text-center py-8">
          <RiTimeLine className="mx-auto h-12 w-12 text-gray-500 mb-4" />
          <h4 className="text-white font-medium mb-2">No Active Reset Requests</h4>
          <p className="text-gray-400 text-sm">
            There are currently no pending password reset requests.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request, index) => (
            <motion.div
              key={request.email}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center justify-between p-4 bg-gray-700 rounded-lg border border-gray-600"
            >
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <RiUserLine className="h-6 w-6 text-gray-400" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-white">{request.businessName}</span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(request.role)}`}>
                      {request.role}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm">{request.email}</p>
                  <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                    <span>Requested: {new Date(request.requestedAt).toLocaleString()}</span>
                    <span className="text-yellow-400">
                      {formatTimeRemaining(request.expiresAt)}
                    </span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => handleCancelRequest(request.email)}
                className="p-2 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-900/20 transition-colors"
                title="Cancel reset request"
              >
                <RiCloseLine className="h-5 w-5" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
        <div className="flex items-start">
          <RiTimeLine className="h-5 w-5 text-blue-400 mr-3 mt-0.5" />
          <div>
            <h4 className="text-blue-400 font-medium mb-1">Reset Request Management</h4>
            <ul className="text-blue-300 text-sm space-y-1">
              <li>• Reset requests automatically expire after 1 hour</li>
              <li>• Users can request a new reset if their request expires</li>
              <li>• Cancelling a request will invalidate the reset link</li>
              <li>• This panel auto-refreshes every 30 seconds</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}