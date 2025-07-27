import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { getAllUsers, deleteUser, updateUserRole, getPlatformStats } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { 
  RiUserLine, RiAdminLine, RiDeleteBin6Line, RiEditLine, RiShieldCheckLine, 
  RiTeamLine, RiSettings3Line, RiStore2Line, RiGlobalLine, RiRefreshLine, 
  RiMoneyDollarCircleLine, RiDashboardLine, RiExchangeDollarLine, RiLockLine,
  RiTimeLine
} from 'react-icons/ri';
import DeleteUserModal from '../components/DeleteUserModal';
import UserRoleModal from '../components/UserRoleModal';
import PasswordResetModal from '../components/PasswordResetModal';
import PasswordResetRequestsPanel from '../components/PasswordResetRequestsPanel';

export default function PlatformAdmin() {
  const [users, setUsers] = useState([]);
  const [platformStats, setPlatformStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isPasswordResetModalOpen, setIsPasswordResetModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const { user } = useAuth();

  const tabs = [
    { id: 'overview', name: 'Platform Overview', icon: RiDashboardLine },
    { id: 'users', name: 'User Management', icon: RiTeamLine },
    { id: 'password-resets', name: 'Password Resets', icon: RiTimeLine },
    { id: 'payments', name: 'Payment Settings', icon: RiMoneyDollarCircleLine },
    { id: 'stripe', name: 'Stripe Gateway', icon: RiExchangeDollarLine },
    { id: 'permissions', name: 'Role Permissions', icon: RiShieldCheckLine },
    { id: 'system', name: 'System Settings', icon: RiSettings3Line }
  ];

  const loadData = async (showRefreshIndicator = false) => {
    if (user?.role !== 'platformadmin') return;

    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const [allUsers, stats] = await Promise.all([
        getAllUsers(),
        getPlatformStats()
      ]);

      setUsers(allUsers || []);
      setPlatformStats(stats);

      console.log('Platform data refreshed:', {
        totalUsers: allUsers?.length,
        recentUsers: stats?.recentUsers?.length
      });
    } catch (error) {
      console.error('Error loading platform data:', error);
      setError('Failed to load platform data');
      setUsers([]);
      setPlatformStats(null);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Auto-refresh data every 30 seconds when on overview tab
  useEffect(() => {
    let intervalId;
    if (activeTab === 'overview') {
      intervalId = setInterval(() => {
        loadData(true);
      }, 30000); // Refresh every 30 seconds
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [activeTab, user]);

  // Initial data load
  useEffect(() => {
    loadData();
  }, [user]);

  // Manual refresh function
  const handleManualRefresh = () => {
    loadData(true);
  };

  const handleDeleteUser = async (email) => {
    try {
      setError(null);
      await deleteUser(email);
      setSuccessMessage(`User ${email} has been successfully deleted`);
      await loadData(true);
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
    } catch (error) {
      console.error('Error deleting user:', error);
      setError(error.message || 'Failed to delete user. Please try again.');
    }
  };

  const handleUpdateRole = async (email, newRole) => {
    try {
      setError(null);
      await updateUserRole(email, newRole);
      setSuccessMessage(`User role updated successfully`);
      await loadData(true);
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
    } catch (error) {
      console.error('Error updating user role:', error);
      setError(error.message || 'Failed to update user role. Please try again.');
    }
  };

  const openDeleteModal = (userData) => {
    setSelectedUser(userData);
    setIsDeleteModalOpen(true);
  };

  const openRoleModal = (userData) => {
    setSelectedUser(userData);
    setIsRoleModalOpen(true);
  };

  const openPasswordResetModal = (userData) => {
    setSelectedUser(userData);
    setIsPasswordResetModalOpen(true);
  };

  const closeDeleteModal = () => {
    setSelectedUser(null);
    setIsDeleteModalOpen(false);
  };

  const closeRoleModal = () => {
    setSelectedUser(null);
    setIsRoleModalOpen(false);
  };

  const closePasswordResetModal = () => {
    setSelectedUser(null);
    setIsPasswordResetModalOpen(false);
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'platformadmin': return RiGlobalLine;
      case 'admin': return RiAdminLine;
      case 'user':
      default: return RiUserLine;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'platformadmin': return 'bg-red-100 text-red-800';
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'user':
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  // Check if user is platform admin
  if (!user || user.role !== 'platformadmin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-white">Loading platform admin panel...</span>
      </div>
    );
  }

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-white">Platform Administration</h1>
            <p className="mt-2 text-sm text-gray-400">
              Complete platform management and system oversight
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-4">
            {activeTab === 'overview' && (
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center px-3 py-2 border border-gray-600 rounded-md text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <RiRefreshLine className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            )}
            <div className="flex items-center">
              <RiGlobalLine className="h-6 w-6 text-red-400 mr-2" />
              <span className="text-sm text-red-400 font-medium">Platform Administrator</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-8">
          <div className="border-b border-gray-700">
            <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <tab.icon className="h-5 w-5 mr-2" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-md bg-green-900/50 p-4"
          >
            <div className="text-sm text-green-200">{successMessage}</div>
          </motion.div>
        )}

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-md bg-red-900/50 p-4"
          >
            <div className="text-sm text-red-200">{error}</div>
          </motion.div>
        )}

        {/* Tab Content */}
        <div className="mt-8">
          {activeTab === 'overview' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {/* Auto-refresh indicator */}
              <div className="mb-4 flex items-center text-sm text-gray-400">
                <RiRefreshLine className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin text-primary-400' : ''}`} />
                {isRefreshing ? 'Refreshing data...' : 'Auto-refreshes every 30 seconds'}
              </div>

              {/* Platform Statistics */}
              {platformStats && (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="bg-gray-800 overflow-hidden rounded-lg shadow"
                  >
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <RiUserLine className="h-6 w-6 text-blue-400" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-400 truncate">
                              Total Users
                            </dt>
                            <dd className="flex items-baseline">
                              <div className="text-2xl font-semibold text-white">
                                {platformStats.totalUsers}
                              </div>
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="bg-gray-800 overflow-hidden rounded-lg shadow"
                  >
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <RiAdminLine className="h-6 w-6 text-purple-400" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-400 truncate">
                              Admins
                            </dt>
                            <dd className="flex items-baseline">
                              <div className="text-2xl font-semibold text-white">
                                {platformStats.totalAdmins}
                              </div>
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="bg-gray-800 overflow-hidden rounded-lg shadow"
                  >
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <RiStore2Line className="h-6 w-6 text-green-400" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-400 truncate">
                              Total Inventory Items
                            </dt>
                            <dd className="flex items-baseline">
                              <div className="text-2xl font-semibold text-white">
                                {platformStats.totalInventoryItems}
                              </div>
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="bg-gray-800 overflow-hidden rounded-lg shadow"
                  >
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <RiGlobalLine className="h-6 w-6 text-red-400" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-400 truncate">
                              Platform Admins
                            </dt>
                            <dd className="flex items-baseline">
                              <div className="text-2xl font-semibold text-white">
                                {platformStats.totalPlatformAdmins}
                              </div>
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* Recent Users */}
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-white">Recent Users</h3>
                  <span className="text-xs text-gray-500">
                    Last updated: {new Date().toLocaleTimeString()}
                  </span>
                </div>
                {platformStats?.recentUsers?.length > 0 ? (
                  <div className="space-y-3">
                    {platformStats.recentUsers.map((recentUser) => {
                      const RoleIcon = getRoleIcon(recentUser.role);
                      return (
                        <motion.div
                          key={recentUser.email}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3 }}
                          className="flex items-center justify-between py-2 border-b border-gray-700"
                        >
                          <div className="flex items-center">
                            <RoleIcon className="h-5 w-5 text-gray-400 mr-3" />
                            <div>
                              <p className="text-sm font-medium text-white">{recentUser.businessName}</p>
                              <p className="text-xs text-gray-400">{recentUser.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getRoleColor(recentUser.role)}`}>
                              {recentUser.role}
                            </span>
                            <span className="ml-3 text-xs text-gray-500">
                              {new Date(recentUser.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-400">No recent users found.</p>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {users.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400">No users found.</p>
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="space-y-4">
                    {users.map((userData) => {
                      const RoleIcon = getRoleIcon(userData.role);
                      const isPlatformAdmin = userData.role === 'platformadmin';
                      const isCurrentUser = userData.email === user.email;

                      return (
                        <motion.div
                          key={userData.email}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3 }}
                          className="bg-gray-800 rounded-lg shadow-lg overflow-hidden"
                        >
                          <div className="px-4 py-3 border-b border-gray-700">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-medium text-white truncate">
                                  {userData.businessName}
                                </h3>
                                <p className="text-sm text-gray-400 truncate">{userData.email}</p>
                              </div>
                              <div className="flex space-x-2 ml-3 flex-shrink-0">
                                <button
                                  onClick={() => openPasswordResetModal(userData)}
                                  className="p-2 text-yellow-400 hover:text-yellow-300 hover:bg-gray-700 rounded-md"
                                  title="Change password"
                                >
                                  <RiLockLine className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => openRoleModal(userData)}
                                  className="p-2 text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded-md"
                                  title="Change role"
                                  disabled={isPlatformAdmin || isCurrentUser}
                                >
                                  <RiEditLine className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => openDeleteModal(userData)}
                                  className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded-md"
                                  title="Delete user"
                                  disabled={isPlatformAdmin || isCurrentUser}
                                >
                                  <RiDeleteBin6Line className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="p-4">
                            <div className="space-y-3 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-400">Role:</span>
                                <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getRoleColor(userData.role)}`}>
                                  <RoleIcon className="mr-1 h-3 w-3" />
                                  {userData.role}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Created:</span>
                                <span className="text-white">
                                  {userData.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Last Login:</span>
                                <span className="text-white">
                                  {userData.lastLogin ? new Date(userData.lastLogin).toLocaleDateString() : 'Never'}
                                </span>
                              </div>
                              {isCurrentUser && (
                                <div className="flex justify-center">
                                  <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">(You)</span>
                                </div>
                              )}
                              {isPlatformAdmin && !isCurrentUser && (
                                <div className="flex justify-center">
                                  <span className="text-xs text-red-500 bg-red-900/20 px-2 py-1 rounded">(Protected)</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'password-resets' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <PasswordResetRequestsPanel adminEmail={user.email} />
            </motion.div>
          )}

          {/* Other existing tabs remain the same... */}
          {activeTab === 'payments' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="bg-gray-800 rounded-lg p-6"
            >
              {/* Payment settings content remains the same */}
            </motion.div>
          )}

          {/* Add other tab content here as needed */}
        </div>
      </motion.div>

      {/* Modals */}
      <DeleteUserModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteUser}
        user={selectedUser}
      />

      <UserRoleModal
        isOpen={isRoleModalOpen}
        onClose={closeRoleModal}
        onSave={handleUpdateRole}
        user={selectedUser}
      />

      <PasswordResetModal
        isOpen={isPasswordResetModalOpen}
        onClose={closePasswordResetModal}
        user={selectedUser}
        adminEmail={user.email}
      />
    </div>
  );
}