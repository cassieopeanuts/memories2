import express from 'express';
import { 
  getUploadUrl, 
  confirmUpload, 
  getPhotos, 
  softDeletePhoto, 
  getTrashPhotos, 
  restorePhoto, 
  bulkRestorePhotos, 
  bulkDeletePermanent, 
  emptyTrash, 
  toggleFavorite 
} from '../controllers/photos.controller.js';
import { authenticateJWT } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Apply authenticateJWT globally for all photo routes
router.use(authenticateJWT);

router.post('/upload-url', getUploadUrl);
router.post('/confirm', confirmUpload);
router.get('/', getPhotos);
router.get('/trash', getTrashPhotos);
router.delete('/:id', softDeletePhoto);
router.post('/:id/restore', restorePhoto);
router.post('/bulk-restore', bulkRestorePhotos);
router.post('/bulk-delete-permanent', bulkDeletePermanent);
router.post('/trash/empty', emptyTrash);
router.put('/:id/favorite', toggleFavorite);

export default router;
