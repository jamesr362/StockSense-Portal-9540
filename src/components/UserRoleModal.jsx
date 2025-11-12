import { motion, AnimatePresence } from 'framer-motion';
import { RiCloseLine, RiUserLine, RiAdminLine } from 'react-icons/ri';
import { useState } from 'react';

export default function UserRoleModal({ isOpen, onClose, onSave, user }) {
  const [selectedRole, setSelectedRole] = useState(user?.role || 'user');

  const roles = [
    {
      value: 'user',
      label: 'Regular User',
      description: 'Can manage their own inventory and view basic reports',
      icon: RiUserLine,
      color: 'text-blue-600'
    },
    {
      value: 'admin',
      label: 'Administrator',
      description: 'Full system access including user management',
      icon: RiAdminLine,
      color: 'text-purple-600'
    }
  ];

  const handleSave = () => {
    onSave(user.email, selectedRole);
    onClose();
  };

  if (!user) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 overflow-y-auto"
        >
          <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={onClose} />
            <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
              &#8203;
            </span>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative inline-block transform overflow-hidden rounded-lg bg-gray-800 px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle"
            >
              <div className="absolute right-0 top-0 pr-4 pt-4">
                <button
                  type="button"
                  className="rounded-md bg-gray-800 text-gray-400 hover:text-gray-300 focus:outline-none"
                  onClick={onClose}
                >
                  <span className="sr-only">Close</span>
                  <RiCloseLine className="h-6 w-6" />
                </button>
              </div>

              <div className="sm:flex sm:items-start">
                <div className="mt-3 w-full text-center sm:mt-0 sm:text-left">
                  <h3 className="text-lg font-medium leading-6 text-white">
                    Change User Role
                  </h3>

                  <div className="mt-4 p-3 bg-gray-700 rounded-md">
                    <p className="text-sm text-gray-300">
                      <strong>User:</strong> {user.businessName}
                    </p>
                    <p className="text-sm text-gray-300">
                      <strong>Email:</strong> {user.email}
                    </p>
                  </div>

                  <div className="mt-6 space-y-4">
                    {roles.map((role) => (
                      <div
                        key={role.value}
                        className={`relative rounded-lg border p-4 cursor-pointer transition-colors ${
                          selectedRole === role.value
                            ? 'border-primary-500 bg-primary-50/10'
                            : 'border-gray-600 hover:border-gray-500'
                        }`}
                        onClick={() => setSelectedRole(role.value)}
                      >
                        <div className="flex items-start">
                          <div className="flex-shrink-0">
                            <input
                              type="radio"
                              name="role"
                              value={role.value}
                              checked={selectedRole === role.value}
                              onChange={() => setSelectedRole(role.value)}
                              className="h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                            />
                          </div>
                          <div className="ml-3 flex-1">
                            <div className="flex items-center">
                              <role.icon className={`h-5 w-5 mr-2 ${role.color}`} />
                              <label className="block text-sm font-medium text-white">
                                {role.label}
                              </label>
                            </div>
                            <p className="text-sm text-gray-400 mt-1">
                              {role.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="inline-flex w-full justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleSave}
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-600 bg-gray-700 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                  onClick={onClose}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}