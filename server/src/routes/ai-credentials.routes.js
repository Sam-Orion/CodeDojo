const express = require('express');
const aiCredentialsController = require('../controllers/ai-credentials.controller');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * @route POST /api/v1/ai/credentials
 * @desc Create new AI credential
 * @access Private
 */
router.post('/', aiCredentialsController.createCredential);

/**
 * @route GET /api/v1/ai/credentials
 * @desc Get user's AI credentials
 * @access Private
 */
router.get('/', aiCredentialsController.getCredentials);

/**
 * @route GET /api/v1/ai/credentials/stats
 * @desc Get credential usage statistics
 * @access Private
 */
router.get('/stats', aiCredentialsController.getCredentialStats);

/**
 * @route GET /api/v1/ai/credentials/:id
 * @desc Get specific credential
 * @access Private
 */
router.get('/:id', aiCredentialsController.getCredential);

/**
 * @route PUT /api/v1/ai/credentials/:id
 * @desc Update credential
 * @access Private
 */
router.put('/:id', aiCredentialsController.updateCredential);

/**
 * @route DELETE /api/v1/ai/credentials/:id
 * @desc Delete credential
 * @access Private
 */
router.delete('/:id', aiCredentialsController.deleteCredential);

/**
 * @route POST /api/v1/ai/credentials/:id/test
 * @desc Test credential validity
 * @access Private
 */
router.post('/:id/test', aiCredentialsController.testCredential);

module.exports = router;
