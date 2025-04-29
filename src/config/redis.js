import Redis from 'ioredis';
import { promisify } from 'util';

// Redis connection setup
const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost', // Use environment variables if available
    port: process.env.REDIS_PORT || 6379,
    db: process.env.REDIS_DB || 0
});

redis.on('connect', () => {
    console.log('Connected to Redis');
});
redis.on('error', (err) => {
    console.error('Redis connection error:', err);
});

// Create promisified Redis methods (using built-in Promise support is often preferred)
const getAsync = async (key) => await redis.get(key);
const setAsync = async (key, ttl, value) => await redis.setex(key, ttl, value);
const delAsync = async (key) => await redis.del(key);

// Alternatively, using util.promisify (less common now with native Promise support in ioredis)
// const getAsync = promisify(redis.get).bind(redis);
// const setAsync = promisify(redis.setex).bind(redis);
// const delAsync = promisify(redis.del).bind(redis);

export { redis, getAsync, setAsync, delAsync };
