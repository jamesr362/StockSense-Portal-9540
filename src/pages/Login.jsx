import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { getUserByEmail, updateUserLastLogin } from '../services/db';
import { validateEmail, verifyPassword, checkRateLimit, recordFailedAttempt, clearFailedAttempts, logSecurityEvent, sanitizeInput } from '../utils/security';
import { RiAlertLine, RiEyeLine, RiEyeOffLine } from 'react-icons/ri';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      // Sanitize inputs
      const sanitizedEmail = sanitizeInput(email.toLowerCase().trim());
      
      // Validate email format
      if (!validateEmail(sanitizedEmail)) {
        setError('Please enter a valid email address');
        logSecurityEvent('INVALID_EMAIL_FORMAT', { email: sanitizedEmail });
        setIsLoading(false);
        return;
      }
      
      // Check rate limiting
      const rateCheck = checkRateLimit(sanitizedEmail);
      if (!rateCheck.allowed) {
        setRateLimited(true);
        setRemainingTime(rateCheck.remainingTime);
        setError(`Too many failed attempts. Please try again in ${rateCheck.remainingTime} minutes.`);
        logSecurityEvent('RATE_LIMITED_LOGIN_ATTEMPT', { email: sanitizedEmail });
        setIsLoading(false);
        return;
      }
      
      // Try to sign in with Supabase if available
      if (supabase) {
        try {
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: sanitizedEmail,
            password: password
          });
          
          if (!authError && authData) {
            console.log('Supabase auth login successful:', authData);
            
            // Get user data from our custom table
            const { data: userData, error: userError } = await supabase
              .from('users_tb2k4x9p1m')
              .select('email, business_name, role, created_at, last_login')
              .eq('email', sanitizedEmail)
              .single();
            
            if (!userError && userData) {
              // Clear failed attempts on successful login
              clearFailedAttempts(sanitizedEmail);
              
              // Update last login
              await supabase
                .from('users_tb2k4x9p1m')
                .update({ last_login: new Date().toISOString() })
                .eq('email', sanitizedEmail);
              
              // Create user session
              const userObj = {
                email: userData.email,
                businessName: userData.business_name,
                role: userData.role
              };
              
              logSecurityEvent('SUCCESSFUL_LOGIN', {
                email: sanitizedEmail,
                role: userData.role,
                businessName: userData.business_name
              });
              
              login(userObj);
              
              // Navigate based on role
              if (userData.role === 'platformadmin') {
                navigate('/platform-admin', { replace: true });
              } else if (userData.role === 'admin') {
                navigate('/admin', { replace: true });
              } else {
                navigate('/dashboard', { replace: true });
              }
              
              return;
            }
          }
        } catch (err) {
          console.error('Error during Supabase login:', err);
          // Continue with local login fallback
        }
      }
      
      // Get user from database (fallback to local)
      const user = await getUserByEmail(sanitizedEmail);
      if (!user) {
        recordFailedAttempt(sanitizedEmail);
        setError('Invalid email or password');
        logSecurityEvent('FAILED_LOGIN_INVALID_EMAIL', { email: sanitizedEmail });
        setIsLoading(false);
        return;
      }
      
      // Verify password
      let passwordValid = false;
      if (user.salt) {
        // New hashed password system
        passwordValid = verifyPassword(password, user.password, user.salt);
      } else {
        // Legacy plain text passwords (for backward compatibility)
        passwordValid = user.password === password;
      }
      
      if (!passwordValid) {
        recordFailedAttempt(sanitizedEmail);
        setError('Invalid email or password');
        logSecurityEvent('FAILED_LOGIN_INVALID_PASSWORD', { email: sanitizedEmail });
        setIsLoading(false);
        return;
      }
      
      // Clear failed attempts on successful login
      clearFailedAttempts(sanitizedEmail);
      
      // Update last login
      await updateUserLastLogin(sanitizedEmail);
      
      // Create user session
      const userData = {
        email: user.email,
        businessName: user.businessName,
        role: user.role
      };
      
      logSecurityEvent('SUCCESSFUL_LOGIN', {
        email: sanitizedEmail,
        role: user.role,
        businessName: user.businessName
      });
      
      login(userData);
      
      // Navigate based on role
      if (user.role === 'platformadmin') {
        navigate('/platform-admin', { replace: true });
      } else if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('An error occurred during login. Please try again.');
      logSecurityEvent('LOGIN_ERROR', { 
        email: sanitizeInput(email), 
        error: error.message 
      });
      setIsLoading(false);
    }
  };

  const handleEmailChange = (value) => {
    setEmail(value);
    setError('');
    setRateLimited(false);
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
    setError('');
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
            Sign in to your account
          </h2>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-md p-4 ${rateLimited ? 'bg-orange-900/50' : 'bg-red-900/50'}`}
            >
              <div className="flex items-center">
                <RiAlertLine
                  className={`h-5 w-5 mr-2 ${rateLimited ? 'text-orange-400' : 'text-red-400'}`}
                />
                <div className={`text-sm ${rateLimited ? 'text-orange-200' : 'text-red-200'}`}>
                  {error}
                </div>
              </div>
            </motion.div>
          )}

          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                className="appearance-none relative block w-full px-3 py-3 sm:py-2 border border-gray-700 placeholder-gray-400 text-white rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm bg-gray-800"
                placeholder="Email address"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                disabled={isLoading || rateLimited}
              />
            </div>
            
            <div className="relative">
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                maxLength={128}
                className="appearance-none relative block w-full px-3 py-3 sm:py-2 pr-10 border border-gray-700 placeholder-gray-400 text-white rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm bg-gray-800"
                placeholder="Password"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                disabled={isLoading || rateLimited}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-300"
                disabled={isLoading || rateLimited}
              >
                {showPassword ? (
                  <RiEyeOffLine className="h-5 w-5" />
                ) : (
                  <RiEyeLine className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading || rateLimited}
              className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                isLoading || rateLimited
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
                  Signing in...
                </span>
              ) : rateLimited ? (
                `Locked for ${remainingTime} minutes`
              ) : (
                'Sign in'
              )}
            </button>
          </div>

          <div className="text-center">
            <Link to="/register" className="font-medium text-primary-400 hover:text-primary-300">
              Don't have an account? Sign up
            </Link>
          </div>
        </form>
      </motion.div>
    </div>
  );
}