import supabase from '../lib/supabase';
import { validateSession } from '../utils/security';

const STORAGE_BUCKET = 'receipts';

class ReceiptStorageService {
  constructor() {
    this.initializeBucket();
  }

  async initializeBucket() {
    try {
      if (!supabase) {
        console.log('Supabase not available, skipping receipt storage initialization');
        return;
      }

      // Check if bucket exists, create if not
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(bucket => bucket.name === STORAGE_BUCKET);
      
      if (!bucketExists) {
        const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, {
          public: false,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          fileSizeLimit: 10485760 // 10MB
        });
        
        if (error) {
          console.error('Error creating receipts bucket:', error);
        } else {
          console.log('✅ Created receipts storage bucket');
        }
      }
    } catch (error) {
      console.error('Error initializing receipt storage:', error);
    }
  }

  getCurrentUser() {
    try {
      // Use our custom session system
      const session = validateSession();
      
      if (!session || !session.user) {
        throw new Error('Auth session missing!');
      }

      console.log('Current authenticated user from session:', session.user);
      return session.user;
    } catch (error) {
      console.error('Error getting current user from session:', error);
      throw error;
    }
  }

  generateUserId(email) {
    // Generate a consistent user ID from email for storage organization
    const hash = email.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return Math.abs(hash).toString(36);
  }

  async uploadReceipt(file, userEmail) {
    try {
      if (!supabase) {
        throw new Error('Supabase not available');
      }

      // Get current user from our session system
      const user = this.getCurrentUser();
      console.log('🔄 Uploading receipt for user:', user.email);

      // Validate that the userEmail matches the authenticated user
      if (userEmail && userEmail !== user.email) {
        throw new Error('User email mismatch');
      }

      // Generate consistent user ID for storage
      const userId = this.generateUserId(user.email);

      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const fileName = `${user.email.replace('@', '_at_')}_${timestamp}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      console.log('📁 Uploading receipt to path:', filePath);

      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('❌ Storage upload error:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      console.log('✅ Receipt uploaded successfully:', data.path);
      return {
        path: data.path,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        userId: userId
      };
    } catch (error) {
      console.error('❌ Error uploading receipt:', error);
      throw error;
    }
  }

  async getReceiptUrl(storagePath) {
    try {
      if (!supabase) {
        console.log('Supabase not available');
        return null;
      }

      // Ensure user is authenticated
      const user = this.getCurrentUser();

      const { data } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, 3600); // 1 hour expiry

      return data?.signedUrl;
    } catch (error) {
      console.error('Error getting receipt URL:', error);
      return null;
    }
  }

  async deleteReceipt(storagePath) {
    try {
      if (!supabase) {
        throw new Error('Supabase not available');
      }

      // Ensure user is authenticated
      const user = this.getCurrentUser();

      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([storagePath]);

      if (error) {
        throw new Error(`Delete failed: ${error.message}`);
      }

      console.log('✅ Receipt deleted:', storagePath);
      return true;
    } catch (error) {
      console.error('Error deleting receipt:', error);
      throw error;
    }
  }

  async saveReceiptRecord(receiptData, userEmail = null) {
    try {
      if (!supabase) {
        console.log('❌ Supabase not available, skipping receipt record save');
        return null;
      }

      // Get current user from our session system
      const user = this.getCurrentUser();
      console.log('💾 Saving receipt record for user:', user.email);

      // Validate that userEmail matches if provided
      if (userEmail && userEmail !== user.email) {
        throw new Error('User email mismatch in receipt save');
      }

      // Ensure we have all required data
      if (!receiptData.storagePath) {
        throw new Error('Missing storage path for receipt');
      }

      if (!receiptData.fileName) {
        throw new Error('Missing file name for receipt');
      }

      console.log('📝 Saving receipt with data:', {
        user_email: user.email,
        storage_path: receiptData.storagePath,
        file_name: receiptData.fileName,
        total_items: receiptData.scannedItems?.length || 0,
        scan_status: receiptData.scanStatus || 'completed'
      });

      // 🔐 PRIMARY STRATEGY: Use secure RPC function (SECURITY DEFINER bypasses RLS safely)
      console.log('🔄 Using secure RPC function for receipt save...');
      try {
        const { data: rpcResult, error: rpcError } = await supabase.rpc('insert_receipt_secure', {
          p_user_email: user.email,
          p_storage_path: receiptData.storagePath,
          p_file_name: receiptData.fileName,
          p_file_size: receiptData.fileSize || null,
          p_mime_type: receiptData.mimeType || null,
          p_scanned_items: receiptData.scannedItems || [],
          p_total_items: receiptData.scannedItems?.length || 0,
          p_scan_status: receiptData.scanStatus || 'completed',
          p_ocr_text: receiptData.ocrText || null
        });

        if (!rpcError && rpcResult) {
          console.log('✅ PRIMARY SUCCESS: Receipt saved via secure RPC function:', rpcResult);
          
          // Return the receipt record for consistency
          const { data: savedReceipt, error: fetchError } = await supabase
            .from('receipts')
            .select('*')
            .eq('id', rpcResult)
            .single();

          if (!fetchError && savedReceipt) {
            return savedReceipt;
          }
          
          // If we can't fetch the full record, return minimal data
          return { id: rpcResult, user_email: user.email };
        } else {
          console.log('❌ RPC function failed:', rpcError?.message);
        }
      } catch (error) {
        console.log('❌ RPC function exception:', error.message);
      }

      // 🔐 FALLBACK STRATEGY: Direct insert with proper RLS context
      console.log('🔄 Attempting direct insert with RLS...');
      try {
        const receiptRecord = {
          user_email: user.email,
          storage_path: receiptData.storagePath,
          file_name: receiptData.fileName,
          file_size: receiptData.fileSize || null,
          mime_type: receiptData.mimeType || null,
          scanned_items: receiptData.scannedItems || [],
          total_items: receiptData.scannedItems?.length || 0,
          scan_status: receiptData.scanStatus || 'completed',
          ocr_text: receiptData.ocrText || null
        };

        const { data: directResult, error: directError } = await supabase
          .from('receipts')
          .insert(receiptRecord)
          .select()
          .single();

        if (!directError && directResult) {
          console.log('✅ FALLBACK SUCCESS: Receipt saved via direct insert:', directResult.id);
          return directResult;
        } else {
          console.log('❌ Direct insert failed:', directError?.message);
        }
      } catch (error) {
        console.log('❌ Direct insert exception:', error.message);
      }

      // If both strategies failed, provide helpful error
      console.error('💥 ALL STRATEGIES FAILED');
      console.error('🔧 SOLUTION: Run the SECURE_RLS_FIX.sql script in Supabase Dashboard');
      
      throw new Error(`Receipt save failed: RLS policies need configuration. Please run the SECURE_RLS_FIX.sql script in your Supabase Dashboard.`);

    } catch (error) {
      console.error('❌ Error saving receipt record:', error);
      throw error;
    }
  }

  async updateReceiptRecord(receiptId, updates) {
    try {
      if (!supabase) {
        throw new Error('Supabase not available');
      }

      // Ensure user is authenticated
      const user = this.getCurrentUser();

      // Try secure update function first
      try {
        const { data: updateResult, error: updateError } = await supabase.rpc('update_receipt_secure', {
          p_receipt_id: receiptId,
          p_user_email: user.email,
          p_scanned_items: updates.scanned_items || null,
          p_total_items: updates.total_items || null,
          p_scan_status: updates.scan_status || null,
          p_ocr_text: updates.ocr_text || null
        });

        if (!updateError && updateResult) {
          console.log('✅ Receipt updated via secure function:', receiptId);
          
          // Fetch and return updated record
          const { data, error } = await supabase
            .from('receipts')
            .select('*')
            .eq('id', receiptId)
            .eq('user_email', user.email)
            .single();

          return data;
        }
      } catch (error) {
        console.log('Secure update function failed, trying direct update:', error.message);
      }

      // Fallback to direct update
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('receipts')
        .update(updateData)
        .eq('id', receiptId)
        .eq('user_email', user.email)
        .select()
        .single();

      if (error) {
        throw new Error(`Database update failed: ${error.message}`);
      }

      console.log('✅ Receipt record updated:', receiptId);
      return data;
    } catch (error) {
      console.error('Error updating receipt record:', error);
      throw error;
    }
  }

  async getUserReceipts(userEmail = null, limit = 50) {
    try {
      if (!supabase) {
        console.log('Supabase not available, returning empty receipts');
        return [];
      }

      // Get current user from our session system
      const user = this.getCurrentUser();
      console.log('📋 Getting receipts for user:', user.email);

      // Validate userEmail if provided
      if (userEmail && userEmail !== user.email) {
        console.warn('User email mismatch in getUserReceipts, using authenticated user');
      }

      // Query receipts for the authenticated user
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('user_email', user.email)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Database query error:', error);
        return [];
      }

      console.log('✅ Retrieved receipts:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('❌ Error getting user receipts:', error);
      return [];
    }
  }

  async deleteReceiptRecord(receiptId) {
    try {
      if (!supabase) {
        throw new Error('Supabase not available');
      }

      // Ensure user is authenticated
      const user = this.getCurrentUser();

      // First get the receipt to find storage path and verify ownership
      const { data: receipt, error: fetchError } = await supabase
        .from('receipts')
        .select('storage_path, user_email')
        .eq('id', receiptId)
        .eq('user_email', user.email)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch receipt: ${fetchError.message}`);
      }

      if (!receipt) {
        throw new Error('Receipt not found or access denied');
      }

      // Delete from storage
      if (receipt.storage_path) {
        await this.deleteReceipt(receipt.storage_path);
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from('receipts')
        .delete()
        .eq('id', receiptId)
        .eq('user_email', user.email);

      if (deleteError) {
        throw new Error(`Database delete failed: ${deleteError.message}`);
      }

      console.log('✅ Receipt record deleted:', receiptId);
      return true;
    } catch (error) {
      console.error('Error deleting receipt record:', error);
      throw error;
    }
  }

  // Debug method to test database connection
  async testConnection() {
    try {
      if (!supabase) {
        return { success: false, error: 'Supabase not available' };
      }

      const user = this.getCurrentUser();
      if (!user) {
        return { success: false, error: 'No authenticated user' };
      }

      // Test basic query
      const { data, error } = await supabase
        .from('receipts')
        .select('id')
        .eq('user_email', user.email)
        .limit(1);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, user: user.email, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default new ReceiptStorageService();