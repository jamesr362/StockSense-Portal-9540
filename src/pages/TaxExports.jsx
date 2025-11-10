import {motion} from 'framer-motion';
import {useState,useEffect} from 'react';
import {RiCalculatorLine,RiDownloadLine,RiFileTextLine,RiCalendarLine,RiMoneyDollarCircleLine,RiHistoryLine,RiEyeLine,RiDeleteBin6Line,RiAlertLine,RiLockLine,RiStarLine,RiArrowRightLine,RiRefund2Line,RiInformationLine,RiCheckLine} from 'react-icons/ri';
import TaxExportModal from '../components/TaxExportModal';
import {getPurchaseItems} from '../services/db';
import {useAuth} from '../context/AuthContext';
import useFeatureAccess from '../hooks/useFeatureAccess';
import {Link} from 'react-router-dom';

export default function TaxExports() {
  const [isExportModalOpen,setIsExportModalOpen]=useState(false);
  const [exportHistory,setExportHistory]=useState([]);
  const [purchaseStats,setPurchaseStats]=useState(null);
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

      // Load purchase data for stats
      const items=await getPurchaseItems(user.email);
      const totalPurchaseCost=items.reduce((sum,item)=> {
        // Use VAT-inclusive price from database if available, otherwise use unitPrice
        const itemPrice = item.vatIncluded ? item.unitPrice : (item.unitPrice * (1 + (item.vatPercentage || 20) / 100));
        return sum + (item.quantity * itemPrice);
      }, 0);

      // Calculate VAT reclaim if VAT registered
      let vatReclaim = 0;
      let netCostValue = totalPurchaseCost;
      
      if (vatRegistered === true) {
        // VAT Registered: Calculate VAT reclaim
        vatReclaim = items.reduce((sum, item) => {
          const vatPercentage = item.vatPercentage || 20;
          let itemVatReclaim = 0;
          
          if (item.vatIncluded) {
            // Price includes VAT - extract VAT amount
            const itemCost = item.quantity * item.unitPrice;
            itemVatReclaim = itemCost * (vatPercentage / (100 + vatPercentage));
          } else {
            // Price excludes VAT - calculate VAT that would be added
            const itemCost = item.quantity * item.unitPrice;
            itemVatReclaim = itemCost * (vatPercentage / 100);
          }
          
          return sum + itemVatReclaim;
        }, 0);
        
        netCostValue = totalPurchaseCost - vatReclaim;
      }
      
      const categoryBreakdown=items.reduce((acc,item)=> {
        const category=item.category || 'Uncategorized';
        if (!acc[category]) {
          acc[category]={items: 0,value: 0,vatReclaim: 0,netCost: 0};
        }
        
        const vatPercentage = item.vatPercentage || 20;
        const itemPrice = item.vatIncluded ? item.unitPrice : (item.unitPrice * (1 + vatPercentage / 100));
        const itemCost = item.quantity * itemPrice;
        let itemVatReclaim = 0;
        
        if (vatRegistered === true) {
          // VAT reclaim calculation
          if (item.vatIncluded) {
            itemVatReclaim = itemCost * (vatPercentage / (100 + vatPercentage));
          } else {
            itemVatReclaim = (item.quantity * item.unitPrice) * (vatPercentage / 100);
          }
        }
        
        const itemNetCost = itemCost - itemVatReclaim;

        acc[category].items++;
        acc[category].value += itemCost;
        acc[category].vatReclaim += itemVatReclaim;
        acc[category].netCost += itemNetCost;
        return acc;
      },{});

      setPurchaseStats({
        totalItems: items.length,
        totalPurchaseCost,
        netCostValue,
        vatReclaim,
        potentialSavings: vatReclaim,
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
    if (vatRegistered !== null && purchaseStats) {
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
      vatReclaim: exportInfo.vatReclaim,
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
              <h1 className="text-2xl sm:text-3xl font-semibold text-white">VAT Calculator</h1>
              <p className="mt-1 text-sm text-gray-400">
                Calculate VAT reclaims from your purchase tracking data
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
                VAT calculation features are available exclusively with the Professional plan. Calculate VAT reclaims from your purchase tracking data for VAT registered businesses.
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
                    <h5 className="text-white font-medium mb-2">VAT Calculation Features:</h5>
                    <ul className="text-gray-300 text-sm space-y-1">
                      <li>• VAT reclaim calculations for VAT registered businesses</li>
                      <li>• Professional VAT reports</li>
                      <li>• HMRC-compliant documentation</li>
                      <li>• Multi-format exports (Excel,CSV,PDF)</li>
                      <li>• Export history tracking</li>
                      <li>• VAT registration guidance</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="text-white font-medium mb-2">Additional Features:</h5>
                    <ul className="text-gray-300 text-sm space-y-1">
                      <li>• Unlimited purchase tracking</li>
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

          {/* Why VAT Calculations Matter */}
          <div className="mt-8 bg-green-900/20 border border-green-700 rounded-lg p-6">
            <div className="flex items-start">
              <RiRefund2Line className="h-6 w-6 text-green-400 mr-3 mt-1 flex-shrink-0" />
              <div>
                <h5 className="text-green-400 font-medium mb-2">Why Calculate VAT Reclaims?</h5>
                <ul className="text-green-300 text-sm space-y-1">
                  <li>• <strong>Maximize Cash Flow:</strong> Get money back from HMRC through quarterly VAT returns</li>
                  <li>• <strong>Professional Reports:</strong> Accountant-ready documentation for VAT submissions</li>
                  <li>• <strong>Compliance:</strong> Proper records for HMRC inspections</li>
                  <li>• <strong>Time-Saving:</strong> Automated VAT calculations from your purchase tracking data</li>
                  <li>• <strong>Business Growth:</strong> Improve cash flow to reinvest in your business</li>
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
        <span className="ml-2 text-white">Loading VAT calculation data...</span>
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
            <h1 className="text-2xl sm:text-3xl font-semibold text-white">VAT Calculator</h1>
            <p className="mt-1 text-sm text-gray-400">
              Calculate VAT reclaims from your purchase tracking data
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
            {vatRegistered === true && (
              <button
                onClick={()=> setIsExportModalOpen(true)}
                className="inline-flex items-center justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 w-full sm:w-auto bg-green-600 hover:bg-green-700 focus:ring-green-500"
              >
                <RiRefund2Line className="mr-2 h-4 w-4" />
                Generate VAT Report
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
              <p className="text-gray-300 text-sm">Calculate VAT reclaims from your purchase tracking data</p>
            </div>
          </div>
        </div>

        {/* VAT Registration Status Selection */}
        {vatRegistered === null && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Are you VAT registered with HMRC?</h2>
            <p className="text-gray-400 text-sm mb-6">
              Select your VAT registration status to see relevant information for your business.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div
                onClick={()=> setVatRegistered(true)}
                className="p-6 border border-gray-600 rounded-lg cursor-pointer hover:border-green-500 hover:bg-green-500/10 transition-colors group"
              >
                <div className="flex items-center mb-4">
                  <RiCheckLine className="h-8 w-8 text-green-400 mr-3" />
                  <h3 className="text-xl font-semibold text-white group-hover:text-green-400">Yes, VAT Registered</h3>
                </div>
                <p className="text-gray-300 mb-4">
                  I have a VAT number and submit quarterly VAT returns to HMRC. Calculate VAT reclaims I can claim back.
                </p>
                <ul className="text-sm text-gray-400 space-y-2">
                  <li>• Extract VAT from purchase prices</li>
                  <li>• Submit quarterly VAT returns to HMRC</li>
                  <li>• Get full VAT reclaim on business expenses</li>
                  <li>• Improve business cash flow</li>
                </ul>
                <div className="mt-4 text-green-400 font-medium">
                  Generate VAT reclaim reports →
                </div>
              </div>

              <div
                onClick={()=> setVatRegistered(false)}
                className="p-6 border border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-500/10 transition-colors group"
              >
                <div className="flex items-center mb-4">
                  <RiInformationLine className="h-8 w-8 text-blue-400 mr-3" />
                  <h3 className="text-xl font-semibold text-white group-hover:text-blue-400">No, Not VAT Registered</h3>
                </div>
                <p className="text-gray-300 mb-4">
                  I'm not registered for VAT with HMRC. Show me information about VAT registration and its benefits.
                </p>
                <ul className="text-sm text-gray-400 space-y-2">
                  <li>• Learn about VAT registration requirements</li>
                  <li>• Understand VAT registration benefits</li>
                  <li>• See potential VAT reclaims if registered</li>
                  <li>• Get guidance on when to register</li>
                </ul>
                <div className="mt-4 text-blue-400 font-medium">
                  Learn about VAT registration →
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
                    <li>• <strong>Mandatory Registration:</strong> Must register if turnover exceeds £85,000 in 12 months</li>
                    <li>• <strong>Voluntary Registration:</strong> Can register below threshold to claim VAT reclaims</li>
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
                <RiCheckLine className="h-5 w-5 text-green-400 mr-3" />
              ) : (
                <RiInformationLine className="h-5 w-5 text-blue-400 mr-3" />
              )}
              <div>
                <h3 className={`font-medium ${vatRegistered ? 'text-green-400' : 'text-blue-400'}`}>
                  {vatRegistered ? 'VAT Registered Business' : 'Not VAT Registered'}
                </h3>
                <p className="text-gray-400 text-sm">
                  {vatRegistered 
                    ? 'Generate VAT reclaim reports for HMRC submissions' 
                    : 'Learn about VAT registration benefits'
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

        {/* VAT Summary for VAT Registered */}
        {purchaseStats && vatRegistered === true && (
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
                        Total Purchases
                      </dt>
                      <dd className="flex items-baseline mt-1">
                        <div className="text-xl sm:text-2xl font-semibold text-white">
                          {purchaseStats.totalItems}
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
                          {formatCurrency(purchaseStats.totalPurchaseCost)}
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
              className="bg-gray-800 overflow-hidden rounded-lg shadow-sm border border-green-500/30"
            >
              <div className="p-4 sm:p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <RiRefund2Line className="h-6 w-6 sm:h-7 sm:w-7 text-green-400" />
                  </div>
                  <div className="ml-3 sm:ml-4 w-0 flex-1">
                    <dl>
                      <dt className="text-xs sm:text-sm font-medium text-gray-400 truncate">
                        VAT Reclaim Available
                      </dt>
                      <dd className="flex items-baseline mt-1">
                        <div className="text-xl sm:text-2xl font-semibold text-green-400">
                          {formatCurrency(purchaseStats.vatReclaim)}
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
                        Net Cost After VAT
                      </dt>
                      <dd className="flex items-baseline mt-1">
                        <div className="text-xl sm:text-2xl font-semibold text-white">
                          {formatCurrency(purchaseStats.netCostValue)}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* VAT Registration Information for Non-VAT Registered */}
        {vatRegistered === false && (
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-6 mb-8">
            <div className="flex items-start">
              <RiInformationLine className="h-6 w-6 text-blue-400 mr-3 mt-1 flex-shrink-0" />
              <div>
                <h5 className="text-blue-400 font-medium mb-3">VAT Registration Information</h5>
                <p className="text-blue-300 text-sm mb-4">
                  Since you're not VAT registered, you cannot claim VAT reclaims. However, VAT registration could provide significant benefits for your business.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-blue-800/30 rounded-lg p-4">
                    <h6 className="text-blue-300 font-medium text-sm mb-2">VAT Registration Requirements:</h6>
                    <ul className="text-blue-300 text-xs space-y-1">
                      <li>• <strong>Mandatory:</strong> Annual turnover exceeds £85,000</li>
                      <li>• <strong>Voluntary:</strong> Can register below threshold</li>
                      <li>• <strong>Registration:</strong> Apply online through HMRC</li>
                      <li>• <strong>Timeline:</strong> Usually takes 2-6 weeks</li>
                    </ul>
                  </div>
                  
                  <div className="bg-green-800/30 rounded-lg p-4">
                    <h6 className="text-green-300 font-medium text-sm mb-2">Benefits of VAT Registration:</h6>
                    <ul className="text-green-300 text-xs space-y-1">
                      <li>• <strong>VAT Reclaims:</strong> Claim back VAT on business purchases</li>
                      <li>• <strong>Cash Flow:</strong> Improve business cash flow significantly</li>
                      <li>• <strong>Credibility:</strong> Enhanced business credibility</li>
                      <li>• <strong>B2B Sales:</strong> Easier to sell to other VAT registered businesses</li>
                    </ul>
                  </div>
                </div>

                {purchaseStats && (
                  <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 mb-4">
                    <h6 className="text-green-400 font-medium mb-2">Potential VAT Reclaim if You Were Registered:</h6>
                    <div className="text-2xl font-bold text-green-400 mb-2">
                      {formatCurrency(purchaseStats.totalPurchaseCost * 0.167)} {/* Approximate 20% VAT extraction */}
                    </div>
                    <p className="text-green-300 text-sm">
                      This is an estimate of VAT you could claim back annually if you were VAT registered, based on your current purchase tracking data.
                    </p>
                  </div>
                )}

                <div className="bg-yellow-800/30 rounded-lg p-4">
                  <h6 className="text-yellow-300 font-medium text-sm mb-2">Next Steps:</h6>
                  <ul className="text-yellow-300 text-xs space-y-1">
                    <li>• <strong>Consult Accountant:</strong> Get professional advice on VAT registration</li>
                    <li>• <strong>Calculate Benefits:</strong> Compare potential reclaims vs. additional admin</li>
                    <li>• <strong>Register Online:</strong> Apply through HMRC's online portal</li>
                    <li>• <strong>Set Up Systems:</strong> Prepare for quarterly VAT returns</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VAT Reclaim Information for VAT Registered */}
        {vatRegistered === true && (
          <div className="bg-green-900/20 border border-green-700 rounded-lg p-6 mb-8">
            <div className="flex items-start">
              <RiRefund2Line className="h-6 w-6 text-green-400 mr-3 mt-1 flex-shrink-0" />
              <div>
                <h5 className="text-green-400 font-medium mb-2">VAT Reclaim Information</h5>
                <p className="text-green-300 text-sm mb-3">
                  VAT you can claim back from HMRC through quarterly VAT returns
                </p>
                <div className="bg-green-800/30 rounded-lg p-3">
                  <h6 className="text-green-300 font-medium text-sm mb-1">
                    How VAT reclaims work:
                  </h6>
                  <ul className="text-green-300 text-xs space-y-1">
                    <li>• <strong>Your Purchase Price:</strong> £120.00 (VAT-inclusive)</li>
                    <li>• <strong>VAT Amount You Paid:</strong> £20.00 (that's 20% ÷ 120% × £120)</li>
                    <li>• <strong>Net Cost:</strong> £100.00 (the actual item cost excluding VAT)</li>
                    <li>• <strong>VAT Reclaim Available:</strong> £20.00 (claimable from HMRC)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* How-to Guide for VAT Registered */}
        {vatRegistered === true && (
          <div className="bg-gray-800 rounded-lg shadow-lg mb-8">
            <div className="px-4 py-5 border-b border-gray-700 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-white">
                VAT Reclaim Guide
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-400">
                How to claim back VAT from your business purchases
              </p>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-4 mx-auto">
                    <span className="text-lg font-semibold">1</span>
                  </div>
                  <h4 className="text-white font-medium mb-2">Track Purchases</h4>
                  <p className="text-gray-400 text-sm">
                    Keep all VAT receipts showing VAT separately for business purchases.
                  </p>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-4 mx-auto">
                    <span className="text-lg font-semibold">2</span>
                  </div>
                  <h4 className="text-white font-medium mb-2">Generate Reports</h4>
                  <p className="text-gray-400 text-sm">
                    Use this tool to generate VAT reclaim reports for your quarterly submissions.
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
              </div>
            </div>
          </div>
        )}

        {/* What's Included for VAT Registered */}
        {vatRegistered === true && (
          <div className="bg-gray-800 rounded-lg shadow-lg mb-8">
            <div className="px-4 py-5 border-b border-gray-700 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-white">
                What's Included in VAT Report
              </h3>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-white font-medium mb-3">VAT Calculations</h4>
                  <ul className="text-gray-300 text-sm space-y-2">
                    <li>• VAT amounts extracted from VAT-inclusive prices</li>
                    <li>• VAT reclaim amounts by category</li>
                    <li>• Net costs excluding VAT</li>
                    <li>• Potential quarterly reclaim amounts</li>
                    <li>• Individual purchase VAT breakdowns</li>
                    <li>• Annual VAT reclaim projections</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-3">Business Documentation</h4>
                  <ul className="text-gray-300 text-sm space-y-2">
                    <li>• Business name and details</li>
                    <li>• Report date and period covered</li>
                    <li>• Purchase price breakdowns</li>
                    <li>• HMRC-compliant formatting</li>
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
                  Your recent VAT calculation reports
                </p>
              </div>
              <RiHistoryLine className="h-6 w-6 text-gray-400" />
            </div>
          </div>

          <div className="px-4 py-5 sm:p-6">
            {exportHistory.length===0 ? (
              <div className="text-center py-12">
                <RiCalculatorLine className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No VAT reports yet</h3>
                <p className="text-gray-400 text-sm mb-6">
                  {vatRegistered === null 
                    ? 'Choose your VAT registration status above to start generating reports'
                    : vatRegistered === true
                      ? 'Generate your first VAT reclaim report to build your export history'
                      : 'VAT reports are only available for VAT registered businesses'
                  }
                </p>
                {vatRegistered === true && (
                  <button
                    onClick={()=> setIsExportModalOpen(true)}
                    className="inline-flex items-center px-4 py-2 text-white rounded-lg bg-green-600 hover:bg-green-700"
                  >
                    <RiRefund2Line className="mr-2 h-4 w-4" />
                    Generate VAT Report
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
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-2">
                          {getFormatIcon(exportRecord.format)}
                          <span className="text-white font-medium truncate">
                            {exportRecord.fileName || `VAT Reclaim Report ${exportRecord.id}`}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400 mb-2">
                          <span className="block sm:inline">{formatDate(exportRecord.timestamp)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-400">
                          <span className="whitespace-nowrap">{exportRecord.recordCount} purchases</span>
                          <span className="whitespace-nowrap">Cost: {formatCurrency(exportRecord.totalValue)}</span>
                          <span className="whitespace-nowrap">VAT Reclaim: {formatCurrency(exportRecord.vatReclaim)}</span>
                          <span className="whitespace-nowrap capitalize">{exportRecord.format} format</span>
                        </div>
                        {exportRecord.dateRange && (
                          <div className="mt-1 text-xs text-gray-500">
                            <span className="whitespace-nowrap">Period: {exportRecord.dateRange}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 mt-3 lg:mt-0 lg:ml-4 flex-shrink-0">
                        <button
                          onClick={()=> {
                            const details=`VAT Reclaim Report Details:

File: ${exportRecord.fileName || 'VAT Reclaim Report'}
Date: ${formatDate(exportRecord.timestamp)}
Format: ${exportRecord.format.toUpperCase()}
Purchases: ${exportRecord.recordCount}
Total Cost: ${formatCurrency(exportRecord.totalValue)}
VAT Reclaim: ${formatCurrency(exportRecord.vatReclaim)}
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
                      <h4 className="text-sm font-medium text-white mb-2">VAT Reclaim Summary:</h4>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-gray-400 text-xs">Purchases</div>
                          <div className="text-white font-medium">{exportRecord.recordCount}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs">Total Cost</div>
                          <div className="text-white font-medium break-all">{formatCurrency(exportRecord.totalValue)}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs">VAT Reclaim</div>
                          <div className="font-medium text-green-400 break-all">
                            {formatCurrency(exportRecord.vatReclaim)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs">Net Cost</div>
                          <div className="text-white font-medium break-all">{formatCurrency(exportRecord.totalValue - exportRecord.vatReclaim)}</div>
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
        {vatRegistered === true && (
          <div className="mt-8 bg-green-900/20 border-green-700 border rounded-lg p-6">
            <div className="flex items-start">
              <RiAlertLine className="h-5 w-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h5 className="text-green-400 font-medium mb-2">
                  VAT Reclaim Information
                </h5>
                <ul className="text-green-300 text-sm space-y-1">
                  <li>• Calculates VAT reclaims from VAT-inclusive purchase prices</li>
                  <li>• Only VAT-registered businesses can claim VAT reclaims</li>
                  <li>• Submit VAT returns quarterly to HMRC for reclaims</li>
                  <li>• Keep all purchase receipts showing VAT separately</li>
                  <li>• Reports are compatible with popular accounting software</li>
                  <li>• Returns due 1 month and 7 days after quarter end</li>
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