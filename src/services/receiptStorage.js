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
      console.log('Uploading receipt for user:', user.email);

      // Generate consistent user ID for storage
      const userId = this.generateUserId(user.email);

      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const fileName = `${user.email.replace('@', '_at_')}_${timestamp}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      console.log('Uploading receipt to path:', filePath);

      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
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
      console.error('Error uploading receipt:', error);
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
      this.getCurrentUser();

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
      this.getCurrentUser();

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

  async saveReceiptRecord(receiptData, userEmail) {
    try {
      if (!supabase) {
        console.log('Supabase not available, skipping receipt record save');
        return null;
      }

      // Get current user from our session system
      const user = this.getCurrentUser();
      console.log('Saving receipt record for user:', user.email);

      const receiptRecord = {
        user_email: user.email,
        storage_path: receiptData.storagePath,
        file_name: receiptData.fileName,
        file_size: receiptData.fileSize,
        mime_type: receiptData.mimeType,
        scanned_items: receiptData.scannedItems || [],
        total_items: receiptData.scannedItems?.length || 0,
        scan_status: receiptData.scanStatus || 'completed',
        ocr_text: receiptData.ocrText || null
      };

      console.log('Inserting receipt record:', {
        ...receiptRecord,
        scanned_items: `[${receiptRecord.scanned_items.length} items]`,
        ocr_text: receiptRecord.ocr_text ? `${receiptRecord.ocr_text.length} chars` : null
      });

      const { data, error } = await supabase
        .from('receipts')
        .insert(receiptRecord)
        .select()
        .single();

      if (error) {
        console.error('Database insert error:', error);
        throw new Error(`Database insert failed: ${error.message}`);
      }

      console.log('✅ Receipt record saved:', data.id);
      return data;
    } catch (error) {
      console.error('Error saving receipt record:', error);
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

  async getUserReceipts(userEmail, limit = 50) {
    try {
      if (!supabase) {
        console.log('Supabase not available, returning empty receipts');
        return [];
      }

      // Get current user from our session system
      const user = this.getCurrentUser();
      console.log('Getting receipts for user:', user.email);

      // Query by email
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('user_email', user.email)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Database query error:', error);
        throw new Error(`Database query failed: ${error.message}`);
      }

      console.log('✅ Retrieved receipts:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('Error getting user receipts:', error);
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
}

export default new ReceiptStorageService();