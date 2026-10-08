import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { listTransactions, createTransaction, getTransaction, updateTransaction, deleteTransaction } from '../controllers/transactionController.js';

const router = Router();
router.use(protect);
router.route('/').get(listTransactions).post(createTransaction);
router.route('/:id').get(getTransaction).put(updateTransaction).delete(deleteTransaction);
export default router;
