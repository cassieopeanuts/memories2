import crypto from 'crypto';
import path from 'path';
import { query } from '../services/db.service.js';
import { 
  generatePresignedUploadUrl, 
  generatePresignedDownloadUrl, 
  deleteFromStorage,
  transcodeVideo,
  generateImageThumbnail,
  sanitizeImageMetadata
} from '../services/s3.service.js';
import { sendStorageWarning } from '../services/mail.service.js';

// Request upload permission & get presigned PUT URL
export async function getUploadUrl(req, res, next) {
  const { fileName, fileType, fileSize } = req.body;
  const userId = req.user.id;
  const limit = req.user.storage_limit;

  if (!fileName || !fileType || !fileSize) {
    return res.status(400).json({ error: 'Не все параметры файла указаны.' });
  }

  try {
    // Calculate space usage
    const sizeResult = await query('SELECT SUM(size) as total_size FROM photos WHERE user_id = $1', [userId]);
    const currentSize = parseInt(sizeResult.rows[0].total_size || '0', 10);

    if (currentSize + parseInt(fileSize, 10) > parseInt(limit, 10)) {
      // Send storage full notification in the background
      sendStorageWarning(userId, req.user.email, req.user.name, currentSize, parseInt(limit, 10), true)
        .catch(err => console.error('[Storage Alert Upload-Url Error]', err));

      return res.status(400).json({ 
        error: 'Ой, на вашем облаке не хватает памяти для этой фотографии. Вы можете удалить старые фото или перейти на расширенное хранилище.' 
      });
    }

    // Generate a unique key for S3
    const fileExt = path.extname(fileName) || '.jpg';
    const uniqueId = crypto.randomUUID();
    const s3Key = `${userId}/${uniqueId}${fileExt}`;

    // Generate PUT URL
    const uploadUrl = await generatePresignedUploadUrl(s3Key, fileType);

    res.json({
      uploadUrl,
      s3Key,
      mimeType: fileType
    });
  } catch (error) {
    next(error);
  }
}

// Confirm successful upload to S3
export async function confirmUpload(req, res, next) {
  const { s3Key, originalName, size, mimeType, albumId } = req.body;
  const userId = req.user.id;

  if (!s3Key || !originalName || !size || !mimeType) {
    return res.status(400).json({ error: 'Не все метаданные файла предоставлены.' });
  }

  try {
    // Write photo metadata to database
    const insertResult = await query(
      `INSERT INTO photos (user_id, s3_key, original_name, size, mime_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, s3Key, originalName, size, mimeType]
    );

    const newPhoto = insertResult.rows[0];
    
    // Automatically map to "Общий" album
    const albumRes = await query("SELECT id FROM albums WHERE user_id = $1 AND name = 'Общий'", [userId]);
    if (albumRes.rows.length > 0) {
      const generalAlbumId = albumRes.rows[0].id;
      await query(
        'INSERT INTO album_photos (album_id, photo_id, position) VALUES ($1, $2, $3)',
        [generalAlbumId, newPhoto.id, 0]
      );
    }

    // Generate thumbnail or transcode video based on type
    if (mimeType && mimeType.startsWith('video/')) {
      // Automatically check/create "Видео" album
      let videoAlbumId;
      const videoAlbumRes = await query("SELECT id FROM albums WHERE user_id = $1 AND name = 'Видео'", [userId]);
      
      if (videoAlbumRes.rows.length === 0) {
        const posRes = await query('SELECT COALESCE(MAX(position)+1, 1) as next_pos FROM albums WHERE user_id = $1', [userId]);
        const nextPos = posRes.rows[0].next_pos || 1;
        const createRes = await query(
          'INSERT INTO albums (user_id, name, position) VALUES ($1, $2, $3) RETURNING id',
          [userId, 'Видео', nextPos]
        );
        videoAlbumId = createRes.rows[0].id;
        console.log(`Automatically created "Видео" album for user ${userId}`);
      } else {
        videoAlbumId = videoAlbumRes.rows[0].id;
      }

      // Map this video to the "Видео" album
      const posResult = await query('SELECT COALESCE(MAX(position)+1, 0) as next_pos FROM album_photos WHERE album_id = $1', [videoAlbumId]);
      const nextPhotoPos = posResult.rows[0].next_pos || 0;
      await query(
        'INSERT INTO album_photos (album_id, photo_id, position) VALUES ($1, $2, $3)',
        [videoAlbumId, newPhoto.id, nextPhotoPos]
      );

      // Start transcoding in the background
      transcodeVideo(s3Key)
        .then(async ({ newSize, mimeType: newMimeType }) => {
          await query(
            `UPDATE photos SET size = $1, mime_type = $2 WHERE id = $3`,
            [newSize, newMimeType, newPhoto.id]
          );
          console.log(`Async transcode complete for photo ID ${newPhoto.id}. Size: ${newSize}`);
        })
        .catch(err => {
          console.error(`Async transcode failed for photo ID ${newPhoto.id}:`, err);
        });
    } else if (mimeType && mimeType.startsWith('image/')) {
      // Start thumbnail generation and metadata sanitization in the background
      sanitizeImageMetadata(s3Key, mimeType)
        .then(async (newSize) => {
          if (newSize) {
            await query(
              'UPDATE photos SET size = $1 WHERE id = $2',
              [newSize, newPhoto.id]
            );
            console.log(`Sanitized original photo ID ${newPhoto.id}. New size: ${newSize}`);
          }
        })
        .catch(err => console.error(`Failed to sanitize photo ${newPhoto.id}:`, err));

      generateImageThumbnail(s3Key)
        .then(async (thumbKey) => {
          if (thumbKey) {
            await query(
              'UPDATE photos SET thumbnail_key = $1 WHERE id = $2',
              [thumbKey, newPhoto.id]
            );
            console.log(`Generated thumbnail for photo ID ${newPhoto.id}: ${thumbKey}`);
          }
        })
        .catch(err => console.error(`Failed to generate thumbnail for photo ${newPhoto.id}:`, err));
    }

    // Also map to target custom album if provided and valid
    if (albumId) {
      const targetAlbumRes = await query("SELECT id, name FROM albums WHERE user_id = $1 AND id = $2", [userId, albumId]);
      if (targetAlbumRes.rows.length > 0 && targetAlbumRes.rows[0].name !== 'Общий') {
        const posResult = await query('SELECT COALESCE(MAX(position)+1, 0) as next_pos FROM album_photos WHERE album_id = $1', [albumId]);
        const nextPos = posResult.rows[0].next_pos || 0;
        await query(
          'INSERT INTO album_photos (album_id, photo_id, position) VALUES ($1, $2, $3)',
          [albumId, newPhoto.id, nextPos]
        );
      }
    }
    
    // Generate fresh download URL for this photo
    newPhoto.url = await generatePresignedDownloadUrl(s3Key);

    // Check storage capacity and send warning if >= 90% full
    query('SELECT SUM(size) as total_size FROM photos WHERE user_id = $1', [userId])
      .then(async (sizeRes) => {
        const currentSize = parseInt(sizeRes.rows[0].total_size || '0', 10);
        const limitBytes = parseInt(req.user.storage_limit, 10);
        if (currentSize >= limitBytes * 0.90) {
          await sendStorageWarning(userId, req.user.email, req.user.name, currentSize, limitBytes, false);
        }
      })
      .catch(err => console.error('[Storage Alert Confirm Error]', err));

    console.log(`User ${userId} uploaded photo: ${originalName}`);
    res.status(201).json(newPhoto);
  } catch (error) {
    next(error);
  }
}

// Fetch all photos for authorized user
export async function getPhotos(req, res, next) {
  const userId = req.user.id;
  const limit = req.user.storage_limit;

  try {
    // Fetch photo details from DB (excluding deleted photos)
    const photosResult = await query(
      'SELECT id, s3_key, thumbnail_key, original_name, size, mime_type, created_at FROM photos WHERE user_id = $1 AND is_deleted = false ORDER BY created_at DESC',
      [userId]
    );
    
    const photos = photosResult.rows;

    // Generate secure presigned GET URL for each photo (original and thumbnail if exists)
    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => {
        try {
          const url = await generatePresignedDownloadUrl(photo.s3_key);
          const thumbUrl = photo.thumbnail_key
            ? await generatePresignedDownloadUrl(photo.thumbnail_key).catch(() => null)
            : null;
          
          return { ...photo, url, thumbUrl: thumbUrl || url };
        } catch (e) {
          console.error(`Error generating download URL for key ${photo.s3_key}:`, e);
          return { ...photo, url: null, thumbUrl: null };
        }
      })
    );

    // Fetch storage usage
    const sizeResult = await query('SELECT SUM(size) as total_size FROM photos WHERE user_id = $1', [userId]);
    const totalUsedBytes = parseInt(sizeResult.rows[0].total_size || '0', 10);

    res.json({
      photos: photosWithUrls,
      storage: {
        used: totalUsedBytes,
        limit: parseInt(limit, 10)
      }
    });
  } catch (error) {
    next(error);
  }
}

// Delete a photo (soft delete)
export async function softDeletePhoto(req, res, next) {
  const photoId = req.params.id;
  const userId = req.user.id;

  try {
    const photoResult = await query('SELECT * FROM photos WHERE id = $1 AND user_id = $2', [photoId, userId]);
    
    if (photoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Фотография не найдена или у вас нет прав на её удаление.' });
    }

    await query(
      'UPDATE photos SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2',
      [photoId, userId]
    );

    res.json({ success: true, message: 'Фотография перемещена в корзину.' });
  } catch (error) {
    next(error);
  }
}

// Get all soft-deleted photos for the user
export async function getTrashPhotos(req, res, next) {
  const userId = req.user.id;

  try {
    const result = await query(
      'SELECT id, s3_key, thumbnail_key, original_name, size, mime_type, created_at, deleted_at FROM photos WHERE user_id = $1 AND is_deleted = true ORDER BY deleted_at DESC',
      [userId]
    );

    const photosWithUrls = await Promise.all(
      result.rows.map(async (photo) => {
        try {
          const url = await generatePresignedDownloadUrl(photo.s3_key);
          const thumbUrl = photo.thumbnail_key
            ? await generatePresignedDownloadUrl(photo.thumbnail_key).catch(() => null)
            : null;

          return { ...photo, url, thumbUrl: thumbUrl || url };
        } catch (e) {
          console.error(`Error generating download URL for key ${photo.s3_key}:`, e);
          return { ...photo, url: null, thumbUrl: null };
        }
      })
    );

    res.json({ photos: photosWithUrls });
  } catch (error) {
    next(error);
  }
}

// Restore a soft-deleted photo
export async function restorePhoto(req, res, next) {
  const photoId = req.params.id;
  const userId = req.user.id;

  try {
    const checkPhoto = await query('SELECT id FROM photos WHERE id = $1 AND user_id = $2 AND is_deleted = true', [photoId, userId]);
    if (checkPhoto.rows.length === 0) {
      return res.status(404).json({ error: 'Фотография не найдена в корзине.' });
    }

    await query(
      'UPDATE photos SET is_deleted = false, deleted_at = NULL WHERE id = $1 AND user_id = $2',
      [photoId, userId]
    );

    res.json({ success: true, message: 'Фотография восстановлена.' });
  } catch (error) {
    next(error);
  }
}

// Bulk restore photos from trash
export async function bulkRestorePhotos(req, res, next) {
  const { photoIds } = req.body;
  const userId = req.user.id;

  if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
    return res.status(400).json({ error: 'Неверный список идентификаторов.' });
  }

  try {
    await query(
      'UPDATE photos SET is_deleted = false, deleted_at = NULL WHERE id = ANY($1) AND user_id = $2',
      [photoIds, userId]
    );

    res.json({ success: true, message: 'Выбранные фотографии успешно восстановлены.' });
  } catch (error) {
    next(error);
  }
}

// Permanently delete selected photos
export async function bulkDeletePermanent(req, res, next) {
  const { photoIds } = req.body;
  const userId = req.user.id;

  if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
    return res.status(400).json({ error: 'Неверный список идентификаторов.' });
  }

  try {
    const photosResult = await query(
      'SELECT s3_key FROM photos WHERE id = ANY($1) AND user_id = $2 AND is_deleted = true',
      [photoIds, userId]
    );

    for (const photo of photosResult.rows) {
      try {
        await deleteFromStorage(photo.s3_key);
      } catch (err) {
        console.error(`Failed to delete S3 key ${photo.s3_key}:`, err);
      }
    }

    await query(
      'DELETE FROM photos WHERE id = ANY($1) AND user_id = $2',
      [photoIds, userId]
    );

    res.json({ success: true, message: 'Выбранные фотографии навсегда удалены из облака.' });
  } catch (error) {
    next(error);
  }
}

// Empty user's trash bin
export async function emptyTrash(req, res, next) {
  const userId = req.user.id;

  try {
    const photosResult = await query(
      'SELECT s3_key FROM photos WHERE user_id = $1 AND is_deleted = true',
      [userId]
    );

    for (const photo of photosResult.rows) {
      try {
        await deleteFromStorage(photo.s3_key);
      } catch (err) {
        console.error(`Failed to delete S3 key ${photo.s3_key}:`, err);
      }
    }

    await query(
      'DELETE FROM photos WHERE user_id = $1 AND is_deleted = true',
      [userId]
    );

    res.json({ success: true, message: 'Корзина успешно очищена. Все файлы удалены навсегда.' });
  } catch (error) {
    next(error);
  }
}

// Toggle photo favorite state
export async function toggleFavorite(req, res, next) {
  const photoId = req.params.id;
  const { isFavorite } = req.body;
  const userId = req.user.id;

  try {
    await query(
      'UPDATE photos SET is_favorite = $1 WHERE id = $2 AND user_id = $3',
      [isFavorite === true, photoId, userId]
    );

    if (isFavorite === true) {
      let albumRes = await query("SELECT id FROM albums WHERE user_id = $1 AND name = $2", [userId, 'Избранное']);
      let favAlbumId;
      
      if (albumRes.rows.length === 0) {
        const posResult = await query('SELECT COALESCE(MAX(position)+1, 1) as next_pos FROM albums WHERE user_id = $1', [userId]);
        const nextPos = posResult.rows[0].next_pos || 1;
        
        const insertAlbumRes = await query(
          'INSERT INTO albums (user_id, name, position) VALUES ($1, $2, $3) RETURNING id',
          [userId, 'Избранное', nextPos]
        );
        favAlbumId = insertAlbumRes.rows[0].id;
      } else {
        favAlbumId = albumRes.rows[0].id;
      }

      const mapCheck = await query(
        'SELECT 1 FROM album_photos WHERE album_id = $1 AND photo_id = $2',
        [favAlbumId, photoId]
      );
      
      if (mapCheck.rows.length === 0) {
        const posResult = await query(
          'SELECT COALESCE(MAX(position)+1, 0) as next_pos FROM album_photos WHERE album_id = $1',
          [favAlbumId]
        );
        const nextPos = posResult.rows[0].next_pos || 0;
        
        await query(
          'INSERT INTO album_photos (album_id, photo_id, position) VALUES ($1, $2, $3)',
          [favAlbumId, photoId, nextPos]
        );
      }
    } else {
      const albumRes = await query("SELECT id FROM albums WHERE user_id = $1 AND name = $2", [userId, 'Избранное']);
      if (albumRes.rows.length > 0) {
        const favAlbumId = albumRes.rows[0].id;
        await query(
          'DELETE FROM album_photos WHERE album_id = $1 AND photo_id = $2',
          [favAlbumId, photoId]
        );
      }
    }

    res.json({ success: true, isFavorite: isFavorite === true });
  } catch (error) {
    next(error);
  }
}
