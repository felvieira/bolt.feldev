// supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// Get environment variable from multiple possible sources
function getEnvVar(name: string): string | undefined {
  // Try global constants (injected by our script)
  if (typeof HARDCODED_URL !== 'undefined' && name === 'SUPABASE_URL') {
    return HARDCODED_URL;
  }
  if (typeof HARDCODED_KEY !== 'undefined' && name === 'SUPABASE_ANON_KEY') {
    return HARDCODED_KEY;
  }
  
  // Try process.env (Node.js standard)
  if (process.env[name]) {
    return process.env[name];
  }
  
  // Try globalThis.env (Cloudflare Workers pattern)
  if (typeof globalThis !== 'undefined' && 
      globalThis.env && 
      globalThis.env[name]) {
    return globalThis.env[name];
  }
  
  // Try direct properties on globalThis
  if (typeof globalThis !== 'undefined' && 
      (globalThis as any)[name]) {
    return (globalThis as any)[name];
  }
  
  // Try browser-specific __ENV__ global
  if (typeof globalThis !== 'undefined' && 
      (globalThis as any).__ENV__ && 
      (globalThis as any).__ENV__[name]) {
    return (globalThis as any).__ENV__[name];
  }
  
  return undefined;
}

// Factory function to create Supabase client
export function getSupabaseClient() {
  const supabaseUrl = getEnvVar('SUPABASE_URL');
  const supabaseAnonKey = getEnvVar('SUPABASE_ANON_KEY');
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase credentials!', {
      urlExists: !!supabaseUrl,
      keyExists: !!supabaseAnonKey
    });
    throw new Error('Supabase credentials not available. Please check environment variables.');
  }
  
  return createClient(supabaseUrl, supabaseAnonKey);
}

// For compatibility with existing code
export const supabase = getSupabaseClient();
