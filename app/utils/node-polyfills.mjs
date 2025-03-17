/**
 * Este arquivo fornece polyfills para APIs de Node.js que podem ser necessárias
 * no cliente mas não são instaladas automaticamente pelo plugin Vite do Remix
 * 
 * De acordo com a documentação:
 * "The Remix Vite plugin doesn't install any global Node polyfills so you'll need to 
 * install them yourself if you were relying on `remix-serve` to provide them."
 * 
 * Importe este arquivo no cliente se você precisar de acesso às APIs listadas abaixo.
 */

import { Buffer } from 'buffer';
import process from 'process';
import { setImmediate, clearImmediate } from 'timers';

// Instalar os polyfills globalmente para APIs comuns do Node.js
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
  window.process = process;
  window.setImmediate = setImmediate;
  window.clearImmediate = clearImmediate;
  
  // Adicionar um marcador para verificar se os polyfills foram carregados
  window.__NODE_POLYFILLS_INSTALLED__ = true;
  
  console.log('Node.js polyfills instalados no ambiente do navegador');
}

export {
  Buffer,
  process,
  setImmediate,
  clearImmediate
};
