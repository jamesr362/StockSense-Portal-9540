import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RiEyeLine, RiEyeOffLine, RiCheckLine, RiCloseLine } from 'react-icons/ri';
import { validatePassword } from '../utils/security';

export default function PasswordStrengthIndicator({ 
  password, 
  onPasswordChange, 
  showRequirements = true, 
  placeholder = "Password" 
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [validation, setValidation] = useState({
    isValid: false,
    errors: [],
    strength: { score: 0, strength: 'Very Weak', color: 'red' }
  });

  useEffect(() => {
    if (password) {
      setValidation(validatePassword(password));
    } else {
      setValidation({
        isValid: false,
        errors: [],
        strength: { score: 0, strength: 'Very Weak', color: 'red' }
      });
    }
  }, [password]);

  const getStrengthColor = (strength) => {
    switch (strength.color) {
      case 'green': return 'bg-green-500';
      case 'blue': return 'bg-blue-500';
      case 'yellow': return 'bg-yellow-500';
      case 'orange': return 'bg-orange-500';
      default: return 'bg-red-500';
    }
  };

  const getStrengthWidth = (score) => {
    return Math.min((score / 9) * 100, 100);
  };

  const requirements = [
    { test: (pwd) => pwd.length >= 8, text: 'At least 8 characters' },
    { test: (pwd) => /[a-z]/.test(pwd), text: 'One lowercase letter' },
    { test: (pwd) => /[A-Z]/.test(pwd), text: 'One uppercase letter' },
    { test: (pwd) => /[0-9]/.test(pwd), text: 'One number' },
    { test: (pwd) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd), text: 'One special character' }
  ];

  return (
    <div className="space-y-3">
      {/* Password Input */}
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          placeholder={placeholder}
          className="appearance-none relative block w-full px-3 py-3 sm:py-2 pr-10 border border-gray-700 placeholder-gray-400 text-white rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm bg-gray-800"
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-300"
        >
          {showPassword ? (
            <RiEyeOffLine className="h-5 w-5" />
          ) : (
            <RiEyeLine className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Password Strength Indicator */}
      {password && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          {/* Strength Bar */}
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-gray-700 rounded-full h-2">
              <motion.div
                className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor(validation.strength)}`}
                initial={{ width: 0 }}
                animate={{ width: `${getStrengthWidth(validation.strength.score)}%` }}
              />
            </div>
            <span className={`text-sm font-medium ${
              validation.strength.color === 'green' ? 'text-green-400' :
              validation.strength.color === 'blue' ? 'text-blue-400' :
              validation.strength.color === 'yellow' ? 'text-yellow-400' :
              validation.strength.color === 'orange' ? 'text-orange-400' : 
              'text-red-400'
            }`}>
              {validation.strength.strength}
            </span>
          </div>

          {/* Requirements Checklist */}
          {showRequirements && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
              {requirements.map((req, index) => {
                const passed = req.test(password);
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`flex items-center space-x-1 ${passed ? 'text-green-400' : 'text-gray-400'}`}
                  >
                    {passed ? (
                      <RiCheckLine className="h-3 w-3" />
                    ) : (
                      <RiCloseLine className="h-3 w-3" />
                    )}
                    <span>{req.text}</span>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Error Messages */}
          {validation.errors.length > 0 && (
            <div className="text-xs text-red-400 space-y-1">
              {validation.errors.slice(0, 2).map((error, index) => (
                <div key={index} className="flex items-center space-x-1">
                  <RiCloseLine className="h-3 w-3" />
                  <span>{error}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}