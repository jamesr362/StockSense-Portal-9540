import {motion} from 'framer-motion';
import {useState,useEffect} from 'react';
import {RiCalculatorLine,RiDownloadLine,RiFileTextLine,RiCalendarLine,RiMoneyDollarCircleLine,RiHistoryLine,RiEyeLine,RiDeleteBin6Line,RiAlertLine,RiLockLine,RiStarLine,RiArrowRightLine} from 'react-icons/ri';
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
const totalValue=items.reduce((sum,item)=> sum + (item.quantity * item.unitPrice),0);
const vatAmount=totalValue * 0.2;// 20% VAT
const totalWithVAT=totalValue + vatAmount;

const categoryBreakdown=items.reduce((acc,item)=> {
const category=item.category || 'Uncategorized';
if (!acc[category]) {
acc[category]={items: 0,value: 0};
}
acc[category].items++;
acc[category].value +=item.quantity * item.unitPrice;
return acc;
},{});

setInventoryStats({
totalItems: items.length,
totalValue,
vatAmount,
totalWithVAT,
categoryBreakdown,
lastUpdated: new Date().toISOString()
});

// Loadexport history from localStorage
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

const saveExportToHistory=(exportInfo)=> {
const exportRecord={
id: Date.now(),
timestamp: new Date().toISOString(),
format: exportInfo.format,
fileName: exportInfo.fileName,
recordCount: exportInfo.recordCount,
totalValue: exportInfo.totalValue,
vatAmount: exportInfo.vatAmount,
dateRange: exportInfo.dateRange,
settings: exportInfo.settings
};

const newHistory=[exportRecord,...exportHistory].slice(0,20);// Keep last 20 exports
setExportHistory(newHistory);

try {
localStorage.setItem(`taxExportHistory_${user.email}`,JSON.stringify(newHistory));
} catch (error) {
console.error('Error savingexport history:',error);
}
};

const deleteExportRecord=(exportId)=> {
if (window.confirm('Are you sure you want to delete thisexport record?')) {
const newHistory=exportHistory.filter(exp=> exp.id !==exportId);
setExportHistory(newHistory);
localStorage.setItem(`taxExportHistory_${user.email}`,JSON.stringify(newHistory));
}
};

const clearHistory=()=> {
if (window.confirm('Are you sure you want to clear allexport history? This action cannot be undone.')) {
setExportHistory([]);
localStorage.removeItem(`taxExportHistory_${user.email}`);
}
};

const formatCurrency=(value)=> {
return new Intl.NumberFormat('en-GB',{
style: 'currency',
currency: 'GBP',
minimumFractionDigits: 2,
maximumFractionDigits: 2
}).format(value || 0);
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
<h1 className="text-2xl sm:text-3xl font-semibold text-white">Tax Exports</h1>
<p className="mt-1 text-sm text-gray-400">
Generate tax-ready reports for your accountant
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
Taxexport functionality is available exclusively with the Professional plan. Generate comprehensive,accountant-ready reports with detailed VAT calculations,category breakdowns,and professional formatting.
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
<h5 className="text-white font-medium mb-2">📊 Tax Export Features:</h5>
<ul className="text-gray-300 text-sm space-y-1">
<li>• Multi-format exports (Excel,CSV,PDF)</li>
<li>• Comprehensive VAT calculations</li>
<li>• Category-wise breakdowns</li>
<li>• Professional accountant notes</li>
<li>• HMRC-compliant reporting</li>
<li>• Export history tracking</li>
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

{/* Why Tax Exports Matter */}
<div className="mt-8 bg-blue-900/20 border border-blue-700 rounded-lg p-6">
<div className="flex items-start">
<RiCalculatorLine className="h-6 w-6 text-blue-400 mr-3 mt-1 flex-shrink-0" />
<div>
<h5 className="text-blue-400 font-medium mb-2">Why Professional Tax Exports?</h5>
<ul className="text-blue-300 text-sm space-y-1">
<li>• <strong>Time-Saving:</strong> Generate complete tax reports in minutes</li>
<li>• <strong>Accuracy:</strong> Automatic VAT calculations reduce errors</li>
<li>• <strong>Professional:</strong> Accountant-ready format with audit trail</li>
<li>• <strong>Compliance:</strong> HMRC-compliant inventory valuations</li>
<li>• <strong>Convenience:</strong> Multiple formats for different needs</li>
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
<span className="ml-2 text-white">Loading taxexport data...</span>
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
<h1 className="text-2xl sm:text-3xl font-semibold text-white">Tax Exports</h1>
<p className="mt-1 text-sm text-gray-400">
Generate tax-ready reports for your accountant
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
<button
onClick={()=> setIsExportModalOpen(true)}
className="inline-flex items-center justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 w-full sm:w-auto"
>
<RiCalculatorLine className="mr-2 h-4 w-4" />
Generate Tax Export
</button>
</div>
</div>

{/* Professional Plan Badge */}
<div className="mb-6 bg-gradient-to-r from-green-600/20 to-primary-600/20 rounded-lg p-4 border border-green-500/30">
<div className="flex items-center">
<RiStarLine className="h-5 w-5 text-green-400 mr-2" />
<div>
<h3 className="text-green-400 font-medium">Professional Feature Active</h3>
<p className="text-gray-300 text-sm">You have access to comprehensive taxexport functionality</p>
</div>
</div>
</div>

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

{/* Current Tax Summary */}
{inventoryStats && (
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
<RiMoneyDollarCircleLine className="h-6 w-6 sm:h-7 sm:w-7 text-green-400" />
</div>
<div className="ml-3 sm:ml-4 w-0 flex-1">
<dl>
<dt className="text-xs sm:text-sm font-medium text-gray-400 truncate">
Value (Excl. VAT)
</dt>
<dd className="flex items-baseline mt-1">
<div className="text-xl sm:text-2xl font-semibold text-white">
{formatCurrency(inventoryStats.totalValue)}
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
className="bg-gray-800 overflow-hidden rounded-lg shadow-sm"
>
<div className="p-4 sm:p-5">
<div className="flex items-center">
<div className="flex-shrink-0">
<RiCalculatorLine className="h-6 w-6 sm:h-7 sm:w-7 text-yellow-400" />
</div>
<div className="ml-3 sm:ml-4 w-0 flex-1">
<dl>
<dt className="text-xs sm:text-sm font-medium text-gray-400 truncate">
VAT Amount (20%)
</dt>
<dd className="flex items-baseline mt-1">
<div className="text-xl sm:text-2xl font-semibold text-white">
{formatCurrency(inventoryStats.vatAmount)}
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
<RiMoneyDollarCircleLine className="h-6 w-6 sm:h-7 sm:w-7 text-primary-400" />
</div>
<div className="ml-3 sm:ml-4 w-0 flex-1">
<dl>
<dt className="text-xs sm:text-sm font-medium text-gray-400 truncate">
Total (Incl. VAT)
</dt>
<dd className="flex items-baseline mt-1">
<div className="text-xl sm:text-2xl font-semibold text-white">
{formatCurrency(inventoryStats.totalWithVAT)}
</div>
</dd>
</dl>
</div>
</div>
</div>
</motion.div>
</div>
)}

{/* Quick Export Guide */}
<div className="bg-gray-800 rounded-lg shadow-lg mb-8">
<div className="px-4 py-5 border-b border-gray-700 sm:px-6">
<h3 className="text-lg leading-6 font-medium text-white">Tax Export Guide</h3>
<p className="mt-1 max-w-2xl text-sm text-gray-400">
Essential information for generating accountant-ready reports
</p>
</div>
<div className="px-4 py-5 sm:p-6">
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
<div className="text-center">
<div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-4 mx-auto">
<span className="text-lg font-semibold">1</span>
</div>
<h4 className="text-white font-medium mb-2">Select Period</h4>
<p className="text-gray-400 text-sm">
Choose your tax year or custom date range for accurate reporting.
</p>
</div>

<div className="text-center">
<div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-4 mx-auto">
<span className="text-lg font-semibold">2</span>
</div>
<h4 className="text-white font-medium mb-2">Configure Options</h4>
<p className="text-gray-400 text-sm">
Set VAT rates,include/exclude items,and choose report format.
</p>
</div>

<div className="text-center">
<div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 text-purple-600 mb-4 mx-auto">
<span className="text-lg font-semibold">3</span>
</div>
<h4 className="text-white font-medium mb-2">Send to Accountant</h4>
<p className="text-gray-400 text-sm">
Export generates a professional report ready for tax submission.
</p>
</div>
</div>
</div>
</div>

{/* What's Included */}
<div className="bg-gray-800 rounded-lg shadow-lg mb-8">
<div className="px-4 py-5 border-b border-gray-700 sm:px-6">
<h3 className="text-lg leading-6 font-medium text-white">What's Included in Tax Export</h3>
</div>
<div className="px-4 py-5 sm:p-6">
<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
<div>
<h4 className="text-white font-medium mb-3">📊 Financial Data</h4>
<ul className="text-gray-300 text-sm space-y-2">
<li>• Complete inventory valuation</li>
<li>• VAT calculations at current rates</li>
<li>• Category-wise breakdowns</li>
<li>• Total stock value with/without VAT</li>
<li>• Individual item costs and totals</li>
<li>• Stock turnover calculations</li>
</ul>
</div>
<div>
<h4 className="text-white font-medium mb-3">📋 Business Information</h4>
<ul className="text-gray-300 text-sm space-y-2">
<li>• Business name and contact details</li>
<li>• Export date and time</li>
<li>• Reporting period specified</li>
<li>• Inventory methodology notes</li>
<li>• System audit trail</li>
<li>• Accountant guidance notes</li>
</ul>
</div>
</div>
</div>
</div>

{/* Export History */}
<div className="bg-gray-800 rounded-lg shadow-lg">
<div className="px-4 py-5 border-b border-gray-700 sm:px-6">
<div className="flex items-center justify-between">
<div>
<h3 className="text-lg leading-6 font-medium text-white">Export History</h3>
<p className="mt-1 max-w-2xl text-sm text-gray-400">
Your recent taxexport downloads
</p>
</div>
<RiHistoryLine className="h-6 w-6 text-gray-400" />
</div>
</div>

<div className="px-4 py-5 sm:p-6">
{exportHistory.length===0 ? (
<div className="text-center py-12">
<RiCalculatorLine className="mx-auto h-12 w-12 text-gray-500 mb-4" />
<h3 className="text-lg font-medium text-white mb-2">No tax exports yet</h3>
<p className="text-gray-400 text-sm mb-6">
Generate your first taxexport to build yourexport history
</p>
<button
onClick={()=> setIsExportModalOpen(true)}
className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
>
<RiCalculatorLine className="mr-2 h-4 w-4" />
Generate Tax Export
</button>
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
{exportRecord.fileName || `Tax Export ${exportRecord.id}`}
</span>
<span className="ml-2 text-sm text-gray-400">
{formatDate(exportRecord.timestamp)}
</span>
</div>
<div className="mt-1 flex items-center space-x-4 text-sm text-gray-400">
<span>{exportRecord.recordCount} items</span>
<span>Value: {formatCurrency(exportRecord.totalValue)}</span>
<span>VAT: {formatCurrency(exportRecord.vatAmount)}</span>
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
const details=`Tax Export Details:

File: ${exportRecord.fileName || 'Tax Export'}
Date: ${formatDate(exportRecord.timestamp)}
Format: ${exportRecord.format.toUpperCase()}
Items: ${exportRecord.recordCount}
Total Value: ${formatCurrency(exportRecord.totalValue)}
VAT Amount: ${formatCurrency(exportRecord.vatAmount)}
Period: ${exportRecord.dateRange || 'All Time'}

Settings Used:
${exportRecord.settings ? Object.entries(exportRecord.settings).map(([key,value])=> `${key}: ${value}`).join('\n') : 'Standard settings'}`;
alert(details);
}}
className="text-gray-400 hover:text-gray-300 p-1"
title="Viewexport details"
>
<RiEyeLine className="h-4 w-4" />
</button>

<button
onClick={()=> deleteExportRecord(exportRecord.id)}
className="text-gray-400 hover:text-red-400 p-1"
title="Deleteexport record"
>
<RiDeleteBin6Line className="h-4 w-4" />
</button>
</div>
</div>

<div className="bg-gray-700 rounded-md p-3">
<h4 className="text-sm font-medium text-white mb-2">Export Summary:</h4>
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
<div>
<div className="text-gray-400">Items</div>
<div className="text-white font-medium">{exportRecord.recordCount}</div>
</div>
<div>
<div className="text-gray-400">Net Value</div>
<div className="text-white font-medium">{formatCurrency(exportRecord.totalValue)}</div>
</div>
<div>
<div className="text-gray-400">VAT</div>
<div className="text-white font-medium">{formatCurrency(exportRecord.vatAmount)}</div>
</div>
<div>
<div className="text-gray-400">Total</div>
<div className="text-white font-medium">{formatCurrency(exportRecord.totalValue + exportRecord.vatAmount)}</div>
</div>
</div>
</div>
</motion.div>
))}
</div>
)}
</div>
</div>

{/* Tax Information */}
<div className="bg-blue-900/20 border border-blue-700 rounded-lg p-6">
<div className="flex items-start">
<RiAlertLine className="h-5 w-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
<div>
<h5 className="text-blue-400 font-medium mb-2">Tax Compliance Information</h5>
<ul className="text-blue-300 text-sm space-y-1">
<li>• Reports include all necessary information for UK tax submissions</li>
<li>• VAT calculations use current HMRC rates (verify with your accountant)</li>
<li>• Inventory valuations follow FIFO (First In,First Out) methodology</li>
<li>• All exports include detailed audit trail and business information</li>
<li>• Reports are compatible with popular accounting software</li>
<li>• Keepexport records for HMRC compliance and audit purposes</li>
</ul>
</div>
</div>
</div>
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