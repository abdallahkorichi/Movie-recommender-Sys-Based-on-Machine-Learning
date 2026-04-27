import express from 'express';
import { getContent, getContentById } from '../controllers/contentController.js';

const router = express.Router();

router.get('/',    getContent);
router.get('/:id', getContentById);

export default router;
