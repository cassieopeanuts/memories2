import dotenv from 'dotenv';
import { z } from 'zod';
import crypto from 'crypto';

dotenv.config();

// Custom parsing logic for fallback JWT secret
let fallbackSecret = 'ag_very_secret_token_12345!';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.warn('🚨 SECURITY WARNING: process.env.JWT_SECRET is not configured in production environment!');
  console.warn('🚨 Generating a random secure fallback key. Sessions will be invalidated upon server restart!');
  fallbackSecret = crypto.randomBytes(32).toString('hex');
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.preprocess((val) => (val ? Number(val) : 5000), z.number()),
  FRONTEND_URL: z.string().default('http://localhost:5180'),
  
  // Database configuration
  DB_USER: z.string().default('cass'),
  DB_PASSWORD: z.string().default('supersecurepassword123'),
  DB_HOST: z.string().default('db'),
  DB_NAME: z.string().default('memories'),
  DB_PORT: z.preprocess((val) => (val ? Number(val) : 5432), z.number()),
  MOCK_DATABASE: z.preprocess((val) => val === 'true', z.boolean()).default(false),

  // JWT configuration
  JWT_SECRET: z.string().default(fallbackSecret),

  // S3 configuration
  MOCK_S3: z.preprocess((val) => val === 'true' || val === undefined, z.boolean()).default(true),
  S3_ENDPOINT: z.string().default('https://s3.ru-1.storage.selcloud.ru'),
  S3_REGION: z.string().default('ru-1'),
  S3_ACCESS_KEY_ID: z.string().default('your_selectel_access_key'),
  S3_SECRET_ACCESS_KEY: z.string().default('your_selectel_secret_key'),
  S3_BUCKET_NAME: z.string().default('memories-photos'),
  S3_CDN_URL: z.string().optional(),

  // Yandex OAuth
  YANDEX_CLIENT_ID: z.string().default('mock_yandex_client_id'),
  YANDEX_CLIENT_SECRET: z.string().default('mock_yandex_client_secret'),
  REDIRECT_URI: z.string().default('http://localhost:5000/api/auth/yandex/callback'),

  // SMTP configuration
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.preprocess((val) => (val ? Number(val) : 465), z.number()),
  SMTP_SECURE: z.preprocess((val) => val === 'true', z.boolean()).default(false),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  FEEDBACK_RECEIVER: z.string().default('admin@xn--80affoidsgaujr8a0h.xn--p1ai'),

  // Web Push VAPID keys
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
});

// Safe parse variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Configuration error in environment variables:', JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

export const env = parsedEnv.data;
export default env;
