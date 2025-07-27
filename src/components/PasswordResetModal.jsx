import { motion, AnimatePresence } from 'framer-motion';
import { RiCloseLine, RiLockLine, RiAlertLine, RiCheckLine, RiEyeLine, RiEyeOffLine } from 'react-icons/ri';
import { useState } from 'react';
import { adminChangeUserPassword, generateTemporaryPassword } from '../services/auth';
import { validatePassword } from '../utils/security';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';

export default function PasswordResetModal({ isOpen, onClose, user, adminEmail }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.errors[0]);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await adminChangeUserPassword(adminEmail, user.email, newPassword);
      setSuccess(true);
      
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePassword = () => {
    const tempPassword = generateTemporaryPassword();
    setGeneratedPassword(tempPassword);
    setNewPassword(tempPassword);
    setConfirmPassword(tempPassword);
  };

  const handleClose = () => {
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError('');
    setSuccess(false);
    setGeneratedPassword('');
    onClose();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here
    });
  };

  if (!user) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-75"
        >
          <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
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
                  onClick={handleClose}
                >
                  <RiCloseLine className="h-6 w-6" />
                </button>
              </div>

              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 sm:mx-0 sm:h-10 sm:w-10">
                  <RiLockLine className="h-6 w-6 text-primary-600" />
                </div>
                
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                  <h3 className="text-lg font-medium leading-6 text-white">
                    Change User Password
                  </h3>
                  
                  {success ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 bg-green-900/50 border border-green-700 rounded-lg text-center"
                    >
                      <RiCheckLine className="h-8 w-8 text-green-400 mx-auto mb-2" />
                      <p className="text-green-300 font-medium">Password Changed Successfully</p>
                      <p className="text-green-400 text-sm mt-1">
                        The password for {user.businessName} has been updated.
                      </p>
                    </motion.div>
                  ) : (
                    <div className="mt-4">
                      <div className="mb-4 p-3 bg-gray-700 rounded-md">
                        <p className="text-sm text-gray-300">
                          <strong>User:</strong> {user.businessName}
                        </p>
                        <p className="text-sm text-gray-300">
                          <strong>Email:</strong> {user.email}
                        </p>
                        <p className="text-sm text-gray-300">
                          <strong>Role:</strong> {user.role}
                        </p>
                      </div>

                      <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Generate Password Button */}
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={handleGeneratePassword}
                            className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                          >
                            Generate Secure Password
                          </button>
                        </div>

                        {/* Generated Password Display */}
                        {generatedPassword && (
                          <div className="p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-blue-400 text-sm font-medium">Generated Password:</p>
                                <code className="text-blue-300 text-sm bg-blue-900/50 px-2 py-1 rounded">
                                  {generatedPassword}
                                </code>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(generatedPassword)}
                                className="text-blue-400 hover:text-blue-300 text-sm"
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                        )}

                        {/* New Password */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            New Password
                          </label>
                          <PasswordStrengthIndicator
                            password={newPassword}
                            onPasswordChange={setNewPassword}
                            placeholder="Enter new password"
                          />
                        </div>

                        {/* Confirm Password */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Confirm Password
                          </label>
                          <div className="relative">
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="w-full px-3 py-2 pr-10 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              placeholder="Confirm new password"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-300"
                            >
                              {showConfirmPassword ? (
                                <RiEyeOffLine className="h-5 w-5" />
                              ) : (
                                <RiEyeLine className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 bg-red-900/50 border border-red-700 rounded-md"
                          >
                            <div className="flex items-center">
                              <RiAlertLine className="h-5 w-5 text-red-400 mr-2" />
                              <p className="text-red-300 text-sm">{error}</p>
                            </div>
                          </motion.div>
                        )}

                        {/* Warning */}
                        <div className="p-3 bg-yellow-900/20 border border-yellow-700 rounded-md">
                          <div className="flex items-start">
                            <RiAlertLine className="h-5 w-5 text-yellow-400 mr-2 mt-0.5" />
                            <div>
                              <p className="text-yellow-300 text-sm">
                                <strong>Warning:</strong> This will immediately change the user's password.
                              </p>
                              <p className="text-yellow-400 text-xs mt-1">
                                The user will need to use the new password for their next login.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4">
                          <button
                            type="button"
                            onClick={handleClose}
                            className="inline-flex w-full justify-center rounded-md border border-gray-600 bg-gray-700 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-gray-600 sm:w-auto sm:text-sm"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isLoading || !newPassword || !confirmPassword}
                            className="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:w-auto sm:text-sm disabled:opacity-50"
                          >
                            {isLoading ? (
                              <div className="flex items-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Changing...
                              </div>
                            ) : (
                              'Change Password'
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}