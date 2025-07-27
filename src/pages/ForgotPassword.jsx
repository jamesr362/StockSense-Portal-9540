import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RiAlertLine, RiCheckLine, RiMailLine } from 'react-icons/ri';
import { validateEmail, sanitizeInput, logSecurityEvent } from '../utils/security';
import { requestPasswordReset } from '../services/auth';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Sanitize input
      const sanitizedEmail = sanitizeInput(email.toLowerCase().trim());

      // Validate email format
      if (!validateEmail(sanitizedEmail)) {
        setError('Please enter a valid email address');
        logSecurityEvent('INVALID_EMAIL_FORMAT', { email: sanitizedEmail });
        return;
      }

      // Request password reset
      await requestPasswordReset(sanitizedEmail);

      // Log the event
      logSecurityEvent('PASSWORD_RESET_REQUESTED', { email: sanitizedEmail });

      // Show success message
      setSuccess(true);
    } catch (error) {
      console.error('Password reset request error:', error);
      setError(error.message || 'An error occurred. Please try again later.');
      logSecurityEvent('PASSWORD_RESET_REQUEST_ERROR', {
        email: sanitizeInput(email),
        error: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8"
      >
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mx-auto w-auto mb-8"
          >
            <h1 className="text-4xl sm:text-5xl font-bold text-white bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
              Trackio
            </h1>
            <p className="text-sm text-gray-400 mt-2">Inventory Management System</p>
          </motion.div>
          <h2 className="text-center text-2xl sm:text-3xl font-extrabold text-white">
            Reset Your Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Enter your email and we'll send you a link to reset your password
          </p>
        </div>

        {!success ? (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-md bg-red-900/50 p-4"
              >
                <div className="flex items-center">
                  <RiAlertLine className="h-5 w-5 text-red-400 mr-2" />
                  <div className="text-sm text-red-200">{error}</div>
                </div>
              </motion.div>
            )}

            <div className="rounded-md shadow-sm">
              <div>
                <label htmlFor="email-address" className="sr-only">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <RiMailLine className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    className="appearance-none relative block w-full pl-10 px-3 py-3 sm:py-2 border border-gray-700 placeholder-gray-400 text-white rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm bg-gray-800"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                  isLoading
                    ? 'bg-primary-400 cursor-not-allowed'
                    : 'bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
                }`}
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </div>

            <div className="text-center">
              <Link to="/login" className="font-medium text-primary-400 hover:text-primary-300">
                Back to login
              </Link>
            </div>
          </form>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-md bg-green-900/30 border border-green-700 p-6 mt-8 text-center"
          >
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-500 rounded-full mb-4">
              <RiCheckLine className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Check Your Email</h3>
            <p className="text-green-300 mb-4">
              If an account exists with {email}, we've sent instructions to reset your password.
            </p>
            <p className="text-gray-400 text-sm">
              Don't see it? Check your spam folder or{' '}
              <button
                onClick={() => {
                  setSuccess(false);
                  setEmail('');
                }}
                className="text-primary-400 hover:text-primary-300"
              >
                try again
              </button>
            </p>
            <div className="mt-6">
              <Link
                to="/login"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
              >
                Return to Login
              </Link>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}