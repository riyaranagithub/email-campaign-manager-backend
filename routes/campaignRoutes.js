import express from 'express';
import {
  createCampaign,
  sendCampaign,
  launchCampaignDirect,
  getAllCampaigns,
  getCampaignById,
  deleteCampaign,
} from '../controllers/campaignController.js';
import { uploadAttachment } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/', uploadAttachment.single('attachment'), createCampaign);
router.post('/launch', uploadAttachment.single('attachment'), launchCampaignDirect);
router.post('/:id/send', uploadAttachment.single('attachment'), sendCampaign);
router.get('/', getAllCampaigns);
router.get('/:id', getCampaignById);
router.delete('/:id', deleteCampaign);

export default router;
