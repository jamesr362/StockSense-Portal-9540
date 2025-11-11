import { RiMenuLine, RiCloseLine, RiUser3Line, RiLogoutBoxLine } from 'react-icons/ri';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Header({ onMobileMenuToggle, isMobileMenuOpen }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsUserMenuOpen(false);
  };

  return (
    <header className="bg-gray-800 shadow-lg border-b border-gray-700 flex-shrink-0">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left side - Mobile menu button and logo */}
          <div className="flex items-center">
            {/* Mobile menu button */}
            <button
              type="button"
              className="lg:hidden p-2 text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md transition-colors mr-3"
              onClick={onMobileMenuToggle}
            >
              <span className="sr-only">Toggle navigation menu</span>
              {isMobileMenuOpen ? (
                <RiCloseLine className="h-6 w-6" />
              ) : (
                <RiMenuLine className="h-6 w-6" />
              )}
            </button>

            {/* Logo - Only visible on mobile since desktop has it in sidebar */}
            <div className="lg:hidden">
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
                Trackio
              </h1>
            </div>
          </div>

          {/* Right side - User menu */}
          <div className="flex items-center">
            <div className="relative">
              <button
                type="button"
                className="flex items-center p-2 rounded-full bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors hover:bg-gray-600"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              >
                <span className="sr-only">Open user menu</span>
                <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {user?.businessName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                  </span>
                </div>
                <span className="hidden sm:block ml-2 text-sm text-white truncate max-w-32">
                  {user?.businessName}
                </span>
              </button>

              <AnimatePresence>
                {isUserMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsUserMenuOpen(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute right-0 z-20 mt-2 w-64 sm:w-48 origin-top-right rounded-lg bg-gray-800 py-1 shadow-xl ring-1 ring-black ring-opacity-5 border border-gray-700"
                    >
                      <div className="border-b border-gray-700 px-4 py-3">
                        <div className="text-sm font-medium text-white truncate">
                          {user?.businessName}
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {user?.email}
                        </div>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                      >
                        <RiLogoutBoxLine className="mr-3 h-5 w-5" />
                        Sign out
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}