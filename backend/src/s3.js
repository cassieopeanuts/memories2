import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const isMock = process.env.MOCK_S3 === 'true';

// S3 Client configuration for Selectel (or other compatible storage)
let s3Client = null;
if (!isMock) {
  s3Client = new S3Client({
    endpoint: process.env.S3_ENDPOINT || 'https://s3.ru-1.storage.selcloud.ru',
    region: process.env.S3_REGION || 'ru-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
    forcePathStyle: false, // Must be false for Selectel S3 virtual-hosted addressing to support CORS
  });
}

// Ensure local uploads directory exists if in Mock mode
const MOCK_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (isMock && !fs.existsSync(MOCK_UPLOAD_DIR)) {
  fs.mkdirSync(MOCK_UPLOAD_DIR, { recursive: true });
}

/**
 * Generates a presigned PUT URL for direct-to-S3 client uploading
 */
export async function generatePresignedUploadUrl(key, mimeType) {
  const bucketName = process.env.S3_BUCKET_NAME || 'memories-photos';
  
  if (isMock) {
    // Return relative URL, frontend will prepend backend host dynamically
    return `/api/mock-s3/${key}`;
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: mimeType,
  });

  // URL is valid for 15 minutes (900 seconds)
  return await getSignedUrl(s3Client, command, { expiresIn: 900 });
}

/**
 * Generates a presigned GET URL for secure file viewing
 */
export async function generatePresignedDownloadUrl(key) {
  const bucketName = process.env.S3_BUCKET_NAME || 'memories-photos';

  if (isMock) {
    // Return relative URL, frontend will prepend backend host dynamically
    return `/api/mock-s3/${key}`;
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  // URL is valid for 1 hour (3600 seconds)
  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

/**
 * Deletes a file from storage
 */
export async function deleteFromStorage(key) {
  const bucketName = process.env.S3_BUCKET_NAME || 'memories-photos';

  if (isMock) {
    const filePath = path.resolve(MOCK_UPLOAD_DIR, key);
    if (!filePath.startsWith(MOCK_UPLOAD_DIR)) {
      console.warn(`Blocked traversal deletion attempt with key: ${key}`);
      throw new Error('Access denied (path traversal)');
    }
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Mock S3: Deleted file locally at ${filePath}`);
    }
    return;
  }

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await s3Client.send(command);
  console.log(`Selectel S3: Deleted file from bucket ${bucketName} with key ${key}`);
}
