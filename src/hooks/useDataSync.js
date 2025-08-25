import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { logSecurityEvent } from '../utils/security';

export const useDataSync = () => {
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, success, error
  const [lastSync, setLastSync] = useState(null);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  // Force sync all user data to database
  const forceSyncToDatabase = useCallback(async (dataType, data) => {
    if (!user?.email || !supabase) return false;

    try {
      setSyncStatus('syncing');
      setError(null);

      switch (dataType) {
        case 'inventory':
          await syncInventoryToDatabase(data);
          break;
        case 'subscription':
          await syncSubscriptionToDatabase(data);
          break;
        case 'user_profile':
          await syncUserProfileToDatabase(data);
          break;
        case 'export_history':
          await syncExportHistoryToDatabase(data);
          break;
        case 'scan_history':
          await syncScanHistoryToDatabase(data);
          break;
        case 'import_history':
          await syncImportHistoryToDatabase(data);
          break;
        default:
          throw new Error(`Unknown data type: ${dataType}`);
      }

      setSyncStatus('success');
      setLastSync(new Date().toISOString());
      logSecurityEvent('DATA_SYNC_SUCCESS', {
        userEmail: user.email,
        dataType,
        recordCount: Array.isArray(data) ? data.length : 1
      });

      return true;
    } catch (error) {
      console.error('Force sync error:', error);
      setSyncStatus('error');
      setError(error.message);
      logSecurityEvent('DATA_SYNC_ERROR', {
        userEmail: user.email,
        dataType,
        error: error.message
      });
      return false;
    }
  }, [user?.email]);

  // Sync inventory data
  const syncInventoryToDatabase = async (inventoryItems) => {
    if (!Array.isArray(inventoryItems)) return;

    // Get existing items from database
    const { data: existingItems, error: fetchError } = await supabase
      .from('inventory_tb2k4x9p1m')
      .select('*')
      .eq('user_email', user.email.toLowerCase());

    if (fetchError) throw fetchError;

    // Create a map of existing items by ID for quick lookup
    const existingItemsMap = new Map(existingItems?.map(item => [item.id, item]) || []);
    
    // Process each inventory item
    for (const item of inventoryItems) {
      const itemData = {
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        description: item.description || '',
        unit_price: item.unitPrice,
        status: item.status,
        date_added: item.dateAdded,
        user_email: user.email.toLowerCase(),
        updated_at: new Date().toISOString()
      };

      if (item.id && existingItemsMap.has(item.id)) {
        // Update existing item
        const { error: updateError } = await supabase
          .from('inventory_tb2k4x9p1m')
          .update(itemData)
          .eq('id', item.id)
          .eq('user_email', user.email.toLowerCase());

        if (updateError) throw updateError;
      } else {
        // Insert new item
        itemData.created_at = new Date().toISOString();
        const { error: insertError } = await supabase
          .from('inventory_tb2k4x9p1m')
          .insert([itemData]);

        if (insertError) throw insertError;
      }
    }
  };

  // Sync subscription data
  const syncSubscriptionToDatabase = async (subscriptionData) => {
    const { data: existing, error: fetchError } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .select('*')
      .eq('user_email', user.email.toLowerCase())
      .single();

    const subscriptionRecord = {
      user_email: user.email.toLowerCase(),
      stripe_customer_id: subscriptionData.stripeCustomerId || `cus_${Math.random().toString(36).substring(2, 15)}`,
      stripe_subscription_id: subscriptionData.stripeSubscriptionId || `sub_${Math.random().toString(36).substring(2, 15)}`,
      plan_id: subscriptionData.planId || 'price_free',
      status: subscriptionData.status || 'active',
      current_period_start: subscriptionData.currentPeriodStart || new Date().toISOString(),
      current_period_end: subscriptionData.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancel_at_period_end: subscriptionData.cancelAtPeriodEnd || false,
      canceled_at: subscriptionData.canceledAt || null,
      updated_at: new Date().toISOString()
    };

    if (existing && !fetchError) {
      // Update existing subscription
      const { error: updateError } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .update(subscriptionRecord)
        .eq('user_email', user.email.toLowerCase());

      if (updateError) throw updateError;
    } else {
      // Create new subscription
      subscriptionRecord.created_at = new Date().toISOString();
      const { error: insertError } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .insert([subscriptionRecord]);

      if (insertError) throw insertError;
    }
  };

  // Sync user profile data
  const syncUserProfileToDatabase = async (profileData) => {
    const { error } = await supabase
      .from('users_tb2k4x9p1m')
      .update({
        business_name: profileData.businessName,
        updated_at: new Date().toISOString()
      })
      .eq('email', user.email.toLowerCase());

    if (error) throw error;
  };

  // Sync export history
  const syncExportHistoryToDatabase = async (exportHistory) => {
    if (!Array.isArray(exportHistory)) return;

    // Delete existing export history for user
    const { error: deleteError } = await supabase
      .from('export_history_tb2k4x9p1m')
      .delete()
      .eq('user_email', user.email.toLowerCase());

    if (deleteError) throw deleteError;

    // Insert new export history
    if (exportHistory.length > 0) {
      const historyData = exportHistory.map(record => ({
        user_email: user.email.toLowerCase(),
        export_id: record.id.toString(),
        timestamp: record.timestamp,
        format: record.format,
        file_name: record.fileName,
        record_count: record.recordCount,
        total_value: record.totalValue,
        vat_amount: record.vatAmount,
        date_range: record.dateRange,
        settings: JSON.stringify(record.settings || {}),
        created_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('export_history_tb2k4x9p1m')
        .insert(historyData);

      if (insertError) throw insertError;
    }
  };

  // Sync scan history
  const syncScanHistoryToDatabase = async (scanHistory) => {
    if (!Array.isArray(scanHistory)) return;

    // Delete existing scan history for user
    const { error: deleteError } = await supabase
      .from('scan_history_tb2k4x9p1m')
      .delete()
      .eq('user_email', user.email.toLowerCase());

    if (deleteError) throw deleteError;

    // Insert new scan history
    if (scanHistory.length > 0) {
      const historyData = scanHistory.map(record => ({
        user_email: user.email.toLowerCase(),
        scan_id: record.id.toString(),
        timestamp: record.timestamp,
        items: JSON.stringify(record.items || []),
        item_count: record.itemCount,
        total_value: record.totalValue,
        receipt_image: record.receiptImage || null,
        created_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('scan_history_tb2k4x9p1m')
        .insert(historyData);

      if (insertError) throw insertError;
    }
  };

  // Sync import history
  const syncImportHistoryToDatabase = async (importHistory) => {
    if (!Array.isArray(importHistory)) return;

    // Delete existing import history for user
    const { error: deleteError } = await supabase
      .from('import_history_tb2k4x9p1m')
      .delete()
      .eq('user_email', user.email.toLowerCase());

    if (deleteError) throw deleteError;

    // Insert new import history
    if (importHistory.length > 0) {
      const historyData = importHistory.map(record => ({
        user_email: user.email.toLowerCase(),
        import_id: record.id.toString(),
        timestamp: record.timestamp,
        file_name: record.fileName,
        item_count: record.itemCount,
        status: record.status,
        items: JSON.stringify(record.items || []),
        total_value: record.totalValue,
        categories: JSON.stringify(record.categories || []),
        summary: JSON.stringify(record.summary || {}),
        created_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('import_history_tb2k4x9p1m')
        .insert(historyData);

      if (insertError) throw insertError;
    }
  };

  // Load data from database
  const loadFromDatabase = useCallback(async (dataType) => {
    if (!user?.email || !supabase) return null;

    try {
      switch (dataType) {
        case 'export_history':
          return await loadExportHistoryFromDatabase();
        case 'scan_history':
          return await loadScanHistoryFromDatabase();
        case 'import_history':
          return await loadImportHistoryFromDatabase();
        default:
          return null;
      }
    } catch (error) {
      console.error(`Error loading ${dataType} from database:`, error);
      return null;
    }
  }, [user?.email]);

  // Load export history from database
  const loadExportHistoryFromDatabase = async () => {
    const { data, error } = await supabase
      .from('export_history_tb2k4x9p1m')
      .select('*')
      .eq('user_email', user.email.toLowerCase())
      .order('timestamp', { ascending: false });

    if (error) throw error;

    return data?.map(record => ({
      id: parseInt(record.export_id),
      timestamp: record.timestamp,
      format: record.format,
      fileName: record.file_name,
      recordCount: record.record_count,
      totalValue: record.total_value,
      vatAmount: record.vat_amount,
      dateRange: record.date_range,
      settings: JSON.parse(record.settings || '{}')
    })) || [];
  };

  // Load scan history from database
  const loadScanHistoryFromDatabase = async () => {
    const { data, error } = await supabase
      .from('scan_history_tb2k4x9p1m')
      .select('*')
      .eq('user_email', user.email.toLowerCase())
      .order('timestamp', { ascending: false });

    if (error) throw error;

    return data?.map(record => ({
      id: parseInt(record.scan_id),
      timestamp: record.timestamp,
      items: JSON.parse(record.items || '[]'),
      itemCount: record.item_count,
      totalValue: record.total_value,
      receiptImage: record.receipt_image
    })) || [];
  };

  // Load import history from database
  const loadImportHistoryFromDatabase = async () => {
    const { data, error } = await supabase
      .from('import_history_tb2k4x9p1m')
      .select('*')
      .eq('user_email', user.email.toLowerCase())
      .order('timestamp', { ascending: false });

    if (error) throw error;

    return data?.map(record => ({
      id: parseInt(record.import_id),
      timestamp: record.timestamp,
      fileName: record.file_name,
      itemCount: record.item_count,
      status: record.status,
      items: JSON.parse(record.items || '[]'),
      totalValue: record.total_value,
      categories: JSON.parse(record.categories || '[]'),
      summary: JSON.parse(record.summary || '{}')
    })) || [];
  };

  // Sync all localStorage data to database
  const syncAllLocalStorageToDatabase = useCallback(async () => {
    if (!user?.email) return;

    try {
      setSyncStatus('syncing');

      // Sync export history
      const exportHistory = JSON.parse(localStorage.getItem(`taxExportHistory_${user.email}`) || '[]');
      if (exportHistory.length > 0) {
        await forceSyncToDatabase('export_history', exportHistory);
      }

      // Sync scan history
      const scanHistory = JSON.parse(localStorage.getItem(`scanHistory_${user.email}`) || '[]');
      if (scanHistory.length > 0) {
        await forceSyncToDatabase('scan_history', scanHistory);
      }

      // Sync import history
      const importHistory = JSON.parse(localStorage.getItem(`importHistory_${user.email}`) || '[]');
      if (importHistory.length > 0) {
        await forceSyncToDatabase('import_history', importHistory);
      }

      setSyncStatus('success');
      setLastSync(new Date().toISOString());

    } catch (error) {
      console.error('Error syncing all data:', error);
      setSyncStatus('error');
      setError(error.message);
    }
  }, [user?.email, forceSyncToDatabase]);

  return {
    syncStatus,
    lastSync,
    error,
    forceSyncToDatabase,
    loadFromDatabase,
    syncAllLocalStorageToDatabase
  };
};

export default useDataSync;