import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { pipeline } from 'stream/promises';

const execPromise = promisify(exec);

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

/**
 * Transcodes a video stored in S3 (or mock folder) to a highly compatible and optimized H.264 MP4.
 * Overwrites the original object and returns the new size and mimeType.
 */
export async function transcodeVideo(key) {
  if (isMock) {
    const filePath = path.resolve(MOCK_UPLOAD_DIR, key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const tempOutput = path.join(os.tmpdir(), `transcoded-${Date.now()}.mp4`);
    
    try {
      // Scale largest dimension to max 1280px, format yuv420p, compress with x264 CRF 28, copy audio to aac if exists, faststart flag
      const ffmpegCmd = `ffmpeg -y -i "${filePath}" -map 0:v -c:v libx264 -preset veryfast -crf 28 -vf "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))',format=yuv420p" -map 0:a? -c:a aac -b:a 96k -movflags faststart "${tempOutput}"`;
      console.log(`Mock S3: Running transcoding command: ${ffmpegCmd}`);
      await execPromise(ffmpegCmd);

      // Overwrite mock file
      fs.copyFileSync(tempOutput, filePath);
      
      const stats = fs.statSync(filePath);
      return { newSize: stats.size, mimeType: 'video/mp4' };
    } finally {
      if (fs.existsSync(tempOutput)) {
        fs.unlinkSync(tempOutput);
      }
    }
  }

  const bucketName = process.env.S3_BUCKET_NAME || 'memories-photos';
  const tempInput = path.join(os.tmpdir(), `input-${Date.now()}.mp4`);
  const tempOutput = path.join(os.tmpdir(), `output-${Date.now()}.mp4`);

  try {
    // 1. Download original from S3
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    const s3Object = await s3Client.send(getCommand);
    await pipeline(s3Object.Body, fs.createWriteStream(tempInput));

    // 2. Transcode with FFmpeg
    const ffmpegCmd = `ffmpeg -y -i "${tempInput}" -map 0:v -c:v libx264 -preset veryfast -crf 28 -vf "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))',format=yuv420p" -map 0:a? -c:a aac -b:a 96k -movflags faststart "${tempOutput}"`;
    console.log(`Selectel S3: Transcoding video ${key} with FFmpeg...`);
    await execPromise(ffmpegCmd);

    // 3. Upload back to S3 (overwriting)
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fs.createReadStream(tempOutput),
      ContentType: 'video/mp4',
    });
    await s3Client.send(putCommand);

    const stats = fs.statSync(tempOutput);
    console.log(`Selectel S3: Transcoding finished. New size: ${stats.size} bytes`);
    return { newSize: stats.size, mimeType: 'video/mp4' };

  } finally {
    // Cleanup local temp files
    if (fs.existsSync(tempInput)) {
      try { fs.unlinkSync(tempInput); } catch (e) {}
    }
    if (fs.existsSync(tempOutput)) {
      try { fs.unlinkSync(tempOutput); } catch (e) {}
    }
  }
}
