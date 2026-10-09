import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getDashboardSummary } from '../controllers/dashboardController.js';

const router = Router();
router.get('/summary', protect, getDashboardSummary);
export default router;
