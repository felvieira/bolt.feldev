// app/utils/redis-session.server.ts
import { createClient } from 'redis';
import { createSessionStorage } from '@remix-run/node';
import RedisStore from 'connect-redis';
import { getEnvVar } from './express-context-adapter.server';
import type { ExpressAppContext } from './express-context-adapter.server';

// Redis client setup
const getRedisClient = (context?: ExpressAppContext) => {
  const redisUrl = context 
    ? getEnvVar(context, 'REDIS_URL') 
    : process.env.REDIS_URL;
  
  // If REDIS_URL is not set or empty after all lookups, use a default with warning
  if (!redisUrl) {
    console.warn('WARNING: REDIS_URL not found in environment or context! Using localhost fallback.');
    console.warn('This will likely fail if Redis is not running locally.');
    return createClient({
      url: 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 2000)
      }
    });
  }
  
  // Log Redis connection URL (sanitized to remove credentials)
  const sanitizedUrl = redisUrl.replace(/\/\/(.*):(.*)@/, '//***:***@');
  console.log(`Connecting to Redis with URL: ${sanitizedUrl}`);
  
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
    console.error(`Failed connecting to Redis URL: ${sanitizedUrl}`);
  });

  return client;
};

// Initialize Redis client (connect only when needed)
let redisClient: ReturnType<typeof createClient> | null = null;

// Create the session storage with Redis
export const createRedisSessionStore = async (context?: ExpressAppContext) => {
  try {
    // Initialize Redis client if not already connected
    if (!redisClient) {
      redisClient = getRedisClient(context);
      
      await redisClient.connect().catch(err => {
        console.error('Failed to connect to Redis:', err);
        throw err;
      });
      
      console.log('Successfully connected to Redis server');
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
  } catch (error) {
    console.error('Error creating Redis session store:', error);
    throw error;
  }
};

// Export Redis client for other use cases if needed
export const getRedis = async () => {
  try {
    if (!redisClient) {
      console.log('Initializing new Redis client connection');
      redisClient = getRedisClient();
      await redisClient.connect();
      console.log('Successfully connected to Redis server via getRedis()');
    }
    return redisClient;
  } catch (error) {
    console.error('Error in getRedis():', error);
    throw error;
  }
};

// Add a cleanup function for graceful shutdown
export const closeRedisConnection = async () => {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('Redis connection closed successfully');
      redisClient = null;
    } catch (error) {
      console.error('Error closing Redis connection:', error);
    }
  }
};
