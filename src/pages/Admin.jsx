import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { getAllUsers, deleteUser, updateUserRole } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { RiUserLine, RiAdminLine, RiDeleteBin6Line, RiEditLine, RiShieldCheckLine, RiTeamLine, RiSettings3Line } from 'react-icons/ri';
import DeleteUserModal from '../components/DeleteUserModal';
import UserRoleModal from '../components/UserRoleModal';

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const { user } = useAuth();

  const tabs = [
    { id: 'users', name: 'User Management', icon: RiTeamLine },
    { id: 'permissions', name: 'Permissions', icon: RiShieldCheckLine },
    { id: 'system', name: 'System Settings', icon: RiSettings3Line }
  ];

  const loadUsers = async () => {
    if (user?.role !== 'admin') return;

    try {
      setIsLoading(true);
      setError(null);
      const allUsers = await getAllUsers();
      setUsers(allUsers || []);
    } catch (error) {
      console.error('Error loading users:', error);
      setError('Failed to load users');
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [user]);

  const handleDeleteUser = async (email) => {
    try {
      setError(null);
      await deleteUser(email);
      setSuccessMessage(`User ${email} has been successfully deleted`);
      await loadUsers();
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
    } catch (error) {
      console.error('Error deleting user:', error);
      setError('Failed to delete user. Please try again.');
    }
  };

  const handleUpdateRole = async (email, newRole) => {
    try {
      setError(null);
      await updateUserRole(email, newRole);
      setSuccessMessage(`User role updated successfully`);
      await loadUsers();
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
    } catch (error) {
      console.error('Error updating user role:', error);
      setError('Failed to update user role. Please try again.');
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

  const closeDeleteModal = () => {
    setSelectedUser(null);
    setIsDeleteModalOpen(false);
  };

  const closeRoleModal = () => {
    setSelectedUser(null);
    setIsRoleModalOpen(false);
  };

  // Check if user is admin
  if (!user || user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-white">Loading admin panel...</span>
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
            <h1 className="text-2xl font-semibold text-white">Admin Dashboard</h1>
            <p className="mt-2 text-sm text-gray-400">
              Complete system administration and user management
            </p>
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
                  <div className="block lg:hidden space-y-4">
                    {users.map((userData) => (
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
                                onClick={() => openRoleModal(userData)}
                                className="p-2 text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded-md"
                                title="Change role"
                                disabled={userData.email === user.email}
                              >
                                <RiEditLine className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openDeleteModal(userData)}
                                className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded-md"
                                title="Delete user"
                                disabled={userData.email === user.email}
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
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                  userData.role === 'admin'
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {userData.role === 'admin' ? (
                                  <RiAdminLine className="mr-1 h-3 w-3" />
                                ) : (
                                  <RiUserLine className="mr-1 h-3 w-3" />
                                )}
                                {userData.role}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Created:</span>
                              <span className="text-white">
                                {userData.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                            {userData.email === user.email && (
                              <div className="flex justify-center">
                                <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">(You)</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden lg:block overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-800">
                          <tr>
                            <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-white sm:pl-6 min-w-[150px]">
                              Business Name
                            </th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-white min-w-[200px]">
                              Email
                            </th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-white min-w-[100px]">
                              Role
                            </th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-white min-w-[120px]">
                              Created At
                            </th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-white min-w-[100px]">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700 bg-gray-800">
                          {users.map((userData) => (
                            <motion.tr
                              key={userData.email}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.3 }}
                            >
                              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-white sm:pl-6">
                                <div className="max-w-[150px] truncate" title={userData.businessName}>
                                  {userData.businessName}
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">
                                <div className="max-w-[200px] truncate" title={userData.email}>
                                  {userData.email}
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm">
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                    userData.role === 'admin'
                                      ? 'bg-purple-100 text-purple-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {userData.role === 'admin' ? (
                                    <RiAdminLine className="mr-1 h-3 w-3" />
                                  ) : (
                                    <RiUserLine className="mr-1 h-3 w-3" />
                                  )}
                                  {userData.role}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">
                                {userData.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm">
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => openRoleModal(userData)}
                                    className="text-blue-400 hover:text-blue-300"
                                    title="Change role"
                                    disabled={userData.email === user.email}
                                  >
                                    <RiEditLine className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => openDeleteModal(userData)}
                                    className="text-red-400 hover:text-red-300"
                                    title="Delete user"
                                    disabled={userData.email === user.email}
                                  >
                                    <RiDeleteBin6Line className="h-4 w-4" />
                                  </button>
                                  {userData.email === user.email && (
                                    <span className="text-xs text-gray-500">(You)</span>
                                  )}
                                </div>
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobile Horizontal Scroll Table Alternative */}
                  <div className="block sm:hidden lg:hidden mt-8">
                    <div className="mb-2">
                      <p className="text-xs text-gray-400 px-1">
                        💡 Swipe left/right to see more details
                      </p>
                    </div>
                    <div className="overflow-x-auto bg-gray-800 rounded-lg shadow">
                      <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-700">
                          <tr>
                            <th className="py-3 px-3 text-left text-xs font-semibold text-white uppercase tracking-wider min-w-[120px]">
                              Business
                            </th>
                            <th className="py-3 px-3 text-left text-xs font-semibold text-white uppercase tracking-wider min-w-[150px]">
                              Email
                            </th>
                            <th className="py-3 px-3 text-left text-xs font-semibold text-white uppercase tracking-wider min-w-[80px]">
                              Role
                            </th>
                            <th className="py-3 px-3 text-left text-xs font-semibold text-white uppercase tracking-wider min-w-[80px]">
                              Created
                            </th>
                            <th className="py-3 px-3 text-left text-xs font-semibold text-white uppercase tracking-wider min-w-[80px]">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {users.map((userData) => (
                            <tr key={userData.email}>
                              <td className="py-3 px-3 text-sm text-white">
                                <div className="font-medium truncate max-w-[120px]" title={userData.businessName}>
                                  {userData.businessName}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-sm text-gray-300">
                                <div className="truncate max-w-[150px]" title={userData.email}>
                                  {userData.email}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-sm">
                                <span
                                  className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                    userData.role === 'admin'
                                      ? 'bg-purple-100 text-purple-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {userData.role}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-sm text-gray-300">
                                {userData.createdAt ? new Date(userData.createdAt).toLocaleDateString('en-GB', { 
                                  day: '2-digit', 
                                  month: '2-digit' 
                                }) : 'N/A'}
                              </td>
                              <td className="py-3 px-3 text-sm">
                                <div className="flex space-x-1">
                                  <button
                                    onClick={() => openRoleModal(userData)}
                                    className="p-1 text-blue-400 hover:text-blue-300"
                                    title="Edit"
                                    disabled={userData.email === user.email}
                                  >
                                    <RiEditLine className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => openDeleteModal(userData)}
                                    className="p-1 text-red-400 hover:text-red-300"
                                    title="Delete"
                                    disabled={userData.email === user.email}
                                  >
                                    <RiDeleteBin6Line className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* Statistics */}
              <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="bg-gray-800 overflow-hidden rounded-lg shadow"
                >
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <RiUserLine className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-400 truncate">
                            Total Users
                          </dt>
                          <dd className="flex items-baseline">
                            <div className="text-2xl font-semibold text-white">
                              {users.length}
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
                              {users.filter(u => u.role === 'admin').length}
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
                        <RiUserLine className="h-6 w-6 text-blue-400" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-400 truncate">
                            Regular Users
                          </dt>
                          <dd className="flex items-baseline">
                            <div className="text-2xl font-semibold text-white">
                              {users.filter(u => u.role === 'user').length}
                            </div>
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {activeTab === 'permissions' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="bg-gray-800 rounded-lg p-6"
            >
              <h3 className="text-lg font-medium text-white mb-4">Role Permissions</h3>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <RiUserLine className="h-5 w-5 text-blue-400 mr-2" />
                      <h4 className="text-md font-medium text-white">Regular User</h4>
                    </div>
                    <ul className="space-y-2 text-sm text-gray-300">
                      <li>• Manage their own inventory</li>
                      <li>• Add, edit, and delete their items</li>
                      <li>• View their dashboard statistics</li>
                      <li>• Update stock levels and status</li>
                      <li>• Search and filter inventory</li>
                    </ul>
                  </div>

                  <div className="border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <RiAdminLine className="h-5 w-5 text-purple-400 mr-2" />
                      <h4 className="text-md font-medium text-white">Administrator</h4>
                    </div>
                    <ul className="space-y-2 text-sm text-gray-300">
                      <li>• All regular user permissions</li>
                      <li>• View and manage all users</li>
                      <li>• Delete user accounts</li>
                      <li>• Change user roles</li>
                      <li>• Access admin dashboard</li>
                      <li>• System-wide settings control</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'system' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="bg-gray-800 rounded-lg p-6"
            >
              <h3 className="text-lg font-medium text-white mb-4">System Settings</h3>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      System Name
                    </label>
                    <input
                      type="text"
                      value="Trackio"
                      className="block w-full rounded-md border-gray-700 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Version
                    </label>
                    <input
                      type="text"
                      value="1.0.0"
                      className="block w-full rounded-md border-gray-700 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      readOnly
                    />
                  </div>
                </div>

                <div className="border-t border-gray-700 pt-6">
                  <h4 className="text-md font-medium text-white mb-3">Admin Access Control</h4>
                  <p className="text-sm text-gray-400 mb-4">
                    Only users with email addresses ending in "@admin" can be granted administrator privileges.
                  </p>
                  <div className="bg-gray-700 rounded-md p-3">
                    <p className="text-sm text-gray-300">
                      <strong>Current Admin:</strong> {user.email}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

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
    </div>
  );
}