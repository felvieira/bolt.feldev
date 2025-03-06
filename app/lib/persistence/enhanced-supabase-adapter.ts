// app/lib/persistence/enhanced-supabase-adapter.ts
import { SupabasePersistenceAdapter } from './supabase-persistence-adapter';
import { minioStorageAdapter } from './minio-storage-adapter';
import type { FilePersistence } from './persistence-adapter';

/**
 * Adaptador melhorado do Supabase que integra armazenamento de arquivos no MinIO
 * 
 * Este adaptador estende o SupabasePersistenceAdapter padrão, mas redireciona
 * as operações de arquivo para o MinIO, mantendo os metadados no PostgreSQL.
 */
export class EnhancedSupabasePersistenceAdapter extends SupabasePersistenceAdapter {
  constructor() {
    super();
  }

  /**
   * Salva um arquivo, armazenando o conteúdo no MinIO e metadados no PostgreSQL
   * 
   * @param userId ID do usuário
   * @param conversationId ID da conversa/projeto
   * @param filePath Caminho do arquivo
   * @param content Conteúdo do arquivo
   * @param metadata Metadados do arquivo
   * @returns Promise que resolve quando o arquivo é salvo
   */
  async saveFile(
    userId: string,
    conversationId: string,
    filePath: string,
    content: string,
    metadata: any = {}
  ): Promise<void> {
    try {
      // 1. Salvar o conteúdo no MinIO
      const contentType = this.determineContentType(filePath);
      await minioStorageAdapter.saveFile(userId, conversationId, filePath, content, contentType);

      // 2. Salvar apenas metadados no PostgreSQL
      // Modificando o método original para não armazenar o conteúdo, apenas uma referência
      const fileMetadata = {
        ...metadata,
        path: filePath,
        // Salvamos apenas a referência ao arquivo, não seu conteúdo
        storageLocation: 'minio', // Indica onde o arquivo está armazenado
        minioPath: `${userId}/${conversationId}/${filePath}`, // Caminho no MinIO
        lastModified: new Date().toISOString()
      };

      // Chamar o método original para salvar os metadados no PostgreSQL
      // Mas substituir o conteúdo por uma referência ao MinIO
      await super.saveFile(userId, conversationId, filePath, "CONTENT_IN_MINIO", fileMetadata);
    } catch (error) {
      console.error("Erro ao salvar arquivo com MinIO:", error);
      throw new Error(`Falha ao salvar arquivo ${filePath}: ${error}`);
    }
  }

  /**
   * Carrega um arquivo, obtendo seu conteúdo do MinIO
   * 
   * @param userId ID do usuário
   * @param conversationId ID da conversa/projeto
   * @param filePath Caminho do arquivo
   * @returns Promise que resolve com o conteúdo do arquivo
   */
  async loadFile(userId: string, conversationId: string, filePath: string): Promise<string> {
    try {
      // Primeiro, verificar se o arquivo existe no MinIO
      const exists = await minioStorageAdapter.fileExists(userId, conversationId, filePath);
      
      if (exists) {
        // Se existir no MinIO, carregamos de lá
        const content = await minioStorageAdapter.loadFile(userId, conversationId, filePath);
        return content as string;
      } else {
        // Se não existir no MinIO, tentamos carregar do Supabase
        // Isso é útil para migração ou fallback
        try {
          const content = await super.loadFile(userId, conversationId, filePath);
          
          // Se o conteúdo foi carregado do Supabase com sucesso, migramos para o MinIO
          if (content && content !== "CONTENT_IN_MINIO") {
            const contentType = this.determineContentType(filePath);
            await minioStorageAdapter.saveFile(userId, conversationId, filePath, content, contentType);
            
            // Atualizar metadados no Supabase para indicar que está no MinIO
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
          throw new Error(`Arquivo não encontrado no MinIO nem no Supabase: ${filePath}`);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar arquivo com MinIO:", error);
      throw new Error(`Falha ao carregar arquivo ${filePath}: ${error}`);
    }
  }

  /**
   * Exclui um arquivo, removendo-o do MinIO e seus metadados do PostgreSQL
   * 
   * @param userId ID do usuário
   * @param conversationId ID da conversa/projeto
   * @param filePath Caminho do arquivo
   * @returns Promise que resolve quando o arquivo é excluído
   */
  async deleteFile(userId: string, conversationId: string, filePath: string): Promise<void> {
    try {
      // 1. Excluir do MinIO
      try {
        await minioStorageAdapter.deleteFile(userId, conversationId, filePath);
      } catch (minioError) {
        console.warn("Erro ao excluir do MinIO, pode já ter sido excluído:", minioError);
      }
      
      // 2. Excluir metadados do PostgreSQL
      await super.deleteFile(userId, conversationId, filePath);
    } catch (error) {
      console.error("Erro ao excluir arquivo com MinIO:", error);
      throw new Error(`Falha ao excluir arquivo ${filePath}: ${error}`);
    }
  }

  /**
   * Determina o tipo MIME com base na extensão do arquivo
   * 
   * @param filePath Caminho do arquivo
   * @returns Tipo MIME do arquivo
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

// Exporta uma instância singleton do adaptador melhorado
export const enhancedSupabasePersistenceAdapter = new EnhancedSupabasePersistenceAdapter();
