// app/lib/persistence/enhanced-supabase-adapter.ts
import { SupabasePersistenceAdapter } from './supabase-persistence-adapter';
import { minioStorageAdapter } from './minio-storage-adapter';
import type { FilePersistence } from './persistence-adapter';
import { getEnvVar } from '~/utils/express-context-adapter.server';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';

/**
 * Enhanced Supabase adapter that integrates file storage with MinIO
 * 
 * This adapter extends the standard SupabasePersistenceAdapter, but redirects
 * file operations to MinIO, while keeping metadata in PostgreSQL.
 */
export class EnhancedSupabasePersistenceAdapter extends SupabasePersistenceAdapter {
  constructor() {
    super();
  }

  /**
   * Saves a file, storing content in MinIO and metadata in PostgreSQL
   * 
   * @param userId User ID
   * @param conversationId Conversation/project ID
   * @param filePath File path
   * @param content File content
   * @param metadata File metadata
   * @returns Promise that resolves when the file is saved
   */
  async saveFile(
    userId: string,
    conversationId: string,
    filePath: string,
    content: string,
    metadata: any = {}
  ): Promise<void> {
    try {
      // 1. Save content to MinIO
      const contentType = this.determineContentType(filePath);
      await minioStorageAdapter.saveFile(userId, conversationId, filePath, content, contentType);

      // 2. Save only metadata in PostgreSQL
      // Modifying the original method to store only a reference, not content
      const fileMetadata = {
        ...metadata,
        path: filePath,
        // Save only the reference to the file, not its content
        storageLocation: 'minio', // Indicates where the file is stored
        minioPath: `${userId}/${conversationId}/${filePath}`, // Path in MinIO
        lastModified: new Date().toISOString()
      };

      // Call the parent method to save metadata in PostgreSQL
      // But replace content with a reference to MinIO
      await super.saveFile(userId, conversationId, filePath, "CONTENT_IN_MINIO", fileMetadata);
    } catch (error) {
      console.error("Error saving file with MinIO:", error);
      throw new Error(`Failed to save file ${filePath}: ${error}`);
    }
  }

  /**
   * Loads a file, getting content from MinIO
   * 
   * @param userId User ID
   * @param conversationId Conversation/project ID
   * @param filePath File path
   * @returns Promise that resolves with file content
   */
  async loadFile(userId: string, conversationId: string, filePath: string): Promise<string> {
    try {
      // First, check if file exists in MinIO
      const exists = await minioStorageAdapter.fileExists(userId, conversationId, filePath);
      
      if (exists) {
        // If it exists in MinIO, load from there
        const content = await minioStorageAdapter.loadFile(userId, conversationId, filePath);
        return content as string;
      } else {
        // If not in MinIO, try to load from Supabase
        // Useful for migration or fallback
        try {
          const content = await super.loadFile(userId, conversationId, filePath);
          
          // If content was loaded from Supabase successfully, migrate to MinIO
          if (content && content !== "CONTENT_IN_MINIO") {
            const contentType = this.determineContentType(filePath);
            await minioStorageAdapter.saveFile(userId, conversationId, filePath, content, contentType);
            
            // Update metadata in Supabase to indicate it's in MinIO
            const fileMetadata = {
              path: filePath,
              storageLocation: 'minio',
              minioPath: `${userId}/${conversationId}/${filePath}`,
              lastModified: new Date().toISOString()
            };
            
            await super.saveFile(userId, conversationId, filePath, "CONTENT_IN_MINIO", fileMetadata);
          }
          
          return content;
        } catch (supabaseError) {
          throw new Error(`File not found in MinIO or Supabase: ${filePath}`);
        }
      }
    } catch (error) {
      console.error("Error loading file with MinIO:", error);
      throw new Error(`Failed to load file ${filePath}: ${error}`);
    }
  }

  /**
   * Deletes a file, removing it from MinIO and its metadata from PostgreSQL
   * 
   * @param userId User ID
   * @param conversationId Conversation/project ID
   * @param filePath File path
   * @returns Promise that resolves when the file is deleted
   */
  async deleteFile(userId: string, conversationId: string, filePath: string): Promise<void> {
    try {
      // 1. Delete from MinIO
      try {
        await minioStorageAdapter.deleteFile(userId, conversationId, filePath);
      } catch (minioError) {
        console.warn("Error deleting from MinIO, may already be deleted:", minioError);
      }
      
      // 2. Delete metadata from PostgreSQL
      await super.deleteFile(userId, conversationId, filePath);
    } catch (error) {
      console.error("Error deleting file with MinIO:", error);
      throw new Error(`Failed to delete file ${filePath}: ${error}`);
    }
  }

  /**
   * Determines MIME type based on file extension
   * 
   * @param filePath File path
   * @returns MIME type
   */
  private determineContentType(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    
    const mimeTypes: Record<string, string> = {
      'js': 'application/javascript',
      'jsx': 'application/javascript',
      'ts': 'application/typescript',
      'tsx': 'application/typescript',
      'html': 'text/html',
      'css': 'text/css',
      'json': 'application/json',
      'md': 'text/markdown',
      'txt': 'text/plain',
      'svg': 'image/svg+xml',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'pdf': 'application/pdf',
    };
    
    return mimeTypes[extension] || 'text/plain';
  }
}

// Export a singleton instance of the enhanced adapter
export const enhancedSupabasePersistenceAdapter = new EnhancedSupabasePersistenceAdapter();
