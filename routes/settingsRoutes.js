import express from 'express';
import { getSettings, updateSettings, testSMTP } from '../controllers/settingsController.js';

const router = express.Router();

router.get('/', getSettings);
router.post('/', updateSettings);
router.post('/test-smtp', testSMTP);

export default router;
