// app/lib/persistence/persistence-factory.ts
import type { PersistenceAdapter } from './persistence-adapter';
import { IndexedDBPersistenceAdapter } from './indexeddb-persistence-adapter';
import { SupabasePersistenceAdapter } from './supabase-persistence-adapter';
import { EnhancedSupabasePersistenceAdapter } from './enhanced-supabase-adapter';

// Tipos de adaptadores de persistência disponíveis
export type PersistenceType = 'indexeddb' | 'supabase' | 'supabase-minio';

/**
 * Fábrica de adaptadores de persistência
 * 
 * Esta classe gerencia a criação e o acesso aos adaptadores de persistência
 * conforme a configuração da aplicação.
 */
export class PersistenceFactory {
  private static instance: PersistenceFactory;
  private adapters: Map<PersistenceType, PersistenceAdapter> = new Map();
  private activeAdapter: PersistenceType = 'indexeddb'; // Padrão

  private constructor() {
    // Inicializar os adaptadores
    this.adapters.set('indexeddb', new IndexedDBPersistenceAdapter());
    this.adapters.set('supabase', new SupabasePersistenceAdapter());
    this.adapters.set('supabase-minio', new EnhancedSupabasePersistenceAdapter());
    
    // Determinar o adaptador ativo com base na configuração
    this.detectActiveAdapter();
  }

  /**
   * Obtém a instância singleton da fábrica
   */
  public static getInstance(): PersistenceFactory {
    if (!PersistenceFactory.instance) {
      PersistenceFactory.instance = new PersistenceFactory();
    }
    return PersistenceFactory.instance;
  }

  /**
   * Obtém o adaptador de persistência ativo
   */
  public getAdapter(): PersistenceAdapter {
    const adapter = this.adapters.get(this.activeAdapter);
    if (!adapter) {
      throw new Error(`Adaptador de persistência não encontrado: ${this.activeAdapter}`);
    }
    return adapter;
  }

  /**
   * Altera o adaptador de persistência ativo
   */
  public setActiveAdapter(type: PersistenceType): void {
    if (!this.adapters.has(type)) {
      throw new Error(`Tipo de adaptador não suportado: ${type}`);
    }
    this.activeAdapter = type;
    
    // Salvar configuração
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('persistenceType', type);
    }
    
    console.log(`Persistência alterada para: ${type}`);
  }

  /**
   * Obtém o tipo de adaptador ativo
   */
  public getActiveAdapterType(): PersistenceType {
    return this.activeAdapter;
  }

  /**
   * Detecta o adaptador ativo com base na configuração
   */
  private detectActiveAdapter(): void {
    // Verificar se há uma configuração salva
    let persistenceType: PersistenceType = 'indexeddb';
    
    if (typeof localStorage !== 'undefined') {
      const savedType = localStorage.getItem('persistenceType');
      if (savedType && this.adapters.has(savedType as PersistenceType)) {
        persistenceType = savedType as PersistenceType;
      }
    }
    
    // Verificar se o Supabase está configurado
    const supabaseUrl = typeof process !== 'undefined' && process.env.SUPABASE_URL;
    const supabaseKey = typeof process !== 'undefined' && (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY);
    
    if (supabaseUrl && supabaseKey) {
      // Por padrão, usar a versão com MinIO se disponível
      persistenceType = 'supabase-minio';
    }
    
    this.activeAdapter = persistenceType;
    console.log(`Usando adaptador de persistência: ${persistenceType}`);
  }
}

// Exportar uma função auxiliar para facilitar o acesso ao adaptador
export function getPersistenceAdapter(): PersistenceAdapter {
  return PersistenceFactory.getInstance().getAdapter();
}

// Exportar uma função para obter o tipo de adaptador
export function getPersistenceType(): PersistenceType {
  return PersistenceFactory.getInstance().getActiveAdapterType();
}

// Exportar uma função para alterar o tipo de adaptador
export function setPersistenceType(type: PersistenceType): void {
  PersistenceFactory.getInstance().setActiveAdapter(type);
}
