import {motion} from 'framer-motion';
import {useState,useEffect} from 'react';
import {RiCalculatorLine,RiDownloadLine,RiFileTextLine,RiCalendarLine,RiMoneyDollarCircleLine,RiHistoryLine,RiEyeLine,RiDeleteBin6Line,RiAlertLine,RiLockLine,RiStarLine,RiArrowRightLine,RiRefund2Line} from 'react-icons/ri';
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
const totalPurchaseCost=items.reduce((sum,item)=> sum + (item.quantity * item.unitPrice),0);

// Calculate VAT refund from VAT-inclusive prices (most common for purchases)
// Formula: VAT Amount = (VAT-inclusive price × VAT rate) ÷ (100 + VAT rate)
const vatRate = 20; // UK standard VAT rate
const vatRefundAmount = totalPurchaseCost * (vatRate / (100 + vatRate));
const netCostValue = totalPurchaseCost - vatRefundAmount; // Net cost excluding VAT

const categoryBreakdown=items.reduce((acc,item)=> {
const category=item.category || 'Uncategorized';
if (!acc[category]) {
acc[category]={items: 0,value: 0,vatRefund: 0,netCost: 0};
}
const itemTotalCost = item.quantity * item.unitPrice;
const itemVatRefund = itemTotalCost * (vatRate / (100 + vatRate));
const itemNetCost = itemTotalCost - itemVatRefund;

acc[category].items++;
acc[category].value += itemTotalCost;
acc[category].vatRefund += itemVatRefund;
acc[category].netCost += itemNetCost;
return acc;
},{});

setInventoryStats({
totalItems: items.length,
totalPurchaseCost,
netCostValue,
vatRefundAmount,
potentialSavings: vatRefundAmount,
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

const saveExportToHistory=(exportInfo)=> {
const exportRecord={
id: Date.now(),
timestamp: new Date().toISOString(),
format: exportInfo.format,
fileName: exportInfo.fileName,
recordCount: exportInfo.recordCount,
totalValue: exportInfo.totalValue,
vatRefundAmount: exportInfo.vatRefundAmount,
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
<h1 className="text-2xl sm:text-3xl font-semibold text-white">VAT Refund Calculator</h1>
<p className="mt-1 text-sm text-gray-400">
Calculate how much VAT you can claim back from your inventory purchases
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
VAT refund calculation is available exclusively with the Professional plan. Calculate how much VAT you can claim back from HMRC on your inventory purchases if you're VAT registered.
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
<h5 className="text-white font-medium mb-2">VAT Refund Features:</h5>
<ul className="text-gray-300 text-sm space-y-1">
<li>• Calculate VAT refunds from VAT-inclusive prices</li>
<li>• Professional VAT refund reports</li>
<li>• Category-wise VAT breakdowns</li>
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

{/* Why VAT Refunds Matter */}
<div className="mt-8 bg-green-900/20 border border-green-700 rounded-lg p-6">
<div className="flex items-start">
<RiRefund2Line className="h-6 w-6 text-green-400 mr-3 mt-1 flex-shrink-0" />
<div>
<h5 className="text-green-400 font-medium mb-2">Why Calculate VAT Refunds?</h5>
<ul className="text-green-300 text-sm space-y-1">
<li>• <strong>Maximize Tax Savings:</strong> Claim back VAT already paid on purchases</li>
<li>• <strong>Improve Cash Flow:</strong> Get money back from HMRC quarterly</li>
<li>• <strong>Professional Reports:</strong> Accountant-ready VAT return documentation</li>
<li>• <strong>Compliance:</strong> Proper records for HMRC VAT inspections</li>
<li>• <strong>Time-Saving:</strong> Automated calculations from VAT-inclusive prices</li>
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
<span className="ml-2 text-white">Loading VAT refund data...</span>
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
<h1 className="text-2xl sm:text-3xl font-semibold text-white">VAT Refund Calculator</h1>
<p className="mt-1 text-sm text-gray-400">
Calculate how much VAT you can claim back from your inventory purchases
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
<RiRefund2Line className="mr-2 h-4 w-4" />
Generate VAT Report
</button>
</div>
</div>

{/* Professional Plan Badge */}
<div className="mb-6 bg-gradient-to-r from-green-600/20 to-primary-600/20 rounded-lg p-4 border border-green-500/30">
<div className="flex items-center">
<RiStarLine className="h-5 w-5 text-green-400 mr-2" />
<div>
<h3 className="text-green-400 font-medium">Professional Feature Active</h3>
<p className="text-gray-300 text-sm">Calculate VAT refunds from your VAT-inclusive purchase prices</p>
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

{/* VAT Refund Summary */}
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
VAT You Can Claim Back
</dt>
<dd className="flex items-baseline mt-1">
<div className="text-xl sm:text-2xl font-semibold text-green-400">
{formatCurrency(inventoryStats.vatRefundAmount)}
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
Net Cost (Ex-VAT)
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

{/* VAT Inclusive Pricing Notice */}
<div className="bg-blue-900/20 border border-blue-700 rounded-lg p-6 mb-8">
<div className="flex items-start">
<RiAlertLine className="h-6 w-6 text-blue-400 mr-3 mt-1 flex-shrink-0" />
<div>
<h5 className="text-blue-400 font-medium mb-2">VAT-Inclusive Pricing Calculation</h5>
<p className="text-blue-300 text-sm mb-3">
Most inventory purchases include VAT in the price you paid. This calculator extracts the VAT amount that you can claim back from HMRC if you're VAT registered.
</p>
<div className="bg-blue-800/30 rounded-lg p-3">
<h6 className="text-blue-300 font-medium text-sm mb-1">How it works:</h6>
<ul className="text-blue-300 text-xs space-y-1">
<li>• <strong>Your Purchase Price:</strong> {formatCurrency(120)} (VAT-inclusive)</li>
<li>• <strong>VAT Amount You Paid:</strong> {formatCurrency(20)} (that's 20% ÷ 120% × £120)</li>
<li>• <strong>Net Cost:</strong> {formatCurrency(100)} (the actual item cost excluding VAT)</li>
<li>• <strong>VAT Refund Available:</strong> {formatCurrency(20)} (claimable from HMRC)</li>
</ul>
</div>
</div>
</div>
</div>

{/* Quick VAT Guide */}
<div className="bg-gray-800 rounded-lg shadow-lg mb-8">
<div className="px-4 py-5 border-b border-gray-700 sm:px-6">
<h3 className="text-lg leading-6 font-medium text-white">VAT Refund Guide</h3>
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
</div>
</div>
</div>

{/* What's Included */}
<div className="bg-gray-800 rounded-lg shadow-lg mb-8">
<div className="px-4 py-5 border-b border-gray-700 sm:px-6">
<h3 className="text-lg leading-6 font-medium text-white">What's Included in VAT Report</h3>
</div>
<div className="px-4 py-5 sm:p-6">
<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
<div>
<h4 className="text-white font-medium mb-3">VAT Calculations</h4>
<ul className="text-gray-300 text-sm space-y-2">
<li>• VAT amounts extracted from VAT-inclusive prices</li>
<li>• VAT refund amounts by category</li>
<li>• Net costs excluding VAT</li>
<li>• Potential quarterly refund amounts</li>
<li>• Individual item VAT breakdowns</li>
<li>• Annual VAT refund projections</li>
</ul>
</div>
<div>
<h4 className="text-white font-medium mb-3">Business Documentation</h4>
<ul className="text-gray-300 text-sm space-y-2">
<li>• Business name and VAT details</li>
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

{/* Export History */}
<div className="bg-gray-800 rounded-lg shadow-lg">
<div className="px-4 py-5 border-b border-gray-700 sm:px-6">
<div className="flex items-center justify-between">
<div>
<h3 className="text-lg leading-6 font-medium text-white">Export History</h3>
<p className="mt-1 max-w-2xl text-sm text-gray-400">
Your recent VAT refund reports
</p>
</div>
<RiHistoryLine className="h-6 w-6 text-gray-400" />
</div>
</div>

<div className="px-4 py-5 sm:p-6">
{exportHistory.length===0 ? (
<div className="text-center py-12">
<RiRefund2Line className="mx-auto h-12 w-12 text-gray-500 mb-4" />
<h3 className="text-lg font-medium text-white mb-2">No VAT reports yet</h3>
<p className="text-gray-400 text-sm mb-6">
Generate your first VAT refund report to build your export history
</p>
<button
onClick={()=> setIsExportModalOpen(true)}
className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
>
<RiRefund2Line className="mr-2 h-4 w-4" />
Generate VAT Report
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
{exportRecord.fileName || `VAT Report ${exportRecord.id}`}
</span>
<span className="ml-2 text-sm text-gray-400">
{formatDate(exportRecord.timestamp)}
</span>
</div>
<div className="mt-1 flex items-center space-x-4 text-sm text-gray-400">
<span>{exportRecord.recordCount} items</span>
<span>Cost: {formatCurrency(exportRecord.totalValue)}</span>
<span>VAT Refund: {formatCurrency(exportRecord.vatRefundAmount)}</span>
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
const details=`VAT Refund Report Details:

File: ${exportRecord.fileName || 'VAT Report'}
Date: ${formatDate(exportRecord.timestamp)}
Format: ${exportRecord.format.toUpperCase()}
Items: ${exportRecord.recordCount}
Total Cost: ${formatCurrency(exportRecord.totalValue)}
VAT Refund: ${formatCurrency(exportRecord.vatRefundAmount)}
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
<h4 className="text-sm font-medium text-white mb-2">VAT Refund Summary:</h4>
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
<div className="text-gray-400">VAT Refund</div>
<div className="text-green-400 font-medium">{formatCurrency(exportRecord.vatRefundAmount)}</div>
</div>
<div>
<div className="text-gray-400">Net Cost</div>
<div className="text-white font-medium">{formatCurrency(exportRecord.totalValue - exportRecord.vatRefundAmount)}</div>
</div>
</div>
</div>
</motion.div>
))}
</div>
)}
</div>
</div>

{/* VAT Information */}
<div className="bg-green-900/20 border border-green-700 rounded-lg p-6">
<div className="flex items-start">
<RiAlertLine className="h-5 w-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
<div>
<h5 className="text-green-400 font-medium mb-2">VAT Refund Information</h5>
<ul className="text-green-300 text-sm space-y-1">
<li>• Calculates VAT refunds from VAT-inclusive purchase prices</li>
<li>• Only VAT-registered businesses can claim VAT refunds</li>
<li>• Submit VAT returns quarterly to HMRC for refunds</li>
<li>• Keep all purchase receipts showing VAT separately</li>
<li>• Reports are compatible with popular accounting software</li>
<li>• Consult your accountant for VAT registration advice</li>
</ul>
</div>
</div>
</div>
</motion.div>

{/* VAT Export Modal */}
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