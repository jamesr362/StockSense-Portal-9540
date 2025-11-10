import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleMobileMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Sidebar 
        isMobileMenuOpen={isMobileMenuOpen} 
        onMobileMenuClose={handleMobileMenuClose}
      />
      
      {/* Main content area with proper desktop spacing */}
      <div className="lg:pl-72 flex flex-col min-h-screen">
        <Header 
          onMobileMenuToggle={handleMobileMenuToggle}
          isMobileMenuOpen={isMobileMenuOpen}
        />
        
        {/* Main content with consistent padding across all pages */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-full overflow-hidden">
          <div className="max-w-7xl mx-auto h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}