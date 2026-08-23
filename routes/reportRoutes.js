import express from 'express';
import {
  getDeliverySummary,
  getCampaignReport,
  exportLogsCSV,
} from '../controllers/reportController.js';

const router = express.Router();

router.get('/summary', getDeliverySummary);
router.get('/:id', getCampaignReport);
router.get('/:id/export', exportLogsCSV);

export default router;
