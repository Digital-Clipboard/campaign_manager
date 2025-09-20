import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { campaignService } from '../services/campaignService';
import { CampaignCreateRequest } from '../types';
import { logger } from '../index';

const router = Router();

// Validation schemas
const campaignCreateSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string().valid('email', 'social', 'content', 'ppc', 'seo', 'multi-channel').required(),
  target_audience: Joi.string().required(),
  goals: Joi.array().items(Joi.string()).required(),
  budget: Joi.number().optional(),
  start_date: Joi.string().isoDate().required(),
  end_date: Joi.string().isoDate().optional(),
  channels: Joi.array().items(Joi.string()).optional(),
  content: Joi.string().optional()
});

// Create campaign
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { error, value } = campaignCreateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const request: CampaignCreateRequest = value;
    const campaign = await campaignService.createCampaign(request);

    res.status(201).json({
      success: true,
      campaign
    });
  } catch (error: any) {
    logger.error('Error creating campaign:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// Get campaign by ID
router.get('/:id', (req: Request, res: Response) => {
  try {
    const campaign = campaignService.getCampaign(req.params.id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    res.json({
      success: true,
      campaign
    });
  } catch (error: any) {
    logger.error('Error fetching campaign:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// List campaigns
router.get('/', (req: Request, res: Response) => {
  try {
    const filters = {
      status: req.query.status as string,
      type: req.query.type as string
    };

    const campaigns = campaignService.listCampaigns(filters);

    res.json({
      success: true,
      campaigns,
      count: campaigns.length
    });
  } catch (error: any) {
    logger.error('Error listing campaigns:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Analyze campaign
router.post('/:id/analyze', async (req: Request, res: Response) => {
  try {
    const analysis = await campaignService.analyzeCampaign(req.params.id);

    res.json({
      success: true,
      ...analysis
    });
  } catch (error: any) {
    logger.error('Error analyzing campaign:', error);
    res.status(error.message === 'Campaign not found' ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
});

// Optimize campaign
router.post('/:id/optimize', async (req: Request, res: Response) => {
  try {
    const { goals } = req.body;
    if (!goals || !Array.isArray(goals)) {
      return res.status(400).json({
        success: false,
        error: 'Optimization goals are required'
      });
    }

    const optimization = await campaignService.optimizeCampaign(req.params.id, goals);

    res.json({
      success: true,
      ...optimization
    });
  } catch (error: any) {
    logger.error('Error optimizing campaign:', error);
    res.status(error.message === 'Campaign not found' ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
});

// Update campaign status
router.patch('/:id/status', (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const validStatuses = ['draft', 'active', 'paused', 'scheduled', 'completed'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const campaign = campaignService.updateCampaignStatus(req.params.id, status);

    res.json({
      success: true,
      campaign
    });
  } catch (error: any) {
    logger.error('Error updating campaign status:', error);
    res.status(error.message === 'Campaign not found' ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete campaign
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const deleted = campaignService.deleteCampaign(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    res.json({
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (error: any) {
    logger.error('Error deleting campaign:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;