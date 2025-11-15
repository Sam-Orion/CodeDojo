const express = require('express');
const aiAssistantController = require('../controllers/ai-assistant.controller');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * @route POST /api/v1/ai/completion/stream
 * @desc Stream code completion
 * @access Private
 */
router.post('/completion/stream', aiAssistantController.streamCompletion);

/**
 * @route POST /api/v1/ai/explain
 * @desc Explain code with streaming response
 * @access Private
 */
router.post('/explain', aiAssistantController.explainCode);

/**
 * @route POST /api/v1/ai/refactor
 * @desc Refactor code with streaming response
 * @access Private
 */
router.post('/refactor', aiAssistantController.refactorCode);

/**
 * @route POST /api/v1/ai/cancel
 * @desc Cancel active AI request
 * @access Private
 */
router.post('/cancel', aiAssistantController.cancelRequest);

/**
 * @route GET /api/v1/ai/providers
 * @desc Get available AI providers
 * @access Private
 */
router.get('/providers', aiAssistantController.getProviders);

/**
 * @route GET /api/v1/ai/cache/stats
 * @desc Get cache statistics
 * @access Private
 */
router.get('/cache/stats', aiAssistantController.getCacheStats);

/**
 * @route POST /api/v1/ai/feedback
 * @desc Submit feedback for AI response
 * @access Private
 */
router.post('/feedback', aiAssistantController.submitFeedback);

/**
 * @route POST /api/v1/ai/messages/stream
 * @desc Stream a message response with real-time token updates
 * @access Private
 */
router.post('/messages/stream', aiAssistantController.streamMessage);

/**
 * @route POST /api/v1/ai/messages
 * @desc Submit a message and get AI response
 * @access Private
 */
router.post('/messages', aiAssistantController.submitMessage);

/**
 * @route POST /api/v1/ai/suggestions
 * @desc Get AI code suggestions based on context
 * @access Private
 */
router.post('/suggestions', aiAssistantController.getCodeSuggestions);

/**
 * @route POST /api/v1/ai/suggestions/telemetry
 * @desc Submit telemetry for AI suggestions
 * @access Private
 */
router.post('/suggestions/telemetry', aiAssistantController.submitSuggestionTelemetry);

module.exports = router;
