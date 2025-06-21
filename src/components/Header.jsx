import { RiUser3Line, RiLogoutBoxLine, RiMenuLine, RiCloseLine } from 'react-icons/ri';
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
  };

  return (
    <header className="bg-gray-900 shadow-lg sticky top-0 z-30">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex h-16 items-center justify-between">
          {/* Mobile menu button - Left side */}
          <div className="flex items-center lg:hidden">
            <button
              type="button"
              className="p-2 text-gray-400 hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md"
              onClick={onMobileMenuToggle}
            >
              <span className="sr-only">Toggle navigation menu</span>
              {isMobileMenuOpen ? (
                <RiCloseLine className="h-6 w-6" />
              ) : (
                <RiMenuLine className="h-6 w-6" />
              )}
            </button>
          </div>

          {/* Logo - Perfectly centered */}
          <div className="absolute left-1/2 transform -translate-x-1/2 lg:static lg:left-auto lg:transform-none">
            <h1 className="text-xl sm:text-2xl font-bold text-white">Trackio</h1>
          </div>

          {/* User menu - Right side */}
          <div className="flex items-center ml-auto">
            <div className="relative">
              <button
                type="button"
                className="flex items-center p-2 rounded-full bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              >
                <span className="sr-only">Open user menu</span>
                <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center">
                  <RiUser3Line className="h-5 w-5 text-gray-300" />
                </div>
                {/* Business name - hidden on small screens */}
                <span className="hidden sm:block ml-2 text-sm text-white truncate max-w-32">
                  {user?.businessName}
                </span>
              </button>

              <AnimatePresence>
                {isUserMenuOpen && (
                  <>
                    {/* Mobile backdrop */}
                    <div 
                      className="fixed inset-0 z-10 lg:hidden" 
                      onClick={() => setIsUserMenuOpen(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute right-0 z-20 mt-2 w-64 sm:w-48 origin-top-right rounded-md bg-gray-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5"
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
                        onClick={() => {
                          handleLogout();
                          setIsUserMenuOpen(false);
                        }}
                        className="flex w-full items-center px-4 py-3 text-sm text-white hover:bg-gray-700"
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