const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const terminalRoutes = require('./terminal.routes');
const aiAssistantRoutes = require('./ai-assistant.routes');
const aiCredentialsRoutes = require('./ai-credentials.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/terminal', terminalRoutes);
router.use('/ai', aiAssistantRoutes);
router.use('/ai/credentials', aiCredentialsRoutes);

module.exports = router;
