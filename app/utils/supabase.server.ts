import { createClient } from '@supabase/supabase-js';

// Inicializar o cliente Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase credentials not available. Please check environment variables.');
}

// Exportar o cliente instanciado
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Também exportar a factory function para uso em testes ou outros cenários
export function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}
