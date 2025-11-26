import express from 'express';
import {
    createExpense,
    getExpenses,
    getExpenseById,
    updateExpense,
    deleteExpense,
    getExpenseStatistics
} from '../../controllers/expense/expenseController.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';

const router = express.Router();

// Employee routes (authenticated)
router.post('/', isAuthenticated, createExpense);
router.get('/', isAuthenticated, getExpenses);
router.get('/statistics', isAuthenticated, getExpenseStatistics);
router.get('/:id', isAuthenticated, getExpenseById);
router.put('/:id', isAuthenticated, updateExpense);
router.delete('/:id', isAuthenticated, deleteExpense);

// Admin routes (for approval/rejection)
router.post('/:id/approve', isAdminAuthenticated, async (req, res, next) => {
    const { approveExpense } = await import('../../controllers/expense/expenseController.js');
    approveExpense(req, res, next);
});

router.post('/:id/reject', isAdminAuthenticated, async (req, res, next) => {
    const { rejectExpense } = await import('../../controllers/expense/expenseController.js');
    rejectExpense(req, res, next);
});

router.post('/:id/mark-paid', isAdminAuthenticated, async (req, res, next) => {
    const { markExpenseAsPaid } = await import('../../controllers/expense/expenseController.js');
    markExpenseAsPaid(req, res, next);
});

export default router;

