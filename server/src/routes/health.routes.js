const express = require('express');
const { getHealth, getMetrics } = require('../controllers/health.controller');

const router = express.Router();

router.get('/', getHealth);
router.get('/metrics', getMetrics);

module.exports = router;
