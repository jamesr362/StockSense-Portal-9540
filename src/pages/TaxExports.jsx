import {motion} from 'framer-motion';
import {useState,useEffect} from 'react';
import {RiCalculatorLine,RiDownloadLine,RiFileTextLine,RiCalendarLine,RiMoneyDollarCircleLine,RiHistoryLine,RiEyeLine,RiDeleteBin6Line,RiAlertLine,RiLockLine,RiStarLine,RiArrowRightLine,RiRefund2Line,RiReceiptLine,RiInformationLine} from 'react-icons/ri';
import TaxExportModal from '../components/TaxExportModal';
import {getInventoryItems} from '../services/db';
import {useAuth} from '../context/AuthContext';
import useFeatureAccess from '../hooks/useFeatureAccess';
import {Link} from 'react-router-dom';

export default function TaxExports() {
  const [isExportModalOpen,setIsExportModalOpen]=useState(false);
  const [exportHistory,setExportHistory]=useState([]);
  const [inventoryStats,setInventoryStats]=useState(null);
  const [isLoading,setIsLoading]=useState(true);
  const [error,setError]=useState('');
  const [vatRegistered,setVatRegistered]=useState(null); // null = not selected, true = VAT registered, false = not VAT registered
  const {user}=useAuth();
  const {canUseFeature,currentPlan,planInfo}=useFeatureAccess();

  // Check if user has access to tax exports (Professional plan only)
  const hasTaxExportAccess=canUseFeature('taxExports') || currentPlan==='professional';

  useEffect(()=> {
    if (user?.email && hasTaxExportAccess) {
      loadData();
    }
  },[user?.email,hasTaxExportAccess]);

  const loadData=async ()=> {
    try {
      setIsLoading(true);
      setError('');

      // Load inventory data for stats
      const items=await getInventoryItems(user.email);
      const totalPurchaseCost=items.reduce((sum,item)=> {
        // Use VAT-inclusive price from database if available, otherwise use unitPrice
        const itemPrice = item.vatIncluded ? item.unitPrice : (item.unitPrice * (1 + (item.vatPercentage || 20) / 100));
        return sum + (item.quantity * itemPrice);
      }, 0);

      // Calculate benefits based on VAT registration status
      let taxBenefit = 0;
      let benefitType = '';
      let benefitDescription = '';
      
      if (vatRegistered === true) {
        // VAT Registered: Calculate VAT refund
        taxBenefit = items.reduce((sum, item) => {
          const vatPercentage = item.vatPercentage || 20;
          let itemVatRefund = 0;
          
          if (item.vatIncluded) {
            // Price includes VAT - extract VAT amount
            const itemCost = item.quantity * item.unitPrice;
            itemVatRefund = itemCost * (vatPercentage / (100 + vatPercentage));
          } else {
            // Price excludes VAT - calculate VAT that would be added
            const itemCost = item.quantity * item.unitPrice;
            itemVatRefund = itemCost * (vatPercentage / 100);
          }
          
          return sum + itemVatRefund;
        }, 0);
        
        benefitType = 'VAT Refund';
        benefitDescription = 'VAT you can claim back from HMRC through quarterly VAT returns';
      } else if (vatRegistered === false) {
        // Not VAT Registered: Calculate tax relief
        taxBenefit = items.reduce((sum, item) => {
          const vatPercentage = item.vatPercentage || 20;
          let taxReliefAmount = 0;
          
          if (item.vatIncluded) {
            // Can claim tax relief on the VAT portion for business expenses
            const itemCost = item.quantity * item.unitPrice;
            const vatAmount = itemCost * (vatPercentage / (100 + vatPercentage));
            // Tax relief on VAT at corporation tax rate (19% for small companies)
            taxReliefAmount = vatAmount * 0.19;
          }
          
          return sum + taxReliefAmount;
        }, 0);
        
        benefitType = 'Tax Relief';
        benefitDescription = 'Tax relief on business expenses (including VAT portion) through Corporation Tax or Self Assessment';
      }
      
      const netCostValue = totalPurchaseCost - taxBenefit;

      const categoryBreakdown=items.reduce((acc,item)=> {
        const category=item.category || 'Uncategorized';
        if (!acc[category]) {
          acc[category]={items: 0,value: 0,taxBenefit: 0,netCost: 0};
        }
        
        const vatPercentage = item.vatPercentage || 20;
        const itemPrice = item.vatIncluded ? item.unitPrice : (item.unitPrice * (1 + vatPercentage / 100));
        const itemCost = item.quantity * itemPrice;
        let itemTaxBenefit = 0;
        
        if (vatRegistered === true) {
          // VAT refund calculation
          if (item.vatIncluded) {
            itemTaxBenefit = itemCost * (vatPercentage / (100 + vatPercentage));
          } else {
            itemTaxBenefit = (item.quantity * item.unitPrice) * (vatPercentage / 100);
          }
        } else if (vatRegistered === false) {
          // Tax relief calculation
          if (item.vatIncluded) {
            const vatAmount = itemCost * (vatPercentage / (100 + vatPercentage));
            itemTaxBenefit = vatAmount * 0.19;
          }
        }
        
        const itemNetCost = itemCost - itemTaxBenefit;

        acc[category].items++;
        acc[category].value += itemCost;
        acc[category].taxBenefit += itemTaxBenefit;
        acc[category].netCost += itemNetCost;
        return acc;
      },{});

      setInventoryStats({
        totalItems: items.length,
        totalPurchaseCost,
        netCostValue,
        taxBenefit,
        benefitType,
        benefitDescription,
        potentialSavings: taxBenefit,
        categoryBreakdown,
        lastUpdated: new Date().toISOString()
      });

      // Load export history from localStorage
      const stored=localStorage.getItem(`taxExportHistory_${user.email}`);
      if (stored) {
        setExportHistory(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading data:',error);
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  // Recalculate when VAT registration status changes
  useEffect(() => {
    if (vatRegistered !== null && inventoryStats) {
      loadData();
    }
  }, [vatRegistered]);

  const saveExportToHistory=(exportInfo)=> {
    const exportRecord={
      id: Date.now(),
      timestamp: new Date().toISOString(),
      format: exportInfo.format,
      fileName: exportInfo.fileName,
      recordCount: exportInfo.recordCount,
      totalValue: exportInfo.totalValue,
      taxBenefit: exportInfo.taxBenefit,
      benefitType: exportInfo.benefitType,
      dateRange: exportInfo.dateRange,
      settings: exportInfo.settings
    };

    const newHistory=[exportRecord,...exportHistory].slice(0,20);// Keep last 20 exports
    setExportHistory(newHistory);

    try {
      localStorage.setItem(`taxExportHistory_${user.email}`,JSON.stringify(newHistory));
    } catch (error) {
      console.error('Error saving export history:',error);
    }
  };

  const deleteExportRecord=(exportId)=> {
    if (window.confirm('Are you sure you want to delete this export record?')) {
      const newHistory=exportHistory.filter(exp=> exp.id !==exportId);
      setExportHistory(newHistory);
      localStorage.setItem(`taxExportHistory_${user.email}`,JSON.stringify(newHistory));
    }
  };

  const clearHistory=()=> {
    if (window.confirm('Are you sure you want to clear all export history? This action cannot be undone.')) {
      setExportHistory([]);
      localStorage.removeItem(`taxExportHistory_${user.email}`);
    }
  };

  const formatCurrency=(value)=> {
    return `£${(value || 0).toFixed(2)}`;
  };

  const formatDate=(dateString)=> {
    return new Date(dateString).toLocaleDateString('en-GB',{
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFormatIcon=(format)=> {
    switch (format) {
      case 'excel': return <RiFileTextLine className="h-4 w-4 text-green-400" />;
      case 'csv': return <RiFileTextLine className="h-4 w-4 text-blue-400" />;
      case 'pdf': return <RiFileTextLine className="h-4 w-4 text-red-400" />;
      default: return <RiFileTextLine className="h-4 w-4 text-gray-400" />;
    }
  };

  // If user doesn't have access to tax exports,show upgrade prompt
  if (!hasTaxExportAccess) {
    return (
      <div>
        <motion.div
          initial={{opacity: 0,y: 20}}
          animate={{opacity: 1,y: 0}}
          transition={{duration: 0.5}}
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-white">Tax Calculator</h1>
              <p className="mt-1 text-sm text-gray-400">
                Calculate VAT refunds or tax relief from your inventory purchases
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
                Tax calculation features are available exclusively with the Professional plan. Calculate VAT refunds or tax relief from your inventory purchases based on your VAT registration status.
              </p>

              {/* Current Plan Info */}
              <div className="bg-gray-700 rounded-lg p-4 mb-6 max-w-md mx-auto">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400">Current Plan:</span>
                  <span className="text-white font-medium">{planInfo.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Required Plan:</span>
                  <span className="text-primary-400 font-medium">Professional</span>
                </div>
              </div>

              {/* Professional Plan Benefits */}
              <div className="bg-gradient-to-r from-primary-600/20 to-blue-600/20 rounded-lg p-6 mb-8 border border-primary-500/30">
                <div className="flex items-center justify-center mb-4">
                  <RiStarLine className="h-6 w-6 text-yellow-400 mr-2" />
                  <h4 className="text-xl font-semibold text-white">Professional Plan Benefits</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                  <div>
                    <h5 className="text-white font-medium mb-2">Tax Calculation Features:</h5>
                    <ul className="text-gray-300 text-sm space-y-1">
                      <li>• VAT refund calculations for VAT registered businesses</li>
                      <li>• Tax relief calculations for non-VAT registered businesses</li>
                      <li>• Professional tax reports</li>
                      <li>• HMRC-compliant documentation</li>
                      <li>• Multi-format exports (Excel,CSV,PDF)</li>
                      <li>• Export history tracking</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="text-white font-medium mb-2">Additional Features:</h5>
                    <ul className="text-gray-300 text-sm space-y-1">
                      <li>• Unlimited inventory items</li>
                      <li>• Unlimited receipt scans</li>
                      <li>• Unlimited Excel imports</li>
                      <li>• Category-wise breakdowns</li>
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
                  <RiStarLine className="h-5 w-5 mr-2" />
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

          {/* Why Tax Calculations Matter */}
          <div className="mt-8 bg-blue-900/20 border border-blue-700 rounded-lg p-6">
            <div className="flex items-start">
              <RiCalculatorLine className="h-6 w-6 text-blue-400 mr-3 mt-1 flex-shrink-0" />
              <div>
                <h5 className="text-blue-400 font-medium mb-2">Why Calculate Tax Benefits?</h5>
                <ul className="text-blue-300 text-sm space-y-1">
                  <li>• <strong>Maximize Tax Savings:</strong> Claim back VAT or get tax relief on business expenses</li>
                  <li>• <strong>Improve Cash Flow:</strong> Get money back from HMRC or reduce tax liability</li>
                  <li>• <strong>Professional Reports:</strong> Accountant-ready documentation</li>
                  <li>• <strong>Compliance:</strong> Proper records for tax inspections</li>
                  <li>• <strong>Time-Saving:</strong> Automated calculations from your inventory data</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-white">Loading tax calculation data...</span>
      </div>
    );
  }

  return (
    <div>
      <motion.div
        initial={{opacity: 0,y: 20}}
        animate={{opacity: 1,y: 0}}
        transition={{duration: 0.5}}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white">Tax Calculator</h1>
            <p className="mt-1 text-sm text-gray-400">
              Calculate VAT refunds or tax relief from your inventory purchases
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            {exportHistory.length > 0 && (
              <button
                onClick={clearHistory}
                className="inline-flex items-center justify-center rounded-md border border-red-600 bg-transparent px-4 py-2 text-sm font-medium text-red-400 shadow-sm hover:bg-red-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 w-full sm:w-auto transition-colors"
              >
                Clear History
              </button>
            )}
            {vatRegistered !== null && (
              <button
                onClick={()=> setIsExportModalOpen(true)}
                className={`inline-flex items-center justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 w-full sm:w-auto ${
                  vatRegistered 
                    ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' 
                    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                }`}
              >
                {vatRegistered ? (
                  <>
                    <RiRefund2Line className="mr-2 h-4 w-4" />
                    Generate VAT Report
                  </>
                ) : (
                  <>
                    <RiReceiptLine className="mr-2 h-4 w-4" />
                    Generate Tax Relief Report
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Professional Plan Badge */}
        <div className="mb-6 bg-gradient-to-r from-green-600/20 to-primary-600/20 rounded-lg p-4 border border-green-500/30">
          <div className="flex items-center">
            <RiStarLine className="h-5 w-5 text-green-400 mr-2" />
            <div>
              <h3 className="text-green-400 font-medium">Professional Feature Active</h3>
              <p className="text-gray-300 text-sm">Calculate tax benefits from your inventory purchases</p>
            </div>
          </div>
        </div>

        {/* VAT Registration Status Selection */}
        {vatRegistered === null && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Choose Your VAT Status</h2>
            <p className="text-gray-400 text-sm mb-6">
              Select your VAT registration status to see the relevant tax calculations and information for your business.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div
                onClick={()=> setVatRegistered(true)}
                className="p-6 border border-gray-600 rounded-lg cursor-pointer hover:border-green-500 hover:bg-green-500/10 transition-colors group"
              >
                <div className="flex items-center mb-4">
                  <RiRefund2Line className="h-8 w-8 text-green-400 mr-3" />
                  <h3 className="text-xl font-semibold text-white group-hover:text-green-400">VAT Registered</h3>
                </div>
                <p className="text-gray-300 mb-4">
                  Calculate VAT refunds you can claim back from HMRC on your business purchases.
                </p>
                <ul className="text-sm text-gray-400 space-y-2">
                  <li>• Extract VAT from purchase prices</li>
                  <li>• Submit quarterly VAT returns to HMRC</li>
                  <li>• Get full VAT refund on business expenses</li>
                  <li>• Improve business cash flow</li>
                </ul>
                <div className="mt-4 text-green-400 font-medium">
                  Choose this if you're registered for VAT with HMRC →
                </div>
              </div>

              <div
                onClick={()=> setVatRegistered(false)}
                className="p-6 border border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-500/10 transition-colors group"
              >
                <div className="flex items-center mb-4">
                  <RiReceiptLine className="h-8 w-8 text-blue-400 mr-3" />
                  <h3 className="text-xl font-semibold text-white group-hover:text-blue-400">Not VAT Registered</h3>
                </div>
                <p className="text-gray-300 mb-4">
                  Calculate tax relief on business expenses including the VAT portion through Corporation Tax or Self Assessment.
                </p>
                <ul className="text-sm text-gray-400 space-y-2">
                  <li>• Corporation Tax relief on expenses</li>
                  <li>• Include VAT portion in business costs</li>
                  <li>• 19% relief rate for small companies</li>
                  <li>• Consider VAT registration if growing</li>
                </ul>
                <div className="mt-4 text-blue-400 font-medium">
                  Choose this if you're not registered for VAT →
                </div>
              </div>
            </div>

            <div className="mt-6 bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
              <div className="flex items-start">
                <RiInformationLine className="h-5 w-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-yellow-400 font-medium mb-2">Not sure about your VAT status?</h4>
                  <ul className="text-yellow-300 text-sm space-y-1">
                    <li>• <strong>VAT Registered:</strong> You have a VAT number and submit quarterly VAT returns to HMRC</li>
                    <li>• <strong>Not VAT Registered:</strong> Your annual turnover is under £85,000 or you chose not to register</li>
                    <li>• <strong>Voluntary Registration:</strong> You can register for VAT even below the threshold to claim refunds</li>
                    <li>• <strong>Need Help?</strong> Consult your accountant for advice on VAT registration</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Change VAT Status Button */}
        {vatRegistered !== null && (
          <div className="mb-6 flex items-center justify-between bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center">
              {vatRegistered ? (
                <RiRefund2Line className="h-5 w-5 text-green-400 mr-3" />
              ) : (
                <RiReceiptLine className="h-5 w-5 text-blue-400 mr-3" />
              )}
              <div>
                <h3 className={`font-medium ${vatRegistered ? 'text-green-400' : 'text-blue-400'}`}>
                  {vatRegistered ? 'VAT Registered Business' : 'Not VAT Registered'}
                </h3>
                <p className="text-gray-400 text-sm">
                  {vatRegistered 
                    ? 'Calculating VAT refunds from HMRC' 
                    : 'Calculating tax relief on business expenses'
                  }
                </p>
              </div>
            </div>
            <button
              onClick={()=> setVatRegistered(null)}
              className="text-gray-400 hover:text-gray-300 text-sm underline"
            >
              Change Status
            </button>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{opacity: 0,y: -10}}
            animate={{opacity: 1,y: 0}}
            className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg"
          >
            <div className="flex items-center">
              <RiAlertLine className="h-5 w-5 text-red-400 mr-2" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Tax Summary */}
        {inventoryStats && vatRegistered !== null && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <motion.div
              initial={{opacity: 0,y: 20}}
              animate={{opacity: 1,y: 0}}
              transition={{duration: 0.5,delay: 0.1}}
              className="bg-gray-800 overflow-hidden rounded-lg shadow-sm"
            >
              <div className="p-4 sm:p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <RiFileTextLine className="h-6 w-6 sm:h-7 sm:w-7 text-blue-400" />
                  </div>
                  <div className="ml-3 sm:ml-4 w-0 flex-1">
                    <dl>
                      <dt className="text-xs sm:text-sm font-medium text-gray-400 truncate">
                        Total Items
                      </dt>
                      <dd className="flex items-baseline mt-1">
                        <div className="text-xl sm:text-2xl font-semibold text-white">
                          {inventoryStats.totalItems}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{opacity: 0,y: 20}}
              animate={{opacity: 1,y: 0}}
              transition={{duration: 0.5,delay: 0.2}}
              className="bg-gray-800 overflow-hidden rounded-lg shadow-sm"
            >
              <div className="p-4 sm:p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <RiMoneyDollarCircleLine className="h-6 w-6 sm:h-7 sm:w-7 text-yellow-400" />
                  </div>
                  <div className="ml-3 sm:ml-4 w-0 flex-1">
                    <dl>
                      <dt className="text-xs sm:text-sm font-medium text-gray-400 truncate">
                        Total Purchase Cost
                      </dt>
                      <dd className="flex items-baseline mt-1">
                        <div className="text-xl sm:text-2xl font-semibold text-white">
                          {formatCurrency(inventoryStats.totalPurchaseCost)}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{opacity: 0,y: 20}}
              animate={{opacity: 1,y: 0}}
              transition={{duration: 0.5,delay: 0.3}}
              className={`bg-gray-800 overflow-hidden rounded-lg shadow-sm border ${
                vatRegistered ? 'border-green-500/30' : 'border-blue-500/30'
              }`}
            >
              <div className="p-4 sm:p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    {vatRegistered ? (
                      <RiRefund2Line className="h-6 w-6 sm:h-7 sm:w-7 text-green-400" />
                    ) : (
                      <RiReceiptLine className="h-6 w-6 sm:h-7 sm:w-7 text-blue-400" />
                    )}
                  </div>
                  <div className="ml-3 sm:ml-4 w-0 flex-1">
                    <dl>
                      <dt className="text-xs sm:text-sm font-medium text-gray-400 truncate">
                        {inventoryStats.benefitType} Available
                      </dt>
                      <dd className="flex items-baseline mt-1">
                        <div className={`text-xl sm:text-2xl font-semibold ${
                          vatRegistered ? 'text-green-400' : 'text-blue-400'
                        }`}>
                          {formatCurrency(inventoryStats.taxBenefit)}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{opacity: 0,y: 20}}
              animate={{opacity: 1,y: 0}}
              transition={{duration: 0.5,delay: 0.4}}
              className="bg-gray-800 overflow-hidden rounded-lg shadow-sm"
            >
              <div className="p-4 sm:p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <RiCalculatorLine className="h-6 w-6 sm:h-7 sm:w-7 text-primary-400" />
                  </div>
                  <div className="ml-3 sm:ml-4 w-0 flex-1">
                    <dl>
                      <dt className="text-xs sm:text-sm font-medium text-gray-400 truncate">
                        Net Cost After Benefit
                      </dt>
                      <dd className="flex items-baseline mt-1">
                        <div className="text-xl sm:text-2xl font-semibold text-white">
                          {formatCurrency(inventoryStats.netCostValue)}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Status-Specific Information */}
        {vatRegistered !== null && (
          <div className={`${
            vatRegistered ? 'bg-green-900/20 border-green-700' : 'bg-blue-900/20 border-blue-700'
          } border rounded-lg p-6 mb-8`}>
            <div className="flex items-start">
              {vatRegistered ? (
                <RiRefund2Line className="h-6 w-6 text-green-400 mr-3 mt-1 flex-shrink-0" />
              ) : (
                <RiReceiptLine className="h-6 w-6 text-blue-400 mr-3 mt-1 flex-shrink-0" />
              )}
              <div>
                <h5 className={`${
                  vatRegistered ? 'text-green-400' : 'text-blue-400'
                } font-medium mb-2`}>
                  {vatRegistered ? 'VAT Refund Information' : 'Tax Relief Information'}
                </h5>
                <p className={`${
                  vatRegistered ? 'text-green-300' : 'text-blue-300'
                } text-sm mb-3`}>
                  {inventoryStats?.benefitDescription}
                </p>
                <div className={`${
                  vatRegistered ? 'bg-green-800/30' : 'bg-blue-800/30'
                } rounded-lg p-3`}>
                  <h6 className={`${
                    vatRegistered ? 'text-green-300' : 'text-blue-300'
                  } font-medium text-sm mb-1`}>
                    How it works:
                  </h6>
                  <ul className={`${
                    vatRegistered ? 'text-green-300' : 'text-blue-300'
                  } text-xs space-y-1`}>
                    {vatRegistered ? (
                      <>
                        <li>• <strong>Your Purchase Price:</strong> £120.00 (VAT-inclusive)</li>
                        <li>• <strong>VAT Amount You Paid:</strong> £20.00 (that's 20% ÷ 120% × £120)</li>
                        <li>• <strong>Net Cost:</strong> £100.00 (the actual item cost excluding VAT)</li>
                        <li>• <strong>VAT Refund Available:</strong> £20.00 (claimable from HMRC)</li>
                      </>
                    ) : (
                      <>
                        <li>• <strong>Your Purchase Price:</strong> £120.00 (VAT-inclusive)</li>
                        <li>• <strong>VAT Portion:</strong> £20.00 (included in business expenses)</li>
                        <li>• <strong>Tax Relief Rate:</strong> 19% (corporation tax rate)</li>
                        <li>• <strong>Tax Relief Available:</strong> £3.80 (19% of £20.00 VAT)</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* How-to Guide */}
        {vatRegistered !== null && (
          <div className="bg-gray-800 rounded-lg shadow-lg mb-8">
            <div className="px-4 py-5 border-b border-gray-700 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-white">
                {vatRegistered ? 'VAT Refund Guide' : 'Tax Relief Guide'}
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-400">
                {vatRegistered 
                  ? 'How to claim back VAT from your business purchases'
                  : 'How to claim tax relief on your business expenses'
                }
              </p>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {vatRegistered ? (
                  <>
                    <div className="text-center">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-4 mx-auto">
                        <span className="text-lg font-semibold">1</span>
                      </div>
                      <h4 className="text-white font-medium mb-2">VAT Registration</h4>
                      <p className="text-gray-400 text-sm">
                        Register for VAT with HMRC to claim back VAT on business purchases.
                      </p>
                    </div>

                    <div className="text-center">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-4 mx-auto">
                        <span className="text-lg font-semibold">2</span>
                      </div>
                      <h4 className="text-white font-medium mb-2">Track Purchases</h4>
                      <p className="text-gray-400 text-sm">
                        Keep all VAT receipts showing VAT separately for business inventory purchases.
                      </p>
                    </div>

                    <div className="text-center">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 text-purple-600 mb-4 mx-auto">
                        <span className="text-lg font-semibold">3</span>
                      </div>
                      <h4 className="text-white font-medium mb-2">Submit VAT Return</h4>
                      <p className="text-gray-400 text-sm">
                        Use this report with your quarterly VAT return to claim back the VAT.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-4 mx-auto">
                        <span className="text-lg font-semibold">1</span>
                      </div>
                      <h4 className="text-white font-medium mb-2">Keep Records</h4>
                      <p className="text-gray-400 text-sm">
                        Maintain all receipts for legitimate business expenses including VAT.
                      </p>
                    </div>

                    <div className="text-center">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-4 mx-auto">
                        <span className="text-lg font-semibold">2</span>
                      </div>
                      <h4 className="text-white font-medium mb-2">Calculate Relief</h4>
                      <p className="text-gray-400 text-sm">
                        Use this report to calculate tax relief on the VAT portion of expenses.
                      </p>
                    </div>

                    <div className="text-center">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 text-purple-600 mb-4 mx-auto">
                        <span className="text-lg font-semibold">3</span>
                      </div>
                      <h4 className="text-white font-medium mb-2">File Tax Return</h4>
                      <p className="text-gray-400 text-sm">
                        Include business expenses in your Corporation Tax or Self Assessment.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* What's Included */}
        {vatRegistered !== null && (
          <div className="bg-gray-800 rounded-lg shadow-lg mb-8">
            <div className="px-4 py-5 border-b border-gray-700 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-white">
                What's Included in {vatRegistered ? 'VAT' : 'Tax Relief'} Report
              </h3>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-white font-medium mb-3">
                    {vatRegistered ? 'VAT Calculations' : 'Tax Relief Calculations'}
                  </h4>
                  <ul className="text-gray-300 text-sm space-y-2">
                    {vatRegistered ? (
                      <>
                        <li>• VAT amounts extracted from VAT-inclusive prices</li>
                        <li>• VAT refund amounts by category</li>
                        <li>• Net costs excluding VAT</li>
                        <li>• Potential quarterly refund amounts</li>
                        <li>• Individual item VAT breakdowns</li>
                        <li>• Annual VAT refund projections</li>
                      </>
                    ) : (
                      <>
                        <li>• Tax relief on VAT portion of expenses</li>
                        <li>• Corporation tax relief calculations</li>
                        <li>• Business expense categorization</li>
                        <li>• Annual tax relief projections</li>
                        <li>• Individual item relief breakdowns</li>
                        <li>• VAT registration consideration advice</li>
                      </>
                    )}
                  </ul>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-3">Business Documentation</h4>
                  <ul className="text-gray-300 text-sm space-y-2">
                    <li>• Business name and details</li>
                    <li>• Report date and period covered</li>
                    <li>• Purchase price breakdowns</li>
                    <li>• {vatRegistered ? 'HMRC' : 'Tax authority'}-compliant formatting</li>
                    <li>• Audit trail and reference numbers</li>
                    <li>• Accountant guidance notes</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Export History */}
        <div className="bg-gray-800 rounded-lg shadow-lg">
          <div className="px-4 py-5 border-b border-gray-700 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg leading-6 font-medium text-white">Export History</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-400">
                  Your recent tax calculation reports
                </p>
              </div>
              <RiHistoryLine className="h-6 w-6 text-gray-400" />
            </div>
          </div>

          <div className="px-4 py-5 sm:p-6">
            {exportHistory.length===0 ? (
              <div className="text-center py-12">
                <RiCalculatorLine className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No tax reports yet</h3>
                <p className="text-gray-400 text-sm mb-6">
                  {vatRegistered === null 
                    ? 'Choose your VAT status above to start generating tax reports'
                    : `Generate your first ${vatRegistered ? 'VAT refund' : 'tax relief'} report to build your export history`
                  }
                </p>
                {vatRegistered !== null && (
                  <button
                    onClick={()=> setIsExportModalOpen(true)}
                    className={`inline-flex items-center px-4 py-2 text-white rounded-lg ${
                      vatRegistered ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {vatRegistered ? (
                      <>
                        <RiRefund2Line className="mr-2 h-4 w-4" />
                        Generate VAT Report
                      </>
                    ) : (
                      <>
                        <RiReceiptLine className="mr-2 h-4 w-4" />
                        Generate Tax Relief Report
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {exportHistory.map((exportRecord)=> (
                  <motion.div
                    key={exportRecord.id}
                    initial={{opacity: 0,y: 10}}
                    animate={{opacity: 1,y: 0}}
                    className="border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center">
                          {getFormatIcon(exportRecord.format)}
                          <span className="text-white font-medium ml-2">
                            {exportRecord.fileName || `${exportRecord.benefitType} Report ${exportRecord.id}`}
                          </span>
                          <span className="ml-2 text-sm text-gray-400">
                            {formatDate(exportRecord.timestamp)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center space-x-4 text-sm text-gray-400">
                          <span>{exportRecord.recordCount} items</span>
                          <span>Cost: {formatCurrency(exportRecord.totalValue)}</span>
                          <span>{exportRecord.benefitType}: {formatCurrency(exportRecord.taxBenefit)}</span>
                          <span className="capitalize">{exportRecord.format} format</span>
                        </div>
                        {exportRecord.dateRange && (
                          <div className="mt-1 text-xs text-gray-500">
                            Period: {exportRecord.dateRange}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={()=> {
                            const details=`${exportRecord.benefitType} Report Details:

File: ${exportRecord.fileName || `${exportRecord.benefitType} Report`}
Date: ${formatDate(exportRecord.timestamp)}
Format: ${exportRecord.format.toUpperCase()}
Items: ${exportRecord.recordCount}
Total Cost: ${formatCurrency(exportRecord.totalValue)}
${exportRecord.benefitType}: ${formatCurrency(exportRecord.taxBenefit)}
Period: ${exportRecord.dateRange || 'All Time'}

Settings Used:
${exportRecord.settings ? Object.entries(exportRecord.settings).map(([key,value])=> `${key}: ${value}`).join('\n') : 'Standard settings'}`;
                            alert(details);
                          }}
                          className="text-gray-400 hover:text-gray-300 p-1"
                          title="View export details"
                        >
                          <RiEyeLine className="h-4 w-4" />
                        </button>

                        <button
                          onClick={()=> deleteExportRecord(exportRecord.id)}
                          className="text-gray-400 hover:text-red-400 p-1"
                          title="Delete export record"
                        >
                          <RiDeleteBin6Line className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="bg-gray-700 rounded-md p-3">
                      <h4 className="text-sm font-medium text-white mb-2">{exportRecord.benefitType} Summary:</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-gray-400">Items</div>
                          <div className="text-white font-medium">{exportRecord.recordCount}</div>
                        </div>
                        <div>
                          <div className="text-gray-400">Total Cost</div>
                          <div className="text-white font-medium">{formatCurrency(exportRecord.totalValue)}</div>
                        </div>
                        <div>
                          <div className="text-gray-400">{exportRecord.benefitType}</div>
                          <div className={`font-medium ${
                            exportRecord.benefitType === 'VAT Refund' ? 'text-green-400' : 'text-blue-400'
                          }`}>
                            {formatCurrency(exportRecord.taxBenefit)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400">Net Cost</div>
                          <div className="text-white font-medium">{formatCurrency(exportRecord.totalValue - exportRecord.taxBenefit)}</div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Important Information */}
        {vatRegistered !== null && (
          <div className={`mt-8 ${
            vatRegistered ? 'bg-green-900/20 border-green-700' : 'bg-blue-900/20 border-blue-700'
          } border rounded-lg p-6`}>
            <div className="flex items-start">
              <RiAlertLine className={`h-5 w-5 ${
                vatRegistered ? 'text-green-400' : 'text-blue-400'
              } mr-3 mt-0.5 flex-shrink-0`} />
              <div>
                <h5 className={`${
                  vatRegistered ? 'text-green-400' : 'text-blue-400'
                } font-medium mb-2`}>
                  {vatRegistered ? 'VAT Refund Information' : 'Tax Relief Information'}
                </h5>
                <ul className={`${
                  vatRegistered ? 'text-green-300' : 'text-blue-300'
                } text-sm space-y-1`}>
                  {vatRegistered ? (
                    <>
                      <li>• Calculates VAT refunds from VAT-inclusive purchase prices</li>
                      <li>• Only VAT-registered businesses can claim VAT refunds</li>
                      <li>• Submit VAT returns quarterly to HMRC for refunds</li>
                      <li>• Keep all purchase receipts showing VAT separately</li>
                      <li>• Reports are compatible with popular accounting software</li>
                      <li>• Returns due 1 month and 7 days after quarter end</li>
                    </>
                  ) : (
                    <>
                      <li>• Tax relief available on legitimate business expenses</li>
                      <li>• Include VAT portion of purchases in expense claims</li>
                      <li>• Corporation tax relief at 19% (small) or 25% (large companies)</li>
                      <li>• Consider VAT registration if turnover exceeds £85,000</li>
                      <li>• Keep all receipts for tax compliance</li>
                      <li>• Consult your accountant for VAT registration advice</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Tax Export Modal */}
      <TaxExportModal
        isOpen={isExportModalOpen}
        onClose={()=> setIsExportModalOpen(false)}
        onExportComplete={(exportInfo)=> {
          saveExportToHistory(exportInfo);
          setIsExportModalOpen(false);
        }}
      />
    </div>
  );
}