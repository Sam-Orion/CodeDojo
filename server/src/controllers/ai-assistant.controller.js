const aiAssistantService = require('../services/ai-assistant.service');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Stream code completion
 */
const streamCompletion = asyncHandler(async (req, res) => {
  const { userId, sessionId } = req.body;
  const { instruction } = req.query;

  // Validate required fields
  if (!userId || !sessionId) {
    return res.status(400).json({
      error: 'userId and sessionId are required',
    });
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  try {
    const completionStream = aiAssistantService.streamCompletion({
      ...req.body,
      instruction,
      userId: req.user?.id || userId,
      sessionId,
    });

    // Send events to client
    for await (const chunk of completionStream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    // Send completion event
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error) {
    logger.error('Stream completion error', { error: error.message, userId, sessionId });
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        error: error.message,
      })}\n\n`
    );
    res.end();
  }
});

/**
 * Explain code
 */
const explainCode = asyncHandler(async (req, res) => {
  const { userId, sessionId } = req.body;

  if (!userId || !sessionId) {
    return res.status(400).json({
      error: 'userId and sessionId are required',
    });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  try {
    const explanationStream = aiAssistantService.explainCode({
      ...req.body,
      userId: req.user?.id || userId,
      sessionId,
    });

    for await (const chunk of explanationStream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error) {
    logger.error('Explain code error', { error: error.message, userId, sessionId });
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        error: error.message,
      })}\n\n`
    );
    res.end();
  }
});

/**
 * Refactor code
 */
const refactorCode = asyncHandler(async (req, res) => {
  const { userId, sessionId } = req.body;

  if (!userId || !sessionId) {
    return res.status(400).json({
      error: 'userId and sessionId are required',
    });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  try {
    const refactorStream = aiAssistantService.refactorCode({
      ...req.body,
      userId: req.user?.id || userId,
      sessionId,
    });

    for await (const chunk of refactorStream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error) {
    logger.error('Refactor code error', { error: error.message, userId, sessionId });
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        error: error.message,
      })}\n\n`
    );
    res.end();
  }
});

/**
 * Cancel active request
 */
const cancelRequest = asyncHandler(async (req, res) => {
  const { userId, sessionId } = req.body;

  if (!userId || !sessionId) {
    return res.status(400).json({
      error: 'userId and sessionId are required',
    });
  }

  aiAssistantService.cancelRequest(req.user?.id || userId, sessionId);

  res.json({ success: true });
});

/**
 * Get available providers
 */
const getProviders = asyncHandler(async (req, res) => {
  const providers = aiAssistantService.getProviders();
  res.json(providers);
});

/**
 * Get cache statistics
 */
const getCacheStats = asyncHandler(async (req, res) => {
  const stats = aiAssistantService.getCacheStats();
  res.json(stats);
});

/**
 * Submit feedback for AI response
 */
const submitFeedback = asyncHandler(async (req, res) => {
  const { requestId, helpful, rating, comment } = req.body;
  const userId = req.user?.id;

  if (!requestId || helpful === undefined) {
    return res.status(400).json({
      error: 'requestId and helpful are required',
    });
  }

  // Log feedback for accuracy metrics
  logger.info('AI feedback received', {
    requestId,
    userId,
    helpful,
    rating,
    comment,
    timestamp: new Date().toISOString(),
  });

  // In a real implementation, you'd store this in a database
  // For now, just log it

  res.json({ success: true });
});

module.exports = {
  streamCompletion,
  explainCode,
  refactorCode,
  cancelRequest,
  getProviders,
  getCacheStats,
  submitFeedback,
};
