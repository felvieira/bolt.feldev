// app/lib/persistence/minio-storage-adapter.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

/**
 * Adaptador para armazenamento de arquivos no MinIO (compatível com S3)
 * 
 * Este adaptador gerencia o armazenamento de arquivos de código e outros ativos do projeto
 * seguindo a estrutura: {userId}/{conversationId}/{projectPath}/{fileName}
 */
export class MinioStorageAdapter {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    // Inicializa o cliente S3 para o MinIO
    this.s3Client = new S3Client({
      region: "auto",
      endpoint: process.env.SUPABASE_STORAGE_URL || "https://supabase.cantodorei.com.br/storage/v1",
      credentials: {
        accessKeyId: process.env.SERVICE_USER_MINIO || "cdrminio",
        secretAccessKey: process.env.SERVICE_PASSWORD_MINIO || "",
      },
      forcePathStyle: true, // Necessário para MinIO
      customUserAgent: "bolt-app-client" // Para atender à política de segurança
    });

    this.bucketName = "bolt-app-files";
  }

  /**
   * Constrói um caminho de arquivo no formato {userId}/{conversationId}/{filePath}
   */
  private buildFilePath(userId: string, conversationId: string, filePath: string): string {
    // Normaliza o filePath removendo barras iniciais
    const normalizedFilePath = filePath.replace(/^\/+/, '');
    return `${userId}/${conversationId}/${normalizedFilePath}`;
  }

  /**
   * Salva um arquivo no MinIO
   * 
   * @param userId ID do usuário
   * @param conversationId ID da conversa/projeto
   * @param filePath Caminho do arquivo dentro do projeto
   * @param content Conteúdo do arquivo (texto ou buffer)
   * @param contentType Tipo MIME do conteúdo
   * @returns Promise que resolve com o caminho completo do arquivo
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
      console.error("Erro ao salvar arquivo no MinIO:", error);
      throw new Error(`Falha ao salvar arquivo: ${filePath}. Erro: ${error}`);
    }
  }

  /**
   * Carrega um arquivo do MinIO
   * 
   * @param userId ID do usuário
   * @param conversationId ID da conversa/projeto
   * @param filePath Caminho do arquivo dentro do projeto
   * @param asText Se verdadeiro, retorna o conteúdo como string
   * @returns Promise que resolve com o conteúdo do arquivo (Buffer ou string)
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
        throw new Error("Corpo do arquivo vazio");
      }
      
      // Converte o stream para buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      
      const fileBuffer = Buffer.concat(chunks);
      
      // Retorna como texto ou buffer conforme solicitado
      return asText ? fileBuffer.toString('utf-8') : fileBuffer;
    } catch (error) {
      console.error("Erro ao carregar arquivo do MinIO:", error);
      throw new Error(`Falha ao carregar arquivo: ${filePath}. Erro: ${error}`);
    }
  }

  /**
   * Exclui um arquivo do MinIO
   * 
   * @param userId ID do usuário
   * @param conversationId ID da conversa/projeto
   * @param filePath Caminho do arquivo dentro do projeto
   * @returns Promise que resolve quando o arquivo é excluído
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
      console.error("Erro ao excluir arquivo do MinIO:", error);
      throw new Error(`Falha ao excluir arquivo: ${filePath}. Erro: ${error}`);
    }
  }

  /**
   * Verifica se um arquivo existe no MinIO
   * 
   * @param userId ID do usuário
   * @param conversationId ID da conversa/projeto
   * @param filePath Caminho do arquivo dentro do projeto
   * @returns Promise que resolve com true se o arquivo existir
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
   * Renomeia um arquivo no MinIO (cópia seguida de exclusão)
   * 
   * @param userId ID do usuário
   * @param conversationId ID da conversa/projeto
   * @param oldPath Caminho atual do arquivo
   * @param newPath Novo caminho do arquivo
   * @returns Promise que resolve quando o arquivo é renomeado
   */
  async renameFile(
    userId: string, 
    conversationId: string, 
    oldPath: string, 
    newPath: string
  ): Promise<void> {
    try {
      // Carregamos o arquivo original
      const fileContent = await this.loadFile(userId, conversationId, oldPath, false);
      
      // Salvamos com o novo nome
      await this.saveFile(userId, conversationId, newPath, fileContent as Buffer);
      
      // Excluímos o arquivo original
      await this.deleteFile(userId, conversationId, oldPath);
    } catch (error) {
      console.error("Erro ao renomear arquivo no MinIO:", error);
      throw new Error(`Falha ao renomear arquivo de ${oldPath} para ${newPath}. Erro: ${error}`);
    }
  }
}

// Exporta uma instância singleton do adaptador
export const minioStorageAdapter = new MinioStorageAdapter();
