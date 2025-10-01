import {useState,useEffect} from 'react';
import {motion,AnimatePresence} from 'framer-motion';
import {RiAlertLine,RiArrowRightLine,RiBarChartLine,RiLockLine,RiStarLine} from 'react-icons/ri';
import {Link} from 'react-router-dom';
import useFeatureAccess from '../hooks/useFeatureAccess';

export default function UsageLimitGate({limitType,currentUsage,children,showUpgradePrompt=true,customMessage=null,onLimitReached=null}) {
const {planLimits,currentPlan,planInfo,loading}=useFeatureAccess();
const [limitCheck,setLimitCheck]=useState(null);

useEffect(()=> {
if (!planLimits || loading) return;

let allowed=false;
let limit=0;
let unlimited=false;
let reason='';

switch (limitType) {
case 'inventoryItems':
limit=planLimits.inventoryItems;
unlimited=limit===-1;
allowed=unlimited || currentUsage < limit;

// Enhanced reason messages for inventory items
if (!allowed) {
if (currentPlan==='free') {
reason=`You have reached your Free plan limit of ${limit} inventory items. Upgrade to Professional for unlimited items.`;
} else {
reason=`You have reached your ${planInfo.name} plan limit of ${limit} inventory items.`;
}
}
break;

case 'receiptScans':
limit=planLimits.receiptScans;
unlimited=limit===-1;
allowed=unlimited || (limit > 0 && currentUsage < limit);
reason=allowed ? null : limit===0 
? 'Receipt scanning is not available on your plan' 
: 'You have reached your monthly receipt scan limit';
break;

case 'teamMembers':
limit=planLimits.teamMembers;
unlimited=limit===-1;
allowed=unlimited || currentUsage < limit;
reason=allowed ? null : 'You have reached your team member limit';
break;

default:
allowed=true;
}

setLimitCheck({
allowed,
reason,
limit,
unlimited,
remaining: unlimited ? -1 : Math.max(0,limit - currentUsage),
usagePercentage: unlimited ? 0 : limit > 0 ? (currentUsage / limit) * 100 : 100
});

// Call onLimitReached if provided and limit is reached
if (!allowed && onLimitReached) {
onLimitReached({
limitType,
currentUsage,
limit,
reason
});
}
},[planLimits,currentUsage,limitType,loading,onLimitReached,currentPlan,planInfo]);

if (loading) {
return (
<div className="flex items-center justify-center p-4">
<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
</div>
);
}

// If limit check failed or not allowed, show upgrade prompt
if (!limitCheck?.allowed && showUpgradePrompt) {
// Special handling for inventory items at limit
if (limitType==='inventoryItems' && currentPlan==='free') {
return (
<motion.div
initial={{opacity: 0,scale: 0.95}}
animate={{opacity: 1,scale: 1}}
className="bg-gray-800 rounded-lg p-8 border border-red-700"
>
<div className="text-center">
<div className="w-16 h-16 bg-red-700/30 rounded-full flex items-center justify-center mx-auto mb-6">
<RiLockLine className="h-8 w-8 text-red-400" />
</div>
<h3 className="text-2xl font-bold text-white mb-4">
Free Plan Limit Reached
</h3>
<p className="text-gray-300 mb-6 max-w-2xl mx-auto">
{customMessage || limitCheck?.reason}
</p>

{/* Usage Stats */}
<div className="bg-gray-700 rounded-lg p-4 mb-6 max-w-md mx-auto">
<div className="grid grid-cols-2 gap-4 text-sm">
<div>
<div className="text-gray-400">Current Items:</div>
<div className="text-white font-medium">{currentUsage}</div>
</div>
<div>
<div className="text-gray-400">Free Plan Limit:</div>
<div className="text-white font-medium">{limitCheck.limit}</div>
</div>
</div>
<div className="mt-3">
<div className="w-full bg-gray-600 rounded-full h-2">
<div className="bg-red-500 h-2 rounded-full w-full"></div>
</div>
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
<h5 className="text-white font-medium mb-2">📦 Inventory Management:</h5>
<ul className="text-gray-300 text-sm space-y-1">
<li>• Unlimited inventory items</li>
<li>• Advanced categorization</li>
<li>• Bulk operations</li>
<li>• Custom fields</li>
</ul>
</div>
<div>
<h5 className="text-white font-medium mb-2">💼 Additional Features:</h5>
<ul className="text-gray-300 text-sm space-y-1">
<li>• Unlimited receipt scans</li>
<li>• Unlimited Excel imports</li>
<li>• Professional tax exports</li>
<li>• Priority support</li>
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
</motion.div>
);
}

// Default upgrade prompt for other limits
return (
<motion.div
initial={{opacity: 0,scale: 0.95}}
animate={{opacity: 1,scale: 1}}
className="bg-gray-800 rounded-lg p-6 border border-yellow-600"
>
<div className="flex items-start">
<RiAlertLine className="h-6 w-6 text-yellow-400 mr-3 mt-1 flex-shrink-0" />
<div className="flex-1">
<h3 className="text-lg font-medium text-white mb-2">
Usage Limit Reached
</h3>
<p className="text-gray-300 mb-4">
{customMessage || limitCheck?.reason || 'You\'ve reached the limit for this feature on your current plan.'}
</p>

{limitCheck?.limit > 0 && (
<div className="bg-gray-700 rounded-lg p-3 mb-4">
<div className="flex justify-between text-sm mb-2">
<span className="text-gray-400">Current Usage:</span>
<span className="text-white">{currentUsage}</span>
</div>
<div className="flex justify-between text-sm mb-2">
<span className="text-gray-400">Plan Limit:</span>
<span className="text-white">
{limitCheck.unlimited ? '∞' : limitCheck.limit}
</span>
</div>
{!limitCheck.unlimited && (
<div className="mt-2">
<div className="flex justify-between text-xs mb-1">
<span className="text-gray-400">Usage</span>
<span className="text-gray-400">{Math.round(limitCheck.usagePercentage)}%</span>
</div>
<div className="w-full bg-gray-600 rounded-full h-2">
<div
className={`h-2 rounded-full transition-all duration-300 ${
limitCheck.usagePercentage >= 100 
? 'bg-red-500' 
: limitCheck.usagePercentage >= 80 
? 'bg-yellow-500' 
: 'bg-green-500'
}`}
style={{width: `${Math.min(limitCheck.usagePercentage,100)}%`}}
/>
</div>
</div>
)}
</div>
)}

<div className="flex flex-col sm:flex-row gap-3">
<Link
to="/pricing"
className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
>
Upgrade Your Plan
<RiArrowRightLine className="h-4 w-4 ml-2" />
</Link>
<Link
to="/settings/subscription"
className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
>
<RiBarChartLine className="h-4 w-4 mr-2" />
View Usage
</Link>
</div>
</div>
</div>
</motion.div>
);
}

// If allowed, render children with optional usage warning
return (
<div>
{children}

{/* Usage warning for near-limit situations */}
{limitCheck?.allowed && !limitCheck?.unlimited && limitCheck?.limit > 0 && (
<AnimatePresence>
{limitCheck.usagePercentage >= 80 && (
<motion.div
initial={{opacity: 0,y: -10}}
animate={{opacity: 1,y: 0}}
exit={{opacity: 0,y: -10}}
className={`mt-4 p-3 rounded-lg border ${
limitCheck.usagePercentage >= 95 
? 'bg-red-900/30 border-red-700' 
: 'bg-yellow-900/30 border-yellow-700'
}`}
>
<div className="flex items-center">
<RiAlertLine className={`h-4 w-4 mr-2 ${
limitCheck.usagePercentage >= 95 ? 'text-red-400' : 'text-yellow-400'
}`} />
<div className="flex-1">
<p className={`text-sm ${
limitCheck.usagePercentage >= 95 ? 'text-red-300' : 'text-yellow-300'
}`}>
{limitCheck.usagePercentage >= 95
? `Critical: You're at ${Math.round(limitCheck.usagePercentage)}% of your ${getLimitDisplayName(limitType)} limit`
: `Warning: You're approaching your ${getLimitDisplayName(limitType)} limit (${Math.round(limitCheck.usagePercentage)}% used)`
}
</p>
<div className="mt-2 w-full bg-gray-600 rounded-full h-1">
<div
className={`h-1 rounded-full transition-all duration-300 ${
limitCheck.usagePercentage >= 95 ? 'bg-red-500' : 'bg-yellow-500'
}`}
style={{width: `${Math.min(limitCheck.usagePercentage,100)}%`}}
/>
</div>
</div>
<Link
to="/pricing"
className={`ml-3 text-sm font-medium hover:underline ${
limitCheck.usagePercentage >= 95 ? 'text-red-300' : 'text-yellow-300'
}`}
>
Upgrade
</Link>
</div>
</motion.div>
)}
</AnimatePresence>
)}
</div>
);
}

function getLimitDisplayName(limitType) {
const names = {
inventoryItems: 'inventory item',
receiptScans: 'receipt scan',
teamMembers: 'team member'
};
return names[limitType] || limitType;
}