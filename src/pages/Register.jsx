import {useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {motion} from 'framer-motion';
import {createUser} from '../services/db';
import {useAuth} from '../context/AuthContext';
import PasswordStrengthIndicator from '../components/PasswordStrengthIndicator';
import {validateEmail,validatePassword,validateBusinessName,sanitizeInput,logSecurityEvent,hashPassword} from '../utils/security';

export default function Register() {
  const [formData,setFormData]=useState({
    businessName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error,setError]=useState('');
  const [isLoading,setIsLoading]=useState(false);
  const [validationErrors,setValidationErrors]=useState({});
  const navigate=useNavigate();
  const {login}=useAuth();

  const validateForm=()=> {
    const errors={};

    // Business name validation
    const businessValidation=validateBusinessName(formData.businessName);
    if (!businessValidation.isValid) {
      errors.businessName=businessValidation.error;
    }

    // Email validation
    if (!validateEmail(formData.email)) {
      errors.email='Please enter a valid email address';
    }

    // Password validation
    const passwordValidation=validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      errors.password=passwordValidation.errors[0];// Show first error
    }

    // Confirm password validation
    if (formData.password !==formData.confirmPassword) {
      errors.confirmPassword='Passwords do not match';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length===0;
  };

  const handleSubmit=async (e)=> {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Validate form
      if (!validateForm()) {
        setError('Please correct the errors below');
        return;
      }

      // Sanitize inputs
      const sanitizedData={
        businessName: sanitizeInput(formData.businessName.trim()),
        email: sanitizeInput(formData.email.toLowerCase().trim()),
        password: formData.password // Don't sanitize password as it may contain special chars
      };

      // Hash password
      const hashedPassword=hashPassword(sanitizedData.password);

      const userData={
        email: sanitizedData.email,
        businessName: sanitizedData.businessName,
        password: hashedPassword.hash,
        salt: hashedPassword.salt,
      };

      logSecurityEvent('REGISTRATION_ATTEMPT',{
        email: sanitizedData.email,
        businessName: sanitizedData.businessName
      });

      const newUser=await createUser(userData);

      logSecurityEvent('SUCCESSFUL_REGISTRATION',{
        email: newUser.email,
        businessName: newUser.businessName,
        role: newUser.role
      });

      // Log the user in with their role
      const loginData={
        email: newUser.email,
        businessName: newUser.businessName,
        role: newUser.role
      };

      login(loginData);

      // Navigate based on user role
      if (newUser.role==='admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Registration error:',error);
      setError(error.message || 'Failed to create account. Please try again.');
      logSecurityEvent('REGISTRATION_ERROR',{
        email: sanitizeInput(formData.email),
        error: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange=(e)=> {
    const {name,value}=e.target;

    // Apply input length limits
    let processedValue=value;
    if (name==='businessName' && value.length > 100) return;
    if (name==='email' && value.length > 254) return;
    if (name==='password' && value.length > 128) return;
    if (name==='confirmPassword' && value.length > 128) return;

    setFormData((prev)=> ({
      ...prev,
      [name]: processedValue,
    }));

    // Clear specific validation error when user starts typing
    if (validationErrors[name]) {
      setValidationErrors(prev=> ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handlePasswordChange=(password)=> {
    setFormData(prev=> ({
      ...prev,
      password
    }));

    if (validationErrors.password) {
      setValidationErrors(prev=> ({
        ...prev,
        password: ''
      }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{opacity: 0,y: 20}}
        animate={{opacity: 1,y: 0}}
        className="max-w-md w-full space-y-8"
      >
        <div className="text-center">
          <motion.div
            initial={{opacity: 0,scale: 0.9}}
            animate={{opacity: 1,scale: 1}}
            transition={{duration: 0.5}}
            className="mx-auto w-auto mb-8"
          >
            <h1 className="text-4xl sm:text-5xl font-bold text-white bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
              Trackio
            </h1>
            <p className="text-sm text-gray-400 mt-2">Inventory Management System</p>
          </motion.div>
          <h2 className="text-center text-2xl sm:text-3xl font-extrabold text-white">
            Create your account
          </h2>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <motion.div
              initial={{opacity: 0,y: -10}}
              animate={{opacity: 1,y: 0}}
              className="rounded-md bg-red-900/50 p-4"
            >
              <div className="text-sm text-red-200">{error}</div>
            </motion.div>
          )}

          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="business-name" className="sr-only">
                Business Name
              </label>
              <input
                id="business-name"
                name="businessName"
                type="text"
                required
                maxLength={100}
                className={`appearance-none relative block w-full px-3 py-3 sm:py-2 border ${
                  validationErrors.businessName ? 'border-red-500' : 'border-gray-700'
                } placeholder-gray-400 text-white rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm bg-gray-800`}
                placeholder="Business Name"
                value={formData.businessName}
                onChange={handleChange}
                disabled={isLoading}
              />
              {validationErrors.businessName && (
                <p className="mt-1 text-sm text-red-400">{validationErrors.businessName}</p>
              )}
            </div>

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
                className={`appearance-none relative block w-full px-3 py-3 sm:py-2 border ${
                  validationErrors.email ? 'border-red-500' : 'border-gray-700'
                } placeholder-gray-400 text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm bg-gray-800 rounded-md`}
                placeholder="Email address"
                value={formData.email}
                onChange={handleChange}
                disabled={isLoading}
              />
              {validationErrors.email && (
                <p className="mt-1 text-sm text-red-400">{validationErrors.email}</p>
              )}
            </div>

            <div>
              <PasswordStrengthIndicator
                password={formData.password}
                onPasswordChange={handlePasswordChange}
                placeholder="Password"
              />
              {validationErrors.password && (
                <p className="mt-1 text-sm text-red-400">{validationErrors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirm-password" className="sr-only">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                required
                maxLength={128}
                className={`appearance-none relative block w-full px-3 py-3 sm:py-2 border ${
                  validationErrors.confirmPassword ? 'border-red-500' : 'border-gray-700'
                } placeholder-gray-400 text-white rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm bg-gray-800`}
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={isLoading}
              />
              {validationErrors.confirmPassword && (
                <p className="mt-1 text-sm text-red-400">{validationErrors.confirmPassword}</p>
              )}
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
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </div>

          <div className="text-center">
            <Link to="/login" className="font-medium text-primary-400 hover:text-primary-300">
              Already have an account? Sign in
            </Link>
          </div>
        </form>
      </motion.div>
    </div>
  );
}