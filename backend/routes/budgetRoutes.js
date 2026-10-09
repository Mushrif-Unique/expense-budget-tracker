import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getCurrentBudget, setCurrentBudget } from '../controllers/budgetController.js';

const router = Router();
router.use(protect);
router.route('/current').get(getCurrentBudget).put(setCurrentBudget);
export default router;
