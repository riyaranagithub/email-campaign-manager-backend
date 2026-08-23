import express from 'express';
import { runClassification, updateEmailCategory } from '../controllers/classifyController.js';

const router = express.Router();

router.post('/run', runClassification);
router.patch('/:id/category', updateEmailCategory);

export default router;
