import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RiLockLine, RiArrowRightLine } from 'react-icons/ri';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { logSecurityEvent } from '../utils/security';

/**
 * FeatureGate - A component that restricts access to features based on user subscription
 * 
 * @param {string} feature - The feature to check access for (e.g., 'receiptScanner', 'excelImport')
 * @param {React.ReactNode} children - The content to render if the user has access
 * @param {string} fallbackMessage - Custom message to display when access is denied
 * @param {boolean} redirectToPricing - Whether to show a redirect to pricing page button
 */
export default function FeatureGate({ 
  feature, 
  children, 
  fallbackMessage = "This feature requires a higher subscription plan",
  redirectToPricing = true 
}) {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');

  useEffect(() => {
    const checkAccess = async () => {
      if (!user?.email) {
        setHasAccess(false);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Check if Supabase is available
        if (supabase) {
          // Call the database function to check access
          const { data, error } = await supabase.rpc('check_feature_access', {
            user_email: user.email,
            feature_name: feature
          });
          
          if (error) {
            console.error('Error checking feature access:', error);
            logSecurityEvent('FEATURE_ACCESS_CHECK_ERROR', {
              feature,
              error: error.message
            });
            
            // Default to allowing access if there's an error
            setHasAccess(true);
          } else {
            setHasAccess(data);
            
            // If access is denied, get the latest log entry to see why
            if (!data) {
              const { data: logData } = await supabase
                .from('feature_access_logs_p3k7j2l')
                .select('reason')
                .eq('user_email', user.email)
                .eq('feature_name', feature)
                .eq('access_granted', false)
                .order('timestamp', { ascending: false })
                .limit(1);
                
              if (logData && logData.length > 0) {
                setReason(logData[0].reason);
              }
            }
            
            logSecurityEvent('FEATURE_ACCESS_CHECK', {
              feature,
              granted: data
            });
          }
        } else {
          // Fallback to client-side check when Supabase is not available
          // This is less secure but provides a fallback
          const planLimits = {
            free: {
              inventoryItems: 100,
              receiptScans: 0,
              excelImport: false,
              teamMembers: 1
            },
            basic: {
              inventoryItems: 1000,
              receiptScans: 50,
              excelImport: true,
              teamMembers: 3
            },
            professional: {
              inventoryItems: -1, // unlimited
              receiptScans: -1, // unlimited
              excelImport: true,
              teamMembers: 10
            }
          };
          
          // Determine user's plan (default to free)
          const userPlan = user.plan || 'free';
          const limits = planLimits[userPlan];
          
          // Check feature access based on limits
          let access = false;
          if (feature === 'receiptScanner') {
            access = limits.receiptScans > 0 || limits.receiptScans === -1;
            if (!access) setReason('Receipt scanning not available on current plan');
          } else if (feature === 'excelImport') {
            access = limits.excelImport === true;
            if (!access) setReason('Excel import not available on current plan');
          } else if (feature === 'inventoryItems') {
            // For inventory items, we'd need to check against current usage
            // Since we can't do that without the database, we'll assume access is granted
            access = true;
          } else {
            // Default to allowing access for unknown features
            access = true;
          }
          
          setHasAccess(access);
          
          logSecurityEvent('FEATURE_ACCESS_CHECK_FALLBACK', {
            feature,
            granted: access,
            plan: userPlan
          });
        }
      } catch (error) {
        console.error('Error in feature access check:', error);
        // Default to allowing access on error
        setHasAccess(true);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [user?.email, feature]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center"
      >
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
          <RiLockLine className="h-6 w-6 text-amber-600" />
        </div>
        <h3 className="text-lg font-medium text-white mb-2">
          Feature Restricted
        </h3>
        <p className="text-gray-300 mb-6">
          {reason || fallbackMessage}
        </p>
        {redirectToPricing && (
          <Link
            to="/pricing"
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Upgrade Your Plan <RiArrowRightLine className="ml-2 h-4 w-4" />
          </Link>
        )}
      </motion.div>
    );
  }

  return children;
}