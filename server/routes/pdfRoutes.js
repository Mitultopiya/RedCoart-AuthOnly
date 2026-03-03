import express from 'express';
import * as c from '../controllers/pdfController.js';
import { verifyToken, adminOrManager } from '../middleware/auth.js';

const router = express.Router();
router.use(verifyToken);
router.use(adminOrManager);

router.get('/itinerary/:id', c.itinerary);
router.get('/invoice/:id', c.invoice);
router.get('/invoice-doc/:id', c.invoiceDocPdf);
router.get('/quotation/:id', c.quotationPdf);

export default router;
