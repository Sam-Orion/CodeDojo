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

/**
 * Submit a message to AI and get response
 * @route POST /api/v1/ai/messages
 */
const submitMessage = asyncHandler(async (req, res) => {
  const { conversationId, content, provider } = req.body;
  const userId = req.user?.id;

  // Validate required fields
  if (!conversationId || !content) {
    return res.status(400).json({
      success: false,
      error: 'conversationId and content are required',
    });
  }

  // Validate message is not empty
  if (content.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Message content cannot be empty',
    });
  }

  try {
    logger.info('Message submission received', {
      userId,
      conversationId,
      provider,
      contentLength: content.length,
    });

    // Call AI service to process the message
    const result = await aiAssistantService.processMessage({
      userId,
      conversationId,
      content,
      provider,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Message submission error', {
      error: error.message,
      userId,
      conversationId,
    });

    // Handle specific error types
    if (error.message.includes('timeout')) {
      return res.status(408).json({
        success: false,
        error: 'Request timeout. Please try again.',
      });
    }

    if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
      return res.status(503).json({
        success: false,
        error: 'Service unavailable. Please try again later.',
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process message',
    });
  }
});

/**
 * Stream a message response to AI with real-time token updates
 * @route POST /api/v1/ai/messages/stream
 */
const streamMessage = asyncHandler(async (req, res) => {
  const { conversationId, content, provider } = req.body;
  const userId = req.user?.id;

  // Validate required fields
  if (!conversationId || !content) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'conversationId and content are required' }));
    return;
  }

  // Validate message is not empty
  if (content.trim().length === 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Message content cannot be empty' }));
    return;
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
    logger.info('Message stream started', {
      userId,
      conversationId,
      provider,
      contentLength: content.length,
    });

    // Get the streaming generator from AI service
    const messageStream = aiAssistantService.processMessageStream({
      userId,
      conversationId,
      content,
      provider,
    });

    // Send events to client as they arrive
    for await (const chunk of messageStream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    // Send completion event
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error) {
    logger.error('Stream message error', {
      error: error.message,
      userId,
      conversationId,
    });
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        error: error.message || 'Streaming failed',
      })}\n\n`
    );
    res.end();
  }
});

module.exports = {
  streamCompletion,
  explainCode,
  refactorCode,
  cancelRequest,
  getProviders,
  getCacheStats,
  submitFeedback,
  submitMessage,
  streamMessage,
};
