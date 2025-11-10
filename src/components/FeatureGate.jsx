import { motion } from 'framer-motion';
import { RiLockLine, RiArrowRightLine } from 'react-icons/ri';
import { Link } from 'react-router-dom';
import useFeatureAccess from '../hooks/useFeatureAccess';

export default function FeatureGate({ 
  feature, 
  children, 
  fallback = null, 
  showUpgradePrompt = true, 
  customMessage = null, 
  requiredPlan = null 
}) {
  const { canUseFeature, currentPlan, planInfo, loading } = useFeatureAccess();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-white">Loading...</span>
      </div>
    );
  }

  const hasAccess = canUseFeature(feature);

  if (hasAccess) {
    return children;
  }

  if (fallback) {
    return fallback;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white">
            {getFeatureTitle(feature)}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {getFeatureSubtitle(feature)}
          </p>
        </div>
      </div>

      {/* Professional Plan Required */}
      <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <RiLockLine className="h-8 w-8 text-gray-400" />
          </div>

          <h3 className="text-2xl font-bold text-white mb-4">
            Professional Feature
          </h3>

          <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
            {customMessage || getFeatureMessage(feature)}
          </p>

          {/* Current Plan Info */}
          <div className="bg-gray-700 rounded-lg p-4 mb-6 max-w-md mx-auto">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400">Current Plan:</span>
              <span className="text-white font-medium">{planInfo.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Required Plan:</span>
              <span className="text-primary-400 font-medium">
                {requiredPlan || getRequiredPlan(feature)}
              </span>
            </div>
          </div>

          {/* Professional Plan Benefits */}
          <div className="bg-gradient-to-r from-primary-600/20 to-blue-600/20 rounded-lg p-6 mb-8 border border-primary-500/30">
            <div className="flex items-center justify-center mb-4">
              <h4 className="text-xl font-semibold text-white">Professional Plan Benefits</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <div>
                <h5 className="text-white font-medium mb-2">{getFeatureIcon(feature)} {getFeatureTitle(feature)}:</h5>
                <ul className="text-gray-300 text-sm space-y-1">
                  {getFeatureBenefits(feature).map((benefit, index) => (
                    <li key={index}>• {benefit}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h5 className="text-white font-medium mb-2">💼 Additional Features:</h5>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Unlimited inventory items</li>
                  <li>• Unlimited receipt scans</li>
                  <li>• Unlimited Excel imports</li>
                  <li>• Professional tax reports</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Upgrade CTA */}
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/pricing"
              className="inline-flex items-center px-8 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-semibold"
            >
              Upgrade to Professional
              <RiArrowRightLine className="h-5 w-5 ml-2" />
            </Link>

            <Link
              to="/dashboard"
              className="inline-flex items-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>

          {/* Pricing Info */}
          <div className="mt-8 pt-8 border-t border-gray-700">
            <p className="text-gray-400 text-sm">
              Professional Plan: <span className="text-white font-semibold">£9.99/month</span> • Cancel anytime
            </p>
            <p className="text-gray-500 text-xs mt-2">
              All features included • No setup fees
            </p>
          </div>
        </div>
      </div>

      {/* Why This Feature Matters */}
      <div className="mt-8 bg-blue-900/20 border border-blue-700 rounded-lg p-6">
        <div className="flex items-start">
          <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mr-3 mt-1">
            <span className="text-blue-100 text-sm font-bold">?</span>
          </div>
          <div>
            <h5 className="text-blue-400 font-medium mb-2">Why {getFeatureTitle(feature)}?</h5>
            <ul className="text-blue-300 text-sm space-y-1">
              {getFeatureWhyPoints(feature).map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function getFeatureTitle(feature) {
  const titles = {
    receiptScanner: 'Receipt Scanner',
    excelImporter: 'Excel Importer',
    taxExports: 'Tax Exports',
    unlimitedItems: 'Unlimited Inventory'
  };
  return titles[feature] || 'Premium Feature';
}

function getFeatureSubtitle(feature) {
  const subtitles = {
    receiptScanner: 'Scan receipts to automatically add items to your inventory',
    excelImporter: 'Import inventory data from Excel, CSV, or ODS files',
    taxExports: 'Generate tax-ready reports for your accountant',
    unlimitedItems: 'Store unlimited inventory items'
  };
  return subtitles[feature] || 'Professional feature';
}

function getFeatureIcon(feature) {
  const icons = {
    receiptScanner: '📱',
    excelImporter: '📊',
    taxExports: '📋',
    unlimitedItems: '📦'
  };
  return icons[feature] || '⭐';
}

function getFeatureMessage(feature) {
  const messages = {
    receiptScanner: 'Receipt scanning allows you to automatically extract items from receipts and add them to your inventory. Free users get 1 scan per month, Professional users get unlimited scans.',
    excelImporter: 'Excel import lets you bulk import inventory data from spreadsheets. Free users get 1 import per month, Professional users get unlimited imports.',
    taxExports: 'Tax export functionality generates professional, accountant-ready reports with comprehensive VAT calculations and business information.',
    unlimitedItems: 'Remove the 100 item limit and store unlimited inventory items with the Professional plan.'
  };
  return messages[feature] || 'This feature is available with the Professional plan.';
}

function getRequiredPlan(feature) {
  const requirements = {
    receiptScanner: 'Professional Plan (for unlimited)',
    excelImporter: 'Professional Plan (for unlimited)',
    taxExports: 'Professional Plan',
    unlimitedItems: 'Professional Plan'
  };
  return requirements[feature] || 'Professional Plan';
}

function getFeatureBenefits(feature) {
  const benefits = {
    receiptScanner: [
      'Unlimited receipt scans',
      'Advanced OCR accuracy',
      'Multi-pass processing',
      'Batch scanning capability'
    ],
    excelImporter: [
      'Unlimited Excel imports',
      'Advanced file processing',
      'Smart column mapping',
      'Bulk data validation'
    ],
    taxExports: [
      'Multi-format exports (Excel, CSV, PDF)',
      'Comprehensive VAT calculations',
      'Category-wise breakdowns',
      'Professional accountant notes',
      'HMRC-compliant reporting',
      'Export history tracking'
    ],
    unlimitedItems: [
      'Store unlimited inventory items',
      'No monthly limits',
      'Full feature access',
      'Priority support'
    ]
  };
  return benefits[feature] || ['Professional features', 'Unlimited usage', 'Priority support'];
}

function getFeatureWhyPoints(feature) {
  const whyPoints = {
    receiptScanner: [
      '• Time-Saving: Automatically extract item data from receipts',
      '• Accuracy: Reduce manual entry errors with OCR technology',
      '• Convenience: Scan receipts on-the-go with your mobile device',
      '• Organization: Keep digital records of all your receipts'
    ],
    excelImporter: [
      '• Efficiency: Import hundreds of items in seconds',
      '• Migration: Easily move from other inventory systems',
      '• Bulk Updates: Update multiple items at once',
      '• Data Integrity: Smart validation prevents import errors'
    ],
    taxExports: [
      '• Time-Saving: Generate complete tax reports in minutes',
      '• Accuracy: Automatic VAT calculations reduce errors',
      '• Professional: Accountant-ready format with audit trail',
      '• Compliance: HMRC-compliant inventory valuations',
      '• Convenience: Multiple formats for different needs'
    ],
    unlimitedItems: [
      '• Scalability: Grow your inventory without limits',
      '• Flexibility: Store as many items as your business needs',
      '• Cost-Effective: No per-item charges or hidden fees',
      '• Future-Proof: Scale with your business growth'
    ]
  };
  return whyPoints[feature] || [
    '• Enhanced functionality for professional use',
    '• Unlimited access to premium features',
    '• Better efficiency and productivity',
    '• Professional support and updates'
  ];
}