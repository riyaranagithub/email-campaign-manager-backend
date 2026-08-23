import express from 'express';
import {
  uploadEmails,
  getEmails,
  getEmailStats,
  removeDuplicates,
  addEmail,
  deleteEmail,
  clearEmails,
} from '../controllers/emailController.js';
import { uploadCSV } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/upload', uploadCSV.single('file'), uploadEmails);
router.get('/', getEmails);
router.get('/stats', getEmailStats);
router.delete('/duplicates', removeDuplicates);
router.post('/', addEmail);
router.delete('/clear', clearEmails);
router.delete('/:id', deleteEmail);

export default router;
