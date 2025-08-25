import { supabase } from '../lib/supabase';
import { logSecurityEvent } from '../utils/security';

// Enhanced database operations with automatic syncing
export class DatabaseSync {
  static async ensureTablesExist() {
    if (!supabase) return false;

    try {
      // Check if all required tables exist and create them if not
      const tables = [
        {
          name: 'users_tb2k4x9p1m',
          exists: false
        },
        {
          name: 'inventory_tb2k4x9p1m', 
          exists: false
        },
        {
          name: 'subscriptions_tb2k4x9p1m',
          exists: false
        },
        {
          name: 'export_history_tb2k4x9p1m',
          exists: false
        },
        {
          name: 'scan_history_tb2k4x9p1m',
          exists: false
        },
        {
          name: 'import_history_tb2k4x9p1m',
          exists: false
        }
      ];

      // Test each table by attempting a simple select
      for (const table of tables) {
        try {
          await supabase.from(table.name).select('*').limit(1);
          table.exists = true;
        } catch (error) {
          console.log(`Table ${table.name} may not exist:`, error);
        }
      }

      return tables.every(table => table.exists);
    } catch (error) {
      console.error('Error checking table existence:', error);
      return false;
    }
  }

  // Inventory operations with database sync
  static async saveInventoryItem(itemData, userEmail, forceSync = true) {
    if (!supabase || !forceSync) {
      return this.saveToLocalStorage('inventory', itemData, userEmail);
    }

    try {
      const dbItem = {
        name: itemData.name,
        category: itemData.category,
        quantity: itemData.quantity,
        description: itemData.description || '',
        unit_price: itemData.unitPrice,
        status: itemData.status,
        date_added: itemData.dateAdded,
        user_email: userEmail.toLowerCase(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('inventory_tb2k4x9p1m')
        .insert([dbItem])
        .select()
        .single();

      if (error) throw error;

      // Also save to localStorage as backup
      this.saveToLocalStorage('inventory', itemData, userEmail);

      logSecurityEvent('INVENTORY_ITEM_SAVED_DB', {
        userEmail,
        itemId: data.id,
        itemName: itemData.name
      });

      return {
        ...itemData,
        id: data.id,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error) {
      console.error('Error saving to database, falling back to localStorage:', error);
      return this.saveToLocalStorage('inventory', itemData, userEmail);
    }
  }

  static async updateInventoryItem(itemData, userEmail, forceSync = true) {
    if (!supabase || !forceSync || !itemData.id) {
      return this.updateInLocalStorage('inventory', itemData, userEmail);
    }

    try {
      const { data, error } = await supabase
        .from('inventory_tb2k4x9p1m')
        .update({
          name: itemData.name,
          category: itemData.category,
          quantity: itemData.quantity,
          description: itemData.description || '',
          unit_price: itemData.unitPrice,
          status: itemData.status,
          date_added: itemData.dateAdded,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemData.id)
        .eq('user_email', userEmail.toLowerCase())
        .select()
        .single();

      if (error) throw error;

      // Also update localStorage
      this.updateInLocalStorage('inventory', itemData, userEmail);

      logSecurityEvent('INVENTORY_ITEM_UPDATED_DB', {
        userEmail,
        itemId: itemData.id,
        itemName: itemData.name
      });

      return {
        ...itemData,
        updatedAt: data.updated_at
      };
    } catch (error) {
      console.error('Error updating in database, falling back to localStorage:', error);
      return this.updateInLocalStorage('inventory', itemData, userEmail);
    }
  }

  static async deleteInventoryItem(itemId, userEmail, forceSync = true) {
    if (!supabase || !forceSync) {
      return this.deleteFromLocalStorage('inventory', itemId, userEmail);
    }

    try {
      const { error } = await supabase
        .from('inventory_tb2k4x9p1m')
        .delete()
        .eq('id', itemId)
        .eq('user_email', userEmail.toLowerCase());

      if (error) throw error;

      // Also remove from localStorage
      this.deleteFromLocalStorage('inventory', itemId, userEmail);

      logSecurityEvent('INVENTORY_ITEM_DELETED_DB', {
        userEmail,
        itemId
      });

      return true;
    } catch (error) {
      console.error('Error deleting from database, falling back to localStorage:', error);
      return this.deleteFromLocalStorage('inventory', itemId, userEmail);
    }
  }

  // History operations with database sync
  static async saveToHistory(historyType, record, userEmail) {
    // Always save to localStorage first
    this.saveToLocalStorage(historyType, record, userEmail);

    // Then sync to database if available
    if (supabase) {
      try {
        await this.syncHistoryToDatabase(historyType, record, userEmail);
      } catch (error) {
        console.error(`Error syncing ${historyType} to database:`, error);
      }
    }
  }

  static async syncHistoryToDatabase(historyType, record, userEmail) {
    const tableName = `${historyType}_tb2k4x9p1m`;
    
    let dbRecord;
    switch (historyType) {
      case 'export_history':
        dbRecord = {
          user_email: userEmail.toLowerCase(),
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
        };
        break;

      case 'scan_history':
        dbRecord = {
          user_email: userEmail.toLowerCase(),
          scan_id: record.id.toString(),
          timestamp: record.timestamp,
          items: JSON.stringify(record.items || []),
          item_count: record.itemCount,
          total_value: record.totalValue,
          receipt_image: record.receiptImage || null,
          created_at: new Date().toISOString()
        };
        break;

      case 'import_history':
        dbRecord = {
          user_email: userEmail.toLowerCase(),
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
        };
        break;

      default:
        return;
    }

    const { error } = await supabase
      .from(tableName)
      .upsert([dbRecord], { 
        onConflict: `user_email,${historyType === 'export_history' ? 'export_id' : historyType === 'scan_history' ? 'scan_id' : 'import_id'}`,
        ignoreDuplicates: false 
      });

    if (error) throw error;

    logSecurityEvent(`${historyType.toUpperCase()}_SYNCED_TO_DB`, {
      userEmail,
      recordId: record.id
    });
  }

  // Load data from database with localStorage fallback
  static async loadFromDatabase(dataType, userEmail) {
    if (!supabase) {
      return this.loadFromLocalStorage(dataType, userEmail);
    }

    try {
      let data;
      switch (dataType) {
        case 'inventory':
          data = await this.loadInventoryFromDatabase(userEmail);
          break;
        case 'export_history':
          data = await this.loadExportHistoryFromDatabase(userEmail);
          break;
        case 'scan_history':
          data = await this.loadScanHistoryFromDatabase(userEmail);
          break;
        case 'import_history':
          data = await this.loadImportHistoryFromDatabase(userEmail);
          break;
        default:
          return null;
      }

      // Also sync to localStorage for offline access
      if (data && data.length > 0) {
        localStorage.setItem(`${dataType}_${userEmail}`, JSON.stringify(data));
      }

      return data;
    } catch (error) {
      console.error(`Error loading ${dataType} from database, falling back to localStorage:`, error);
      return this.loadFromLocalStorage(dataType, userEmail);
    }
  }

  static async loadInventoryFromDatabase(userEmail) {
    const { data, error } = await supabase
      .from('inventory_tb2k4x9p1m')
      .select('*')
      .eq('user_email', userEmail.toLowerCase())
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data?.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      description: item.description,
      unitPrice: item.unit_price,
      status: item.status,
      dateAdded: item.date_added,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    })) || [];
  }

  static async loadExportHistoryFromDatabase(userEmail) {
    const { data, error } = await supabase
      .from('export_history_tb2k4x9p1m')
      .select('*')
      .eq('user_email', userEmail.toLowerCase())
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
  }

  static async loadScanHistoryFromDatabase(userEmail) {
    const { data, error } = await supabase
      .from('scan_history_tb2k4x9p1m')
      .select('*')
      .eq('user_email', userEmail.toLowerCase())
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
  }

  static async loadImportHistoryFromDatabase(userEmail) {
    const { data, error } = await supabase
      .from('import_history_tb2k4x9p1m')
      .select('*')
      .eq('user_email', userEmail.toLowerCase())
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
  }

  // LocalStorage fallback methods
  static saveToLocalStorage(dataType, data, userEmail) {
    try {
      const key = `${dataType}_${userEmail}`;
      let existingData = JSON.parse(localStorage.getItem(key) || '[]');
      
      if (Array.isArray(existingData)) {
        existingData.unshift(data);
        existingData = existingData.slice(0, 100); // Keep last 100 records
      } else {
        existingData = [data];
      }
      
      localStorage.setItem(key, JSON.stringify(existingData));
      return data;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      return data;
    }
  }

  static updateInLocalStorage(dataType, data, userEmail) {
    try {
      const key = `${dataType}_${userEmail}`;
      let existingData = JSON.parse(localStorage.getItem(key) || '[]');
      
      if (Array.isArray(existingData)) {
        const index = existingData.findIndex(item => item.id === data.id);
        if (index !== -1) {
          existingData[index] = data;
          localStorage.setItem(key, JSON.stringify(existingData));
        }
      }
      
      return data;
    } catch (error) {
      console.error('Error updating in localStorage:', error);
      return data;
    }
  }

  static deleteFromLocalStorage(dataType, itemId, userEmail) {
    try {
      const key = `${dataType}_${userEmail}`;
      let existingData = JSON.parse(localStorage.getItem(key) || '[]');
      
      if (Array.isArray(existingData)) {
        existingData = existingData.filter(item => item.id !== itemId);
        localStorage.setItem(key, JSON.stringify(existingData));
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting from localStorage:', error);
      return false;
    }
  }

  static loadFromLocalStorage(dataType, userEmail) {
    try {
      const key = `${dataType}_${userEmail}`;
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      return [];
    }
  }

  // Comprehensive sync operation
  static async performFullSync(userEmail) {
    if (!supabase || !userEmail) return false;

    try {
      logSecurityEvent('FULL_SYNC_STARTED', { userEmail });

      // Sync all localStorage data to database
      const syncOperations = [];

      // Export history
      const exportHistory = this.loadFromLocalStorage('taxExportHistory', userEmail);
      if (exportHistory.length > 0) {
        syncOperations.push(this.syncExportHistoryToDatabase(exportHistory, userEmail));
      }

      // Scan history
      const scanHistory = this.loadFromLocalStorage('scanHistory', userEmail);
      if (scanHistory.length > 0) {
        syncOperations.push(this.syncScanHistoryToDatabase(scanHistory, userEmail));
      }

      // Import history
      const importHistory = this.loadFromLocalStorage('importHistory', userEmail);
      if (importHistory.length > 0) {
        syncOperations.push(this.syncImportHistoryToDatabase(importHistory, userEmail));
      }

      await Promise.all(syncOperations);

      logSecurityEvent('FULL_SYNC_COMPLETED', { 
        userEmail, 
        operationCount: syncOperations.length 
      });

      return true;
    } catch (error) {
      console.error('Full sync error:', error);
      logSecurityEvent('FULL_SYNC_ERROR', { 
        userEmail, 
        error: error.message 
      });
      return false;
    }
  }

  static async syncExportHistoryToDatabase(exportHistory, userEmail) {
    // Clear existing history
    await supabase
      .from('export_history_tb2k4x9p1m')
      .delete()
      .eq('user_email', userEmail.toLowerCase());

    // Insert all records
    const historyData = exportHistory.map(record => ({
      user_email: userEmail.toLowerCase(),
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

    if (historyData.length > 0) {
      const { error } = await supabase
        .from('export_history_tb2k4x9p1m')
        .insert(historyData);

      if (error) throw error;
    }
  }

  static async syncScanHistoryToDatabase(scanHistory, userEmail) {
    // Clear existing history
    await supabase
      .from('scan_history_tb2k4x9p1m')
      .delete()
      .eq('user_email', userEmail.toLowerCase());

    // Insert all records
    const historyData = scanHistory.map(record => ({
      user_email: userEmail.toLowerCase(),
      scan_id: record.id.toString(),
      timestamp: record.timestamp,
      items: JSON.stringify(record.items || []),
      item_count: record.itemCount,
      total_value: record.totalValue,
      receipt_image: record.receiptImage || null,
      created_at: new Date().toISOString()
    }));

    if (historyData.length > 0) {
      const { error } = await supabase
        .from('scan_history_tb2k4x9p1m')
        .insert(historyData);

      if (error) throw error;
    }
  }

  static async syncImportHistoryToDatabase(importHistory, userEmail) {
    // Clear existing history
    await supabase
      .from('import_history_tb2k4x9p1m')
      .delete()
      .eq('user_email', userEmail.toLowerCase());

    // Insert all records
    const historyData = importHistory.map(record => ({
      user_email: userEmail.toLowerCase(),
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

    if (historyData.length > 0) {
      const { error } = await supabase
        .from('import_history_tb2k4x9p1m')
        .insert(historyData);

      if (error) throw error;
    }
  }
}

export default DatabaseSync;