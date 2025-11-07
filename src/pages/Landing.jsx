import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  RiShoppingBag3Line, 
  RiScanLine, 
  RiFileExcelLine, 
  RiCalculatorLine,
  RiCheckLine,
  RiArrowRightLine,
  RiStarLine
} from 'react-icons/ri';

export default function Landing() {
  const features = [
    {
      icon: RiShoppingBag3Line,
      title: 'Purchase Tracking',
      description: 'Easily track all your business purchases with detailed categorization and search functionality.'
    },
    {
      icon: RiScanLine,
      title: 'Receipt Scanning',
      description: 'Scan receipts with your camera and automatically extract purchase details using AI technology.'
    },
    {
      icon: RiFileExcelLine,
      title: 'Excel Import',
      description: 'Import your existing purchase data from Excel files with intelligent column mapping.'
    },
    {
      icon: RiCalculatorLine,
      title: 'VAT Calculations',
      description: 'Automatically calculate VAT refunds and generate tax reports for your business.'
    }
  ];

  const benefits = [
    'Save hours on manual data entry',
    'Never lose a receipt again',
    'Maximize your VAT refunds',
    'Real-time spending insights',
    'Secure cloud storage',
    'Works on any device'
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navigation */}
      <nav className="relative z-10 px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
              Trackio
            </h1>
            <span className="ml-3 text-sm text-gray-400 hidden sm:block">Purchase Management System</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              to="/login"
              className="text-gray-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-md transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold mb-6">
              <span className="bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
                Simple
              </span>
              <br />
              Purchase Management
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Track purchases, scan receipts, and calculate VAT refunds. Everything you need in one simple app.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="inline-flex items-center px-8 py-4 bg-primary-600 hover:bg-primary-700 rounded-lg text-lg font-semibold transition-all transform hover:scale-105"
              >
                Get Started
                <RiArrowRightLine className="ml-2" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center px-8 py-4 border border-gray-600 hover:border-gray-500 rounded-lg text-lg font-semibold transition-colors"
              >
                Sign In
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Floating Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ 
              y: [0, -20, 0],
              rotate: [0, 5, 0]
            }}
            transition={{ 
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute top-20 left-10 w-16 h-16 bg-primary-500/20 rounded-full blur-xl"
          />
          <motion.div
            animate={{ 
              y: [0, 30, 0],
              rotate: [0, -5, 0]
            }}
            transition={{ 
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute top-40 right-20 w-24 h-24 bg-purple-500/20 rounded-full blur-xl"
          />
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 bg-gray-800/50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-5xl font-bold mb-6">
              Everything You Need in
              <span className="bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
                {' '}One Simple App
              </span>
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              No complicated features. No confusing menus. Just the essentials to manage your business purchases effectively.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-gray-800 p-6 rounded-xl hover:bg-gray-750 transition-colors text-center"
              >
                <feature.icon className="text-4xl text-primary-500 mb-4 mx-auto" />
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-gray-300">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Why Choose
                <span className="bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
                  {' '}Trackio?
                </span>
              </h2>
              <p className="text-xl text-gray-300 mb-8">
                Built for simplicity. Designed for results. Everything you need without the complexity.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {benefits.map((benefit, index) => (
                  <motion.div
                    key={benefit}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="flex items-center"
                  >
                    <RiCheckLine className="text-primary-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-300">{benefit}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="space-y-6">
                {/* Free Plan */}
                <div className="bg-gradient-to-br from-gray-700/20 to-gray-600/20 rounded-2xl p-6 backdrop-blur-sm text-center border border-gray-600">
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-white mb-2">Free Plan</h3>
                    <p className="text-gray-300">Get started with essential features</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
                    <ul className="text-left space-y-2 text-gray-300 text-sm">
                      <li className="flex items-center">
                        <RiCheckLine className="text-primary-500 mr-2 flex-shrink-0" />
                        100 purchases
                      </li>
                      <li className="flex items-center">
                        <RiCheckLine className="text-primary-500 mr-2 flex-shrink-0" />
                        1 receipt scan
                      </li>
                      <li className="flex items-center">
                        <RiCheckLine className="text-primary-500 mr-2 flex-shrink-0" />
                        1 Excel import
                      </li>
                    </ul>
                  </div>
                  <Link
                    to="/register"
                    className="inline-flex items-center px-4 py-2 border border-gray-500 hover:border-gray-400 rounded-lg font-semibold transition-colors w-full justify-center text-sm"
                  >
                    Get Started
                  </Link>
                </div>

                {/* Professional Plan */}
                <div className="bg-gradient-to-br from-primary-500/20 to-purple-500/20 rounded-2xl p-6 backdrop-blur-sm text-center border border-primary-500/50">
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-white mb-2">Professional</h3>
                    <p className="text-gray-300">No limits. All features included.</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
                    <div className="text-4xl font-bold text-primary-400 mb-2">£9.99</div>
                    <div className="text-gray-300 text-sm mb-3">/month</div>
                    <ul className="text-left space-y-2 text-gray-300 text-sm">
                      <li className="flex items-center">
                        <RiCheckLine className="text-primary-500 mr-2 flex-shrink-0" />
                        Unlimited purchases
                      </li>
                      <li className="flex items-center">
                        <RiCheckLine className="text-primary-500 mr-2 flex-shrink-0" />
                        Unlimited receipt scans
                      </li>
                      <li className="flex items-center">
                        <RiCheckLine className="text-primary-500 mr-2 flex-shrink-0" />
                        Advanced VAT calculations
                      </li>
                      <li className="flex items-center">
                        <RiCheckLine className="text-primary-500 mr-2 flex-shrink-0" />
                        Unlimited Excel imports
                      </li>
                      <li className="flex items-center">
                        <RiCheckLine className="text-primary-500 mr-2 flex-shrink-0" />
                        All features included
                      </li>
                    </ul>
                  </div>
                  <Link
                    to="/register"
                    className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition-all transform hover:scale-105 w-full justify-center text-sm"
                  >
                    Get Started
                    <RiArrowRightLine className="ml-2" />
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 bg-gray-800/50">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-5xl font-bold mb-6">
              Ready to
              <span className="bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
                {' '}Simplify
              </span>
              <br />
              Your Purchase Management?
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Join businesses using Trackio to streamline their purchase tracking.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="inline-flex items-center px-8 py-4 bg-primary-600 hover:bg-primary-700 rounded-lg text-lg font-semibold transition-all transform hover:scale-105"
              >
                Get Started
                <RiArrowRightLine className="ml-2" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center px-8 py-4 border border-gray-600 hover:border-gray-500 rounded-lg text-lg font-semibold transition-colors"
              >
                Sign In
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}