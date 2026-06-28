import crypto from 'crypto';
import { query } from '../services/db.service.js';
import { generatePresignedDownloadUrl } from '../services/s3.service.js';

// Get user's albums list
export async function getAlbums(req, res, next) {
  const userId = req.user.id;
  try {
    let result = await query('SELECT * FROM albums WHERE user_id = $1 ORDER BY position ASC', [userId]);
    
    // Fallback: If no albums exist, create default "Общий"
    const hasGeneral = result.rows.some(a => a.name === 'Общий');
    if (result.rows.length === 0 || !hasGeneral) {
      await query('INSERT INTO albums (user_id, name, position) VALUES ($1, $2, $3)', [userId, 'Общий', 0]);
      result = await query('SELECT * FROM albums WHERE user_id = $1 ORDER BY position ASC', [userId]);
    }
    
    // Retrieve photo count for each album
    const albumsWithCounts = await Promise.all(
      result.rows.map(async (album) => {
        let count = 0;
        if (album.name === 'Общий') {
          const countRes = await query('SELECT COUNT(*) as cnt FROM photos WHERE user_id = $1 AND is_deleted = false', [userId]);
          count = parseInt(countRes.rows[0].cnt || '0', 10);
        } else {
          const countRes = await query(
            'SELECT COUNT(*) as cnt FROM album_photos ap JOIN photos p ON ap.photo_id = p.id WHERE ap.album_id = $1 AND p.is_deleted = false', 
            [album.id]
          );
          count = parseInt(countRes.rows[0].cnt || '0', 10);
        }
        return { ...album, photoCount: count };
      })
    );
    
    res.json({ albums: albumsWithCounts });
  } catch (error) {
    next(error);
  }
}

// Create new custom album
export async function createAlbum(req, res, next) {
  const { name } = req.body;
  const userId = req.user.id;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Имя альбома не может быть пустым.' });
  }

  try {
    const posResult = await query('SELECT COALESCE(MAX(position)+1, 1) as next_pos FROM albums WHERE user_id = $1', [userId]);
    const nextPos = posResult.rows[0].next_pos || 1;

    const result = await query(
      'INSERT INTO albums (user_id, name, position) VALUES ($1, $2, $3) RETURNING *',
      [userId, name.trim(), nextPos]
    );

    res.json({ success: true, album: result.rows[0] });
  } catch (error) {
    next(error);
  }
}

// Update album positions (Drag & Drop sorting)
export async function updateAlbumPositions(req, res, next) {
  const { positions } = req.body;
  const userId = req.user.id;

  if (!positions || !Array.isArray(positions)) {
    return res.status(400).json({ error: 'Неверный формат позиций.' });
  }

  try {
    for (const item of positions) {
      await query(
        'UPDATE albums SET position = $1 WHERE id = $2 AND user_id = $3',
        [parseInt(item.position, 10), item.albumId, userId]
      );
    }
    res.json({ success: true, message: 'Позиции альбомов обновлены.' });
  } catch (error) {
    next(error);
  }
}

// Delete custom album
export async function deleteAlbum(req, res, next) {
  const albumId = req.params.id;
  const userId = req.user.id;

  try {
    const checkResult = await query('SELECT name FROM albums WHERE id = $1 AND user_id = $2', [albumId, userId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Альбом не найден.' });
    }

    if (checkResult.rows[0].name === 'Общий') {
      return res.status(400).json({ error: 'Нельзя удалить основной альбом "Общий".' });
    }

    await query('DELETE FROM albums WHERE id = $1 AND user_id = $2', [albumId, userId]);
    res.json({ success: true, message: 'Альбом успешно удален.' });
  } catch (error) {
    next(error);
  }
}

// Get photos in an album
export async function getAlbumPhotos(req, res, next) {
  const albumId = req.params.id;
  const userId = req.user.id;

  try {
    const albumResult = await query('SELECT name FROM albums WHERE id = $1 AND user_id = $2', [albumId, userId]);
    if (albumResult.rows.length === 0) {
      return res.status(404).json({ error: 'Альбом не найден.' });
    }

    const isGeneral = albumResult.rows[0].name === 'Общий';

    let photosResult;
    if (isGeneral) {
      photosResult = await query(
        'SELECT id, s3_key, thumbnail_key, original_name, size, mime_type, is_favorite, position, created_at FROM photos WHERE user_id = $1 AND is_deleted = false ORDER BY position ASC, created_at DESC',
        [userId]
      );
    } else {
      photosResult = await query(
        `SELECT p.id, p.s3_key, p.thumbnail_key, p.original_name, p.size, p.mime_type, p.is_favorite, p.created_at, ap.position 
         FROM photos p 
         JOIN album_photos ap ON p.id = ap.photo_id 
         WHERE ap.album_id = $1 AND p.is_deleted = false
         ORDER BY ap.position ASC`,
        [albumId]
      );
    }

    // Generate secure presigned GET URL for each photo (original and thumbnail if exists)
    const photosWithUrls = await Promise.all(
      photosResult.rows.map(async (photo) => {
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

// Helper path module for thumbnail check
import path from 'path';

// Add photos to an album
export async function addPhotosToAlbum(req, res, next) {
  const albumId = req.params.id;
  const { photoIds } = req.body;
  const userId = req.user.id;

  if (!photoIds || !Array.isArray(photoIds)) {
    return res.status(400).json({ error: 'Неверный список фотографий.' });
  }

  try {
    const albumResult = await query('SELECT name FROM albums WHERE id = $1 AND user_id = $2', [albumId, userId]);
    if (albumResult.rows.length === 0) {
      return res.status(404).json({ error: 'Альбом не найден.' });
    }

    if (albumResult.rows[0].name === 'Общий') {
      return res.status(400).json({ error: 'Фотографии уже находятся в альбоме "Общий" по умолчанию.' });
    }

    for (const photoId of photoIds) {
      const existCheck = await query(
        'SELECT 1 FROM album_photos WHERE album_id = $1 AND photo_id = $2',
        [albumId, photoId]
      );
      if (existCheck.rows.length > 0) {
        continue;
      }

      const posResult = await query('SELECT COALESCE(MAX(position)+1, 0) as next_pos FROM album_photos WHERE album_id = $1', [albumId]);
      const nextPos = posResult.rows[0].next_pos || 0;

      await query(
        'INSERT INTO album_photos (album_id, photo_id, position) VALUES ($1, $2, $3)',
        [albumId, photoId, nextPos]
      );
    }

    res.json({ success: true, message: 'Фотографии успешно добавлены в альбом.' });
  } catch (error) {
    next(error);
  }
}

// Update photos order inside custom album (Drag & Drop sorting)
export async function updatePhotoPositions(req, res, next) {
  const albumId = req.params.id;
  const { photoPositions } = req.body;
  const userId = req.user.id;

  if (!photoPositions || !Array.isArray(photoPositions)) {
    return res.status(400).json({ error: 'Неверный формат позиций.' });
  }

  try {
    const albumResult = await query('SELECT name FROM albums WHERE id = $1 AND user_id = $2', [albumId, userId]);
    if (albumResult.rows.length === 0) {
      return res.status(404).json({ error: 'Альбом не найден.' });
    }

    const isGeneral = albumResult.rows[0].name === 'Общий';

    for (const item of photoPositions) {
      if (isGeneral) {
        await query(
          'UPDATE photos SET position = $1 WHERE id = $2 AND user_id = $3',
          [parseInt(item.position, 10), item.photoId, userId]
        );
      } else {
        await query(
          'UPDATE album_photos SET position = $1 WHERE album_id = $2 AND photo_id = $3',
          [parseInt(item.position, 10), albumId, item.photoId]
        );
      }
    }

    res.json({ success: true, message: 'Порядок фотографий обновлен.' });
  } catch (error) {
    next(error);
  }
}

// Remove photo from custom album
export async function removePhotoFromAlbum(req, res, next) {
  const { albumId, photoId } = req.params;
  const userId = req.user.id;

  try {
    const albumResult = await query('SELECT name FROM albums WHERE id = $1 AND user_id = $2', [albumId, userId]);
    if (albumResult.rows.length === 0) {
      return res.status(404).json({ error: 'Альбом не найден.' });
    }

    if (albumResult.rows[0].name === 'Общий') {
      return res.status(400).json({ error: 'Нельзя удалить фотографию из основного альбома "Общий" без её удаления из облака.' });
    }

    await query('DELETE FROM album_photos WHERE album_id = $1 AND photo_id = $2', [albumId, photoId]);
    res.json({ success: true, message: 'Фотография убрана из альбома.' });
  } catch (error) {
    next(error);
  }
}

// Enable album sharing (generates share_token)
export async function shareAlbum(req, res, next) {
  const albumId = req.params.id;
  const userId = req.user.id;

  try {
    const albumResult = await query('SELECT name, share_token FROM albums WHERE id = $1 AND user_id = $2', [albumId, userId]);
    if (albumResult.rows.length === 0) {
      return res.status(404).json({ error: 'Альбом не найден.' });
    }

    if (albumResult.rows[0].name === 'Общий') {
      return res.status(400).json({ error: 'Нельзя поделиться альбомом «Общий».' });
    }

    let shareToken = albumResult.rows[0].share_token;
    if (!shareToken) {
      shareToken = crypto.randomUUID();
      await query('UPDATE albums SET share_token = $1 WHERE id = $2 AND user_id = $3', [shareToken, albumId, userId]);
    }

    res.json({ success: true, shareToken });
  } catch (error) {
    next(error);
  }
}

// Disable album sharing (sets share_token to NULL)
export async function unshareAlbum(req, res, next) {
  const albumId = req.params.id;
  const userId = req.user.id;

  try {
    const albumResult = await query('SELECT name FROM albums WHERE id = $1 AND user_id = $2', [albumId, userId]);
    if (albumResult.rows.length === 0) {
      return res.status(404).json({ error: 'Альбом не найден.' });
    }

    await query('UPDATE albums SET share_token = NULL WHERE id = $1 AND user_id = $2', [albumId, userId]);
    res.json({ success: true, message: 'Доступ по ссылке отключен.' });
  } catch (error) {
    next(error);
  }
}

// Public shared album fetch
export async function getSharedAlbum(req, res, next) {
  const { share_token } = req.params;

  try {
    const albumResult = await query(
      'SELECT id, name, user_id FROM albums WHERE share_token = $1',
      [share_token]
    );

    if (albumResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ссылка недействительна или владелец отключил доступ.' });
    }

    const album = albumResult.rows[0];

    // Get owner's name
    const ownerResult = await query('SELECT name FROM users WHERE id = $1', [album.user_id]);
    const ownerName = ownerResult.rows.length > 0 ? ownerResult.rows[0].name : 'Пользователь';

    // Get photos in the shared album (excluding deleted photos)
    const photosResult = await query(
      `SELECT p.id, p.s3_key, p.thumbnail_key, p.original_name, p.size, p.mime_type, p.is_favorite, p.created_at, ap.position 
       FROM photos p 
       JOIN album_photos ap ON p.id = ap.photo_id 
       WHERE ap.album_id = $1 AND p.is_deleted = false
       ORDER BY ap.position ASC`,
      [album.id]
    );

    // Generate secure presigned GET URL for each photo
    const photosWithUrls = await Promise.all(
      photosResult.rows.map(async (photo) => {
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

    res.json({
      albumName: album.name,
      ownerName,
      photos: photosWithUrls
    });
  } catch (error) {
    next(error);
  }
}
