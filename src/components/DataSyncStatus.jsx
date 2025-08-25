import { motion, AnimatePresence } from 'framer-motion';
import { RiCheckLine, RiAlertLine, RiRefreshLine, RiCloudLine, RiWifiOffLine } from 'react-icons/ri';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import useDataSync from '../hooks/useDataSync';
import { supabase } from '../lib/supabase';

export default function DataSyncStatus({ showDetails = false }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSyncDetails, setShowSyncDetails] = useState(false);
  const { user } = useAuth();
  const { syncStatus, lastSync, error, syncAllLocalStorageToDatabase } = useDataSync();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && user?.email) {
      const timer = setTimeout(() => {
        syncAllLocalStorageToDatabase();
      }, 2000); // Wait 2 seconds after coming online

      return () => clearTimeout(timer);
    }
  }, [isOnline, user?.email, syncAllLocalStorageToDatabase]);

  const handleManualSync = async () => {
    if (!user?.email) return;
    await syncAllLocalStorageToDatabase();
  };

  const getSyncStatusIcon = () => {
    if (!isOnline) return <RiWifiOffLine className="h-4 w-4 text-red-400" />;
    if (!supabase) return <RiAlertLine className="h-4 w-4 text-yellow-400" />;
    
    switch (syncStatus) {
      case 'syncing':
        return <RiRefreshLine className="h-4 w-4 text-blue-400 animate-spin" />;
      case 'success':
        return <RiCheckLine className="h-4 w-4 text-green-400" />;
      case 'error':
        return <RiAlertLine className="h-4 w-4 text-red-400" />;
      default:
        return <RiCloudLine className="h-4 w-4 text-gray-400" />;
    }
  };

  const getSyncStatusText = () => {
    if (!isOnline) return 'Offline';
    if (!supabase) return 'Database unavailable';
    
    switch (syncStatus) {
      case 'syncing':
        return 'Syncing...';
      case 'success':
        return 'Synced';
      case 'error':
        return 'Sync failed';
      default:
        return 'Ready to sync';
    }
  };

  const getSyncStatusColor = () => {
    if (!isOnline) return 'text-red-400';
    if (!supabase) return 'text-yellow-400';
    
    switch (syncStatus) {
      case 'syncing':
        return 'text-blue-400';
      case 'success':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  if (!showDetails && syncStatus === 'success' && isOnline) {
    return null; // Hide when everything is working fine
  }

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-3 max-w-xs"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {getSyncStatusIcon()}
              <span className={`ml-2 text-sm font-medium ${getSyncStatusColor()}`}>
                {getSyncStatusText()}
              </span>
            </div>
            
            {(syncStatus === 'error' || !isOnline || !supabase) && (
              <button
                onClick={handleManualSync}
                disabled={!isOnline || syncStatus === 'syncing'}
                className="ml-2 p-1 text-gray-400 hover:text-gray-300 disabled:opacity-50"
                title="Retry sync"
              >
                <RiRefreshLine className={`h-4 w-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          {/* Detailed status information */}
          {showDetails && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <div className="space-y-1 text-xs text-gray-400">
                <div className="flex justify-between">
                  <span>Connection:</span>
                  <span className={isOnline ? 'text-green-400' : 'text-red-400'}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Database:</span>
                  <span className={supabase ? 'text-green-400' : 'text-yellow-400'}>
                    {supabase ? 'Available' : 'Unavailable'}
                  </span>
                </div>
                {lastSync && (
                  <div className="flex justify-between">
                    <span>Last sync:</span>
                    <span className="text-white">
                      {new Date(lastSync).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error details */}
          {error && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {/* Offline notice */}
          {!isOnline && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <p className="text-xs text-yellow-300">
                Changes saved locally. Will sync when back online.
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}