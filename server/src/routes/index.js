const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const terminalRoutes = require('./terminal.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/terminal', terminalRoutes);

module.exports = router;
