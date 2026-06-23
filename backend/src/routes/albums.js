import express from 'express';
import { 
  getAlbums, 
  createAlbum, 
  updateAlbumPositions, 
  deleteAlbum, 
  getAlbumPhotos, 
  addPhotosToAlbum, 
  updatePhotoPositions, 
  removePhotoFromAlbum, 
  shareAlbum, 
  unshareAlbum,
  getSharedAlbum
} from '../controllers/albums.controller.js';
import { authenticateJWT } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Public route for viewing shared album photos
router.get('/shared/album/:share_token', getSharedAlbum);

// Protected routes (require JWT)
router.get('/', authenticateJWT, getAlbums);
router.post('/', authenticateJWT, createAlbum);
router.put('/positions', authenticateJWT, updateAlbumPositions);
router.delete('/:id', authenticateJWT, deleteAlbum);

router.get('/:id/photos', authenticateJWT, getAlbumPhotos);
router.post('/:id/photos', authenticateJWT, addPhotosToAlbum);
router.put('/:id/photos/positions', authenticateJWT, updatePhotoPositions);
router.delete('/:albumId/photos/:photoId', authenticateJWT, removePhotoFromAlbum);

router.post('/:id/share', authenticateJWT, shareAlbum);
router.delete('/:id/share', authenticateJWT, unshareAlbum);

export default router;
