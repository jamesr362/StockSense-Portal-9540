import {motion} from 'framer-motion';
import {useState,useEffect,useCallback} from 'react';
import {RiAddLine,RiSearchLine,RiEditLine,RiDeleteBin6Line,RiCalendarLine,RiStore2Line,RiScanLine,RiAlertLine,RiLockLine,RiStarLine,RiArrowRightLine} from 'react-icons/ri';
import {Link} from 'react-router-dom';
import AddItemModal from '../components/AddItemModal';
import EditItemModal from '../components/EditItemModal';
import DeleteItemModal from '../components/DeleteItemModal';
import ReceiptScannerModal from '../components/ReceiptScannerModal';
import UsageLimitGate from '../components/UsageLimitGate';
import FeatureGate from '../components/FeatureGate';
import {getInventoryItems,addInventoryItem,updateInventoryItem,deleteInventoryItem,searchInventoryItems} from '../services/db';
import {useAuth} from '../context/AuthContext';
import useFeatureAccess from '../hooks/useFeatureAccess';

export default function Inventory() {
const [searchTerm,setSearchTerm]=useState('');
const [isAddModalOpen,setIsAddModalOpen]=useState(false);
const [isEditModalOpen,setIsEditModalOpen]=useState(false);
const [isDeleteModalOpen,setIsDeleteModalOpen]=useState(false);
const [isScannerOpen,setIsScannerOpen]=useState(false);
const [selectedItem,setSelectedItem]=useState(null);
const [inventoryItems,setInventoryItems]=useState([]);
const [isLoading,setIsLoading]=useState(true);
const [error,setError]=useState(null);
const [successMessage,setSuccessMessage]=useState('');
const {user}=useAuth();
const {canAddInventoryItem,canUseFeature,currentPlan,planInfo}=useFeatureAccess();

const loadInventoryItems=useCallback(async ()=> {
if (!user?.email) return;

try {
setIsLoading(true);
setError(null);
console.log('===Loading inventory items for user:',user.email,'===');
const items=await getInventoryItems(user.email);
console.log('===Loaded inventory items:',items?.length,'items===');
console.log('Items:',items);
setInventoryItems(items || []);
} catch (error) {
console.error('Error loading inventory items:',error);
setError('Failed to load inventory items');
} finally {
setIsLoading(false);
}
},[user?.email]);

useEffect(()=> {
loadInventoryItems();
},[loadInventoryItems]);

const handleAddItem=async (newItem)=> {
if (!user?.email) {
setError('User not authenticated');
return;
}

console.log('===handleAddItem called===');
console.log('User email:',user.email);
console.log('New item data:',newItem);

// CRITICAL: Check if user can add more items BEFORE attempting to add
const limitCheck=canAddInventoryItem(inventoryItems.length);
console.log('Limit check result:',limitCheck);

if (!limitCheck.allowed) {
setError(limitCheck.reason);
return;
}

try {
setError(null);
console.log('===Calling addInventoryItem===');
// Call the database function to add the item
const savedItem=await addInventoryItem(newItem,user.email);
console.log('===Item saved to database:',savedItem,'===');

// Reload the inventory to get the latest data from database
await loadInventoryItems();

// Close modal and show success message
setIsAddModalOpen(false);
setSuccessMessage(`Successfully added "${newItem.name}" to inventory!`);
// Clear success message after 5 seconds
setTimeout(()=> setSuccessMessage(''),5000);

console.log('===Add item process completed successfully===');
} catch (error) {
console.error('===Error in handleAddItem===',error);
setError(error.message || 'Failed to add item to inventory');
}
};

const handleScannedItems=async (scannedItems)=> {
if (!user?.email || !scannedItems.length) return;

// Check if user can scan receipts
if (!canUseFeature('receiptScanner')) {
setError('Receipt scanning is not available on your current plan');
return;
}

// CRITICAL: Check inventory limits before adding scanned items
let itemsCanAdd=scannedItems.length;
const currentCount=inventoryItems.length;
const limitCheck=canAddInventoryItem(currentCount + scannedItems.length - 1);

if (!limitCheck.allowed && limitCheck.limit !==-1) {
const maxCanAdd=Math.max(0,limitCheck.limit - currentCount);
if (maxCanAdd===0) {
setError(`Cannot add items: You have reached your ${limitCheck.limit} item limit for the ${currentPlan==='free' ? 'Free' : 'current'} plan. Upgrade to Professional for unlimited items.`);
return;
} else {
setError(`Can only add ${maxCanAdd} more items due to plan limits. ${scannedItems.length - maxCanAdd} items will be skipped. Consider upgrading your plan.`);
scannedItems=scannedItems.slice(0,maxCanAdd);
itemsCanAdd=maxCanAdd;
}
}

try {
setError(null);
let addedCount=0;

// Add each scanned item to inventory
for (const item of scannedItems) {
try {
// Double-check limit for each item
const currentLimitCheck=canAddInventoryItem(inventoryItems.length + addedCount);
if (!currentLimitCheck.allowed && currentLimitCheck.limit !==-1) {
console.log(`Stopping at item ${addedCount + 1} due to limit`);
break;
}
await addInventoryItem(item,user.email);
addedCount++;
} catch (itemError) {
console.error('Error adding scanned item:',itemError);
}
}

// Reload inventory to reflect changes
await loadInventoryItems();

if (addedCount > 0) {
const skippedCount=scannedItems.length - addedCount;
let message=`Successfully added ${addedCount} items from receipt scan!`;
if (skippedCount > 0) {
message +=` (${skippedCount} items skipped due to plan limits)`;
}
setSuccessMessage(message);
setTimeout(()=> setSuccessMessage(''),5000);
} else {
setError('Failed to add items from receipt scan due to plan limits');
}
} catch (error) {
console.error('Error processing scanned items:',error);
setError('Failed to process scanned items');
}
};

const handleEditItem=(item)=> {
setSelectedItem(item);
setIsEditModalOpen(true);
};

const handleDeleteItem=(item)=> {
setSelectedItem(item);
setIsDeleteModalOpen(true);
};

const handleConfirmDelete=async (itemId)=> {
if (!user?.email) return;

try {
setError(null);
console.log('===Deleting item:',itemId,'===');
await deleteInventoryItem(itemId,user.email);

// Reload inventory to reflect changes
await loadInventoryItems();

setSuccessMessage('Item deleted successfully!');
setTimeout(()=> setSuccessMessage(''),3000);
console.log('===Item deleted successfully===');
} catch (error) {
console.error('Error deleting inventory item:',error);
setError('Failed to delete item');
}
};

const handleSaveEdit=async (updatedItem)=> {
if (!user?.email) return;

try {
setError(null);
console.log('===Updating item:',updatedItem,'===');
await updateInventoryItem(updatedItem,user.email);

// Reload inventory to reflect changes
await loadInventoryItems();

setIsEditModalOpen(false);
setSelectedItem(null);
setSuccessMessage('Item updated successfully!');
setTimeout(()=> setSuccessMessage(''),3000);
console.log('===Item updated successfully===');
} catch (error) {
console.error('Error updating inventory item:',error);
setError('Failed to update item');
}
};

// Search functionality with debouncing
useEffect(()=> {
const searchItems=async ()=> {
if (!user?.email) return;

try {
setIsLoading(true);
setError(null);
console.log('===Searching items with term:',searchTerm,'===');
const results=await searchInventoryItems(searchTerm,user.email);
console.log('===Search results:',results?.length,'items===');
setInventoryItems(results || []);
} catch (error) {
console.error('Error searching items:',error);
setError('Failed to search items');
} finally {
setIsLoading(false);
}
};

const debounceSearch=setTimeout(searchItems,300);
return ()=> clearTimeout(debounceSearch);
},[searchTerm,user?.email]);

const getStatusColor=(status)=> {
switch (status) {
case 'In Stock': return 'bg-green-100 text-green-800';
case 'Limited Stock': return 'bg-yellow-100 text-yellow-800';
case 'Out of Stock': return 'bg-red-100 text-red-800';
default: return 'bg-gray-100 text-gray-800';
}
};

const formatDate=(dateString)=> {
if (!dateString) return 'N/A';
try {
return new Date(dateString).toLocaleDateString('en-GB',{
day: '2-digit',
month: '2-digit',
year: 'numeric',
});
} catch (error) {
return 'N/A';
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

const handleAddItemClick=()=> {
// CRITICAL: Check limit before opening modal
const limitCheck=canAddInventoryItem(inventoryItems.length);
if (!limitCheck.allowed) {
setError(limitCheck.reason);
return;
}
setIsAddModalOpen(true);
};

const handleQuickScanClick=()=> {
if (!canUseFeature('receiptScanner')) {
setError('Receipt scanning is not available on your current plan');
return;
}
setIsScannerOpen(true);
};

// Check if user is at or near their limit
const limitCheck=canAddInventoryItem(inventoryItems.length);
const isNearLimit=limitCheck.limit && limitCheck.limit > 0 && (inventoryItems.length / limitCheck.limit) >= 0.8;
const isAtLimit=!limitCheck.allowed;

return (
<div className="h-full overflow-hidden">
<motion.div
initial={{opacity: 0,y: 20}}
animate={{opacity: 1,y: 0}}
transition={{duration: 0.5}}
className="h-full flex flex-col overflow-hidden"
>
{/* Header */}
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 flex-shrink-0">
<div>
<h1 className="text-2xl sm:text-3xl font-semibold text-white">Inventory</h1>
<p className="mt-1 text-sm text-gray-400">
Manage your inventory items
{currentPlan==='free' && (
<span className="ml-2 text-yellow-400">
({inventoryItems.length}/100 items used)
</span>
)}
</p>
</div>
<div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
<FeatureGate feature="receiptScanner" showUpgradePrompt={false}>
<Link
to="/receipt-scanner"
className="inline-flex items-center justify-center rounded-md border border-primary-600 bg-transparent px-4 py-2 text-sm font-medium text-primary-400 shadow-sm hover:bg-primary-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 w-full sm:w-auto transition-colors"
>
<RiScanLine className="mr-2 h-4 w-4" />
Receipt Scanner
</Link>
</FeatureGate>

<button
type="button"
onClick={handleQuickScanClick}
className="inline-flex items-center justify-center rounded-md border border-gray-600 bg-transparent px-4 py-2 text-sm font-medium text-gray-300 shadow-sm hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 w-full sm:w-auto transition-colors"
>
<RiScanLine className="mr-2 h-4 w-4" />
Quick Scan
</button>

<button
type="button"
onClick={handleAddItemClick}
disabled={isAtLimit}
className={`inline-flex items-center justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 w-full sm:w-auto ${
isAtLimit 
? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
: 'bg-primary-600 text-white hover:bg-primary-700'
}`}
>
<RiAddLine className="mr-2 h-4 w-4" />
Add Item
</button>
</div>
</div>

{/* Free Plan Limit Warning */}
{currentPlan==='free' && isNearLimit && !isAtLimit && (
<motion.div
initial={{opacity: 0,y: -10}}
animate={{opacity: 1,y: 0}}
className="mb-4 bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 flex-shrink-0"
>
<div className="flex items-center">
<RiAlertLine className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0" />
<div className="flex-1">
<h3 className="text-yellow-300 font-medium">
Approaching Free Plan Limit
</h3>
<p className="text-gray-300 text-sm mt-1">
You're using {inventoryItems.length} of 100 available inventory slots. Upgrade to Professional for unlimited items.
</p>
</div>
<Link
to="/pricing"
className="ml-3 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
>
Upgrade Now
</Link>
</div>
<div className="mt-3">
<div className="w-full bg-gray-600 rounded-full h-2">
<div
className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
style={{width: `${(inventoryItems.length / 100) * 100}%`}}
/>
</div>
</div>
</motion.div>
)}

{/* At Limit Warning */}
{isAtLimit && currentPlan==='free' && (
<motion.div
initial={{opacity: 0,y: -10}}
animate={{opacity: 1,y: 0}}
className="mb-4 bg-red-900/20 border border-red-700 rounded-lg p-6 flex-shrink-0"
>
<div className="text-center">
<div className="w-16 h-16 bg-red-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
<RiLockLine className="h-8 w-8 text-red-400" />
</div>
<h3 className="text-xl font-bold text-white mb-2">
Free Plan Limit Reached
</h3>
<p className="text-gray-300 mb-4">
You've reached your 100 item limit for the Free plan. Upgrade to Professional for unlimited inventory items.
</p>
<div className="flex flex-col sm:flex-row justify-center gap-4">
<Link
to="/pricing"
className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-semibold"
>
<RiStarLine className="h-5 w-5 mr-2" />
Upgrade to Professional
<RiArrowRightLine className="h-5 w-5 ml-2" />
</Link>
</div>
</div>
</motion.div>
)}

{/* Success Message */}
{successMessage && (
<motion.div
initial={{opacity: 0,y: -10}}
animate={{opacity: 1,y: 0}}
className="mb-4 rounded-md bg-green-900/50 p-4 flex-shrink-0"
>
<div className="text-sm text-green-200">{successMessage}</div>
</motion.div>
)}

{/* Error Message */}
{error && (
<motion.div
initial={{opacity: 0,y: -10}}
animate={{opacity: 1,y: 0}}
className="mb-4 rounded-md bg-red-900/50 p-4 flex-shrink-0"
>
<div className="text-sm text-red-200">{error}</div>
</motion.div>
)}

{/* Usage Limit Gate for Inventory */}
<UsageLimitGate limitType="inventoryItems" currentUsage={inventoryItems.length}>
<div className="flex flex-col h-full min-h-0 overflow-hidden">
{/* Search */}
<div className="mb-6 flex-shrink-0">
<div className="relative rounded-md shadow-sm">
<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
<RiSearchLine className="h-5 w-5 text-gray-400" />
</div>
<input
type="text"
className="block w-full rounded-md border-gray-700 bg-gray-800 pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
placeholder="Search inventory..."
value={searchTerm}
onChange={(e)=> setSearchTerm(e.target.value)}
/>
</div>
</div>

{/* Content Area - Fixed height to prevent scrolling */}
<div className="flex-1 min-h-0 overflow-hidden">
{isLoading ? (
<div className="flex items-center justify-center h-64">
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
</div>
) : inventoryItems.length===0 ? (
<div className="text-center py-12 bg-gray-800 rounded-lg">
<RiStore2Line className="mx-auto h-12 w-12 text-gray-500 mb-4" />
<h3 className="text-lg font-medium text-white mb-2">
{searchTerm ? 'No items found' : 'No inventory items'}
</h3>
<p className="text-gray-400 text-sm mb-6">
{searchTerm ? 'Try adjusting your search terms' : 'Add some items to get started with your inventory'}
</p>
{!searchTerm && (
<div className="flex flex-col sm:flex-row justify-center gap-3">
<FeatureGate feature="receiptScanner" showUpgradePrompt={false}>
<Link
to="/receipt-scanner"
className="inline-flex items-center px-4 py-2 border border-primary-600 text-primary-400 rounded-lg hover:bg-primary-600 hover:text-white transition-colors"
>
<RiScanLine className="mr-2 h-4 w-4" />
Scan Receipt
</Link>
</FeatureGate>
<button
onClick={handleAddItemClick}
disabled={isAtLimit}
className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors ${
isAtLimit 
? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
: 'bg-primary-600 text-white hover:bg-primary-700'
}`}
>
<RiAddLine className="mr-2 h-4 w-4" />
Add Manually
</button>
</div>
)}
</div>
) : (
<>
{/* Mobile Card View */}
<div className="block lg:hidden space-y-4 h-full overflow-y-auto">
{inventoryItems.map((item)=> (
<motion.div
key={item.id}
initial={{opacity: 0}}
animate={{opacity: 1}}
transition={{duration: 0.3}}
className="bg-gray-800 rounded-lg shadow-lg overflow-hidden"
>
{/* Card Header */}
<div className="px-4 py-3 border-b border-gray-700">
<div className="flex items-start justify-between">
<div className="flex-1 min-w-0">
<h3 className="text-lg font-medium text-white truncate">
{item.name}
</h3>
<p className="text-sm text-gray-400 truncate">{item.category}</p>
</div>
<div className="flex space-x-2 ml-3 flex-shrink-0">
<button
onClick={()=> handleEditItem(item)}
className="p-2 text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded-md transition-colors"
>
<RiEditLine className="h-4 w-4" />
</button>
<button
onClick={()=> handleDeleteItem(item)}
className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded-md transition-colors"
>
<RiDeleteBin6Line className="h-4 w-4" />
</button>
</div>
</div>
</div>

{/* Card Body */}
<div className="p-4">
<div className="grid grid-cols-2 gap-4 text-sm">
<div className="space-y-3">
<div className="flex flex-col">
<span className="text-gray-400 text-xs font-medium uppercase tracking-wide">Quantity</span>
<span className="text-white font-medium">{item.quantity}</span>
</div>
<div className="flex flex-col">
<span className="text-gray-400 text-xs font-medium uppercase tracking-wide">Unit Price</span>
<span className="text-white font-medium">{formatCurrency(item.unitPrice)}</span>
</div>
<div className="flex flex-col">
<span className="text-gray-400 text-xs font-medium uppercase tracking-wide">Total Value</span>
<span className="text-white font-medium">{formatCurrency((item.quantity || 0) * (item.unitPrice || 0))}</span>
</div>
</div>
<div className="space-y-3">
<div className="flex flex-col">
<span className="text-gray-400 text-xs font-medium uppercase tracking-wide">Status</span>
<span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold w-fit ${getStatusColor(item.status)}`}>
{item.status}
</span>
</div>
<div className="flex flex-col">
<span className="text-gray-400 text-xs font-medium uppercase tracking-wide">Date Added</span>
<span className="text-white">{formatDate(item.dateAdded)}</span>
</div>
{item.description && (
<div className="flex flex-col">
<span className="text-gray-400 text-xs font-medium uppercase tracking-wide">Description</span>
<span className="text-white text-sm leading-relaxed">{item.description}</span>
</div>
)}
</div>
</div>
</div>
</motion.div>
))}
</div>

{/* Desktop Table View - Completely contained */}
<div className="hidden lg:block h-full w-full overflow-hidden">
<div className="h-full w-full flex flex-col bg-gray-800 rounded-lg shadow">
{/* Table Container - Fixed height and width */}
<div className="flex-1 min-h-0 w-full overflow-auto">
<table className="w-full table-fixed">
<thead className="bg-gray-700 sticky top-0 z-10">
<tr>
<th className="w-32 py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-white">
Name
</th>
<th className="w-24 px-3 py-3.5 text-left text-sm font-semibold text-white">
Category
</th>
<th className="w-16 px-3 py-3.5 text-left text-sm font-semibold text-white">
Qty
</th>
<th className="w-20 px-3 py-3.5 text-left text-sm font-semibold text-white">
Price
</th>
<th className="w-20 px-3 py-3.5 text-left text-sm font-semibold text-white">
Total
</th>
<th className="w-24 px-3 py-3.5 text-left text-sm font-semibold text-white">
Status
</th>
<th className="w-20 px-3 py-3.5 text-left text-sm font-semibold text-white">
<div className="flex items-center">
<RiCalendarLine className="h-4 w-4 mr-1" />
Date
</div>
</th>
<th className="w-32 px-3 py-3.5 text-left text-sm font-semibold text-white">
Description
</th>
<th className="w-20 px-3 py-3.5 text-left text-sm font-semibold text-white">
Actions
</th>
</tr>
</thead>
<tbody className="divide-y divide-gray-700 bg-gray-800">
{inventoryItems.map((item)=> (
<motion.tr
key={item.id}
initial={{opacity: 0}}
animate={{opacity: 1}}
transition={{duration: 0.3}}
>
<td className="w-32 py-4 pl-4 pr-3 text-sm font-medium text-white">
<div className="truncate" title={item.name}>
{item.name}
</div>
</td>
<td className="w-24 px-3 py-4 text-sm text-gray-300">
<div className="truncate" title={item.category}>
{item.category}
</div>
</td>
<td className="w-16 px-3 py-4 text-sm text-gray-300">
{item.quantity}
</td>
<td className="w-20 px-3 py-4 text-sm text-gray-300">
<div className="truncate">
{formatCurrency(item.unitPrice)}
</div>
</td>
<td className="w-20 px-3 py-4 text-sm text-gray-300 font-medium">
<div className="truncate">
{formatCurrency((item.quantity || 0) * (item.unitPrice || 0))}
</div>
</td>
<td className="w-24 px-3 py-4 text-sm">
<span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${getStatusColor(item.status)}`}>
{item.status}
</span>
</td>
<td className="w-20 px-3 py-4 text-sm text-gray-300">
<div className="truncate">
{formatDate(item.dateAdded)}
</div>
</td>
<td className="w-32 px-3 py-4 text-sm text-gray-300">
<div className="truncate" title={item.description || 'No description'}>
{item.description || 'No description'}
</div>
</td>
<td className="w-20 px-3 py-4 text-sm">
<div className="flex space-x-2">
<button
onClick={()=> handleEditItem(item)}
className="text-blue-400 hover:text-blue-300"
title="Edit item"
>
<RiEditLine className="h-4 w-4" />
</button>
<button
onClick={()=> handleDeleteItem(item)}
className="text-red-400 hover:text-red-300"
title="Delete item"
>
<RiDeleteBin6Line className="h-4 w-4" />
</button>
</div>
</td>
</motion.tr>
))}
</tbody>
</table>
</div>
</div>
</div>
</>
)}
</div>
</div>
</UsageLimitGate>
</motion.div>

<AddItemModal
isOpen={isAddModalOpen}
onClose={()=> setIsAddModalOpen(false)}
onAdd={handleAddItem}
/>

<EditItemModal
isOpen={isEditModalOpen}
onClose={()=> {
setIsEditModalOpen(false);
setSelectedItem(null);
}}
onSave={handleSaveEdit}
item={selectedItem}
/>

<DeleteItemModal
isOpen={isDeleteModalOpen}
onClose={()=> {
setIsDeleteModalOpen(false);
setSelectedItem(null);
}}
onConfirm={handleConfirmDelete}
item={selectedItem}
/>

<ReceiptScannerModal
isOpen={isScannerOpen}
onClose={()=> setIsScannerOpen(false)}
onItemsExtracted={handleScannedItems}
/>
</div>
);
}