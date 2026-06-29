import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { pipeline } from 'stream/promises';
import sharp from 'sharp';
import env from '../config/env.js';

const execPromise = promisify(exec);
const isMock = env.MOCK_S3;

// S3 Client configuration for Selectel (or other compatible storage)
let s3Client = null;
if (!isMock) {
  s3Client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
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
  const bucketName = env.S3_BUCKET_NAME;
  
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
  const bucketName = env.S3_BUCKET_NAME;

  if (isMock) {
    // Return relative URL, frontend will prepend backend host dynamically
    return `/api/mock-s3/${key}`;
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  // URL is valid for 1 hour (3600 seconds)
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  if (env.S3_CDN_URL) {
    try {
      const parsedSignedUrl = new URL(signedUrl);
      const parsedCdnUrl = new URL(env.S3_CDN_URL);
      parsedSignedUrl.protocol = parsedCdnUrl.protocol;
      parsedSignedUrl.host = parsedCdnUrl.host;
      return parsedSignedUrl.toString();
    } catch (err) {
      console.warn('Selectel S3: Failed to parse CDN URL or signed URL, falling back to original:', err);
    }
  }

  return signedUrl;
}

/**
 * Deletes a file from storage
 */
export async function deleteFromStorage(key) {
  const bucketName = env.S3_BUCKET_NAME;

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
    
    // Also try to delete local mock thumbnail if it exists
    const ext = path.extname(key);
    const base = path.basename(key, ext);
    const thumbKey = path.join(path.dirname(key), `thumb_${base}.avif`).replace(/\\/g, '/');
    const thumbPath = path.resolve(MOCK_UPLOAD_DIR, thumbKey);
    if (fs.existsSync(thumbPath)) {
      fs.unlinkSync(thumbPath);
      console.log(`Mock S3: Deleted thumbnail locally at ${thumbPath}`);
    }
    return;
  }

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await s3Client.send(command);
  console.log(`Selectel S3: Deleted file from bucket ${bucketName} with key ${key}`);

  // Also delete S3 thumbnail
  const ext = path.extname(key);
  const base = path.basename(key, ext);
  const thumbKey = `${path.dirname(key)}/thumb_${base}.avif`;
  
  try {
    const deleteThumbCommand = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: thumbKey,
    });
    await s3Client.send(deleteThumbCommand);
    console.log(`Selectel S3: Deleted thumbnail with key ${thumbKey}`);
  } catch (err) {
    // Ignore error if thumbnail doesn't exist
  }
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

  const bucketName = env.S3_BUCKET_NAME;
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

/**
 * Generates an optimized WebP thumbnail (max 800px) from a photo key
 */
export async function generateImageThumbnail(key) {
  const ext = path.extname(key);
  const base = path.basename(key, ext);
  const thumbKey = `${path.dirname(key)}/thumb_${base}.avif`;

  if (isMock) {
    const filePath = path.resolve(MOCK_UPLOAD_DIR, key);
    const thumbPath = path.resolve(MOCK_UPLOAD_DIR, thumbKey);

    // Ensure containing directory exists
    const dir = path.dirname(thumbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(filePath)) {
      try {
        await sharp(filePath)
          .rotate() // Auto-orient based on EXIF
          .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
          .avif({ quality: 65 })
          .toFile(thumbPath);
        console.log(`Mock S3: Generated thumbnail locally at ${thumbKey}`);
        return thumbKey;
      } catch (err) {
        console.error('Failed to generate local mock thumbnail:', err);
        return null;
      }
    }
    return null;
  }

  const bucketName = env.S3_BUCKET_NAME;

  try {
    // Download original image from S3
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    const s3Object = await s3Client.send(getCommand);
    
    // Read response body stream into Buffer
    const chunks = [];
    for await (const chunk of s3Object.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Generate resized AVIF thumbnail using sharp
    const thumbBuffer = await sharp(buffer)
      .rotate() // Auto-orient based on EXIF
      .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
      .avif({ quality: 65 })
      .toBuffer();

    // Upload thumbnail back to S3
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: thumbKey,
      Body: thumbBuffer,
      ContentType: 'image/avif',
    });
    await s3Client.send(putCommand);
    console.log(`Selectel S3: Generated and uploaded thumbnail with key ${thumbKey}`);
    return thumbKey;
  } catch (err) {
    console.error(`Selectel S3: Failed to generate thumbnail for key ${key}:`, err);
    return null;
  }
}

/**
 * Strips EXIF metadata from the original uploaded image to prevent privacy leaks (compliance with FZ-152)
 * Overwrites the original image in storage and returns the new size.
 */
export async function sanitizeImageMetadata(key, mimeType) {
  if (isMock) {
    const filePath = path.resolve(MOCK_UPLOAD_DIR, key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    try {
      const tempOutput = path.join(os.tmpdir(), `sanitized-${Date.now()}`);
      
      // sharp automatically discards metadata unless .withMetadata() is explicitly chained.
      await sharp(filePath)
        .rotate() // auto-orient based on original EXIF before stripping
        .toFile(tempOutput);

      fs.copyFileSync(tempOutput, filePath);
      fs.unlinkSync(tempOutput);

      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (err) {
      console.error('Failed to sanitize local mock image metadata:', err);
      return null;
    }
  }

  const bucketName = env.S3_BUCKET_NAME;

  try {
    const getCommand = new GetObjectCommand({ Bucket: bucketName, Key: key });
    const s3Object = await s3Client.send(getCommand);
    
    const chunks = [];
    for await (const chunk of s3Object.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const sanitizedBuffer = await sharp(buffer)
      .rotate()
      .toBuffer();

    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: sanitizedBuffer,
      ContentType: mimeType,
    });
    await s3Client.send(putCommand);

    console.log(`Selectel S3: Sanitized image metadata and overwrote S3 key: ${key}`);
    return sanitizedBuffer.length;
  } catch (err) {
    console.error(`Selectel S3: Failed to sanitize image metadata for key ${key}:`, err);
    return null;
  }
}

/**
 * Uploads a buffer directly to storage (S3 or local mock directory)
 */
export async function uploadBufferToStorage(key, buffer, mimeType) {
  if (isMock) {
    const filePath = path.resolve(MOCK_UPLOAD_DIR, key);
    const dirName = path.dirname(filePath);
    if (!fs.existsSync(dirName)) {
      fs.mkdirSync(dirName, { recursive: true });
    }
    fs.writeFileSync(filePath, buffer);
    console.log(`Mock S3: Saved buffer locally at ${filePath}`);
    return `/api/mock-s3/${key}`;
  }

  const bucketName = env.S3_BUCKET_NAME;
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);
  console.log(`Selectel S3: Uploaded buffer to key ${key}`);
  
  if (env.S3_CDN_URL) {
    return `${env.S3_CDN_URL}/${key}`;
  }
  return `https://${bucketName}.s3.${env.S3_REGION}.storage.selcloud.ru/${key}`;
}
