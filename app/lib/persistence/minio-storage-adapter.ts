// app/lib/persistence/minio-storage-adapter.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getEnvVar } from '~/utils/express-context-adapter.server';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';

/**
 * Adapter for file storage in MinIO (S3-compatible)
 * 
 * This adapter manages storage of code files and other project assets
 * following the structure: {userId}/{conversationId}/{projectPath}/{fileName}
 */
export class MinioStorageAdapter {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(context?: ExpressAppContext) {
    // Get configuration from environment variables using Express context adapter
    const storageUrl = context ? 
      getEnvVar(context, 'SUPABASE_STORAGE_URL') : 
      process.env.SUPABASE_STORAGE_URL || "https://supabase.cantodorei.com.br/storage/v1";
    
    const serviceUser = context ? 
      getEnvVar(context, 'SERVICE_USER_MINIO') : 
      process.env.SERVICE_USER_MINIO || "cdrminio";
    
    const servicePassword = context ? 
      getEnvVar(context, 'SERVICE_PASSWORD_MINIO') : 
      process.env.SERVICE_PASSWORD_MINIO || "";

    // Initialize the S3 client for MinIO
    this.s3Client = new S3Client({
      region: "auto",
      endpoint: storageUrl,
      credentials: {
        accessKeyId: serviceUser,
        secretAccessKey: servicePassword,
      },
      forcePathStyle: true, // Required for MinIO
      customUserAgent: "bolt-app-client" // For security policy
    });

    this.bucketName = "bolt-app-files";
  }

  /**
   * Constructs a file path in the format {userId}/{conversationId}/{filePath}
   */
  private buildFilePath(userId: string, conversationId: string, filePath: string): string {
    // Normalize the filePath removing initial slashes
    const normalizedFilePath = filePath.replace(/^\/+/, '');
    return `${userId}/${conversationId}/${normalizedFilePath}`;
  }

  /**
   * Saves a file to MinIO
   * 
   * @param userId User ID
   * @param conversationId Conversation/project ID
   * @param filePath Path within the project
   * @param content File content (text or buffer)
   * @param contentType MIME type of the content
   * @returns Promise resolving to the complete file path
   */
  async saveFile(
    userId: string, 
    conversationId: string, 
    filePath: string, 
    content: string | Buffer,
    contentType: string = 'text/plain'
  ): Promise<string> {
    const fileKey = this.buildFilePath(userId, conversationId, filePath);
    const fileContent = typeof content === 'string' ? Buffer.from(content) : content;
    
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        Body: fileContent,
        ContentType: contentType
      });
      
      await this.s3Client.send(command);
      return fileKey;
    } catch (error) {
      console.error("Error saving file to MinIO:", error);
      throw new Error(`Failed to save file: ${filePath}. Error: ${error}`);
    }
  }

  /**
   * Loads a file from MinIO
   * 
   * @param userId User ID
   * @param conversationId Conversation/project ID
   * @param filePath Path within the project
   * @param asText Whether to return content as text (true) or buffer (false)
   * @returns Promise resolving to file content
   */
  async loadFile(
    userId: string, 
    conversationId: string, 
    filePath: string,
    asText: boolean = true
  ): Promise<string | Buffer> {
    const fileKey = this.buildFilePath(userId, conversationId, filePath);
    
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey
      });
      
      const response = await this.s3Client.send(command);
      if (!response.Body) {
        throw new Error("Empty file body");
      }
      
      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      
      const fileBuffer = Buffer.concat(chunks);
      
      // Return as text or buffer as requested
      return asText ? fileBuffer.toString('utf-8') : fileBuffer;
    } catch (error) {
      console.error("Error loading file from MinIO:", error);
      throw new Error(`Failed to load file: ${filePath}. Error: ${error}`);
    }
  }

  /**
   * Deletes a file from MinIO
   * 
   * @param userId User ID
   * @param conversationId Conversation/project ID
   * @param filePath Path within the project
   * @returns Promise that resolves when deletion is complete
   */
  async deleteFile(userId: string, conversationId: string, filePath: string): Promise<void> {
    const fileKey = this.buildFilePath(userId, conversationId, filePath);
    
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey
      });
      
      await this.s3Client.send(command);
    } catch (error) {
      console.error("Error deleting file from MinIO:", error);
      throw new Error(`Failed to delete file: ${filePath}. Error: ${error}`);
    }
  }

  /**
   * Checks if a file exists in MinIO
   * 
   * @param userId User ID
   * @param conversationId Conversation/project ID
   * @param filePath Path within the project
   * @returns Promise resolving to true if file exists
   */
  async fileExists(userId: string, conversationId: string, filePath: string): Promise<boolean> {
    const fileKey = this.buildFilePath(userId, conversationId, filePath);
    
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey
      });
      
      await this.s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Renames a file in MinIO (copy followed by delete)
   * 
   * @param userId User ID
   * @param conversationId Conversation/project ID
   * @param oldPath Current file path
   * @param newPath New file path
   * @returns Promise that resolves when renaming is complete
   */
  async renameFile(
    userId: string, 
    conversationId: string, 
    oldPath: string, 
    newPath: string
  ): Promise<void> {
    try {
      // Load the original file
      const fileContent = await this.loadFile(userId, conversationId, oldPath, false);
      
      // Save with the new name
      await this.saveFile(userId, conversationId, newPath, fileContent as Buffer);
      
      // Delete the original file
      await this.deleteFile(userId, conversationId, oldPath);
    } catch (error) {
      console.error("Error renaming file in MinIO:", error);
      throw new Error(`Failed to rename file from ${oldPath} to ${newPath}. Error: ${error}`);
    }
  }
}

// Export a singleton instance of the adapter
export const minioStorageAdapter = new MinioStorageAdapter();
