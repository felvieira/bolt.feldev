// app/utils/redis-session.server.ts
import { createClient } from 'redis';
import { createSessionStorage } from '@remix-run/node';
import RedisStore from 'connect-redis';
import { getEnvVar } from './express-context-adapter.server';
import type { ExpressAppContext } from './express-context-adapter.server';
import { execSync } from 'child_process';

// Redis client setup
const getRedisClient = (context?: ExpressAppContext) => {
  console.log('===== REDIS CONNECTION DIAGNOSTICS =====');
  console.log('Direct access of process.env.REDIS_URL:', process.env.REDIS_URL);
  
  // Dump all environment variables that contain "REDIS"
  Object.keys(process.env)
    .filter(key => key.includes('REDIS'))
    .forEach(key => {
      console.log(`Environment variable ${key}: ${process.env[key].substring(0, 15)}...`);
    });
  
  // Try to get from context if provided
  const contextRedisUrl = context ? getEnvVar(context, 'REDIS_URL') : null;
  console.log('Context REDIS_URL available:', !!contextRedisUrl);
  
  // If we can't get it directly, try using child_process to read it
  let redisUrl = process.env.REDIS_URL || contextRedisUrl;
  
  if (!redisUrl) {
    console.log('Attempting to read REDIS_URL using child_process');
    try {
      redisUrl = execSync('echo $REDIS_URL').toString().trim();
      console.log('Retrieved REDIS_URL using child_process:', !!redisUrl);
    } catch (error) {
      console.error('Failed to retrieve REDIS_URL using child_process:', error);
    }
  }
  
  if (!redisUrl) {
    console.error('REDIS_URL not found through any method. Falling back to localhost which will likely fail.');
    redisUrl = 'redis://localhost:6379';
  } else {
    // Log a sanitized version of the URL for debugging (hide credentials)
    const sanitizedUrl = redisUrl.replace(/\/\/(.*):(.*)@/, '//***:***@');
    console.log(`Using Redis URL: ${sanitizedUrl}`);
  }
  
  // Create Redis client
  const client = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 50, 2000)
    }
  });

  // Handle Redis connection errors
  client.on('error', (err) => {
    console.error('Redis connection error:', err);
  });

  return client;
};

// Initialize Redis client (connect only when needed)
let redisClient: ReturnType<typeof createClient> | null = null;

// Create the session storage with Redis
export const createRedisSessionStore = async (context?: ExpressAppContext) => {
  // Initialize Redis client if not already connected
  if (!redisClient) {
    redisClient = getRedisClient(context);
    await redisClient.connect().catch(err => {
      console.error('Failed to connect to Redis:', err);
      throw err;
    });
  }

  const sessionSecret = context 
    ? getEnvVar(context, 'SESSION_SECRET') 
    : process.env.SESSION_SECRET;

  if (!sessionSecret) {
    throw new Error('SESSION_SECRET environment variable is required');
  }

  // Create session storage with Redis as the store
  return createSessionStorage({
    cookie: {
      name: '__session',
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secrets: [sessionSecret],
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 8, // 8 hours (in seconds)
    },
    storage: new RedisStore({
      client: redisClient,
      prefix: 'bolt:sess:',
      ttl: 60 * 60 * 8 // 8 hours (in seconds)
    }),
  });
};

// Export Redis client for other use cases if needed
export const getRedis = async () => {
  if (!redisClient) {
    redisClient = getRedisClient();
    await redisClient.connect();
  }
  return redisClient;
};
