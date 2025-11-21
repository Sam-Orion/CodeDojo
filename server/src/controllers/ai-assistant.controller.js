const aiAssistantService = require('../services/ai-assistant.service');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');
const { AIConversation } = require('../models');

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

/**
 * Get code suggestions
 * @route POST /api/v1/ai/suggestions
 */
const getCodeSuggestions = asyncHandler(async (req, res) => {
  const { context, maxSuggestions, temperature } = req.body;
  const userId = req.user?.id;

  if (!context || !context.language || !context.fileContent) {
    return res.status(400).json({
      success: false,
      error: 'context with language and fileContent is required',
    });
  }

  try {
    const sessionId = req.body.sessionId || `suggestions-${Date.now()}`;

    const result = await aiAssistantService.getCodeSuggestions({
      userId,
      sessionId,
      context,
      maxSuggestions,
      temperature,
      provider: req.body.provider,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Code suggestions error', {
      error: error.message,
      userId,
    });

    if (error.message.includes('timeout')) {
      return res.status(408).json({
        success: false,
        error: 'Request timeout. Please try again.',
      });
    }

    if (error.message.includes('rate limit')) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please wait before requesting more suggestions.',
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get code suggestions',
    });
  }
});

/**
 * Submit telemetry for AI suggestions
 * @route POST /api/v1/ai/suggestions/telemetry
 */
const submitSuggestionTelemetry = asyncHandler(async (req, res) => {
  const { requestId, suggestionId, action, timestamp, context } = req.body;
  const userId = req.user?.id;

  if (!requestId || !suggestionId || !action) {
    return res.status(400).json({
      success: false,
      error: 'requestId, suggestionId, and action are required',
    });
  }

  logger.info('AI suggestion telemetry received', {
    userId,
    requestId,
    suggestionId,
    action,
    timestamp: timestamp || Date.now(),
    contextLanguage: context?.language,
  });

  res.json({ success: true });
});

/**
 * Create a new conversation
 * @route POST /api/v1/ai/conversations
 */
const createConversation = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { title } = req.body;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated',
    });
  }

  const conversationId = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const conversation = new AIConversation({
    conversationId,
    userId,
    title: title || null,
    messages: [],
    isFavorite: false,
    status: 'active',
    archivedAt: null,
    deletedAt: null,
    deletedBy: null,
    metadata: {},
  });

  await conversation.save();

  logger.info('Conversation created', { userId, conversationId });

  res.json({
    success: true,
    data: conversation.toJSON(),
  });
});

/**
 * Get all conversations for user
 * @route GET /api/v1/ai/conversations
 */
const getConversations = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated',
    });
  }

  const { limit, skip, sortBy, sortOrder, status } = req.query;
  const allowedStatuses = ['active', 'archived', 'deleted'];

  const normalizeStatuses = (rawStatus) => {
    if (!rawStatus) {
      return ['active'];
    }

    const values = Array.isArray(rawStatus) ? rawStatus : String(rawStatus).split(',');
    const normalized = values
      .map((value) => value.trim().toLowerCase())
      .map((value) => (value === 'trash' ? 'deleted' : value))
      .filter((value) => allowedStatuses.includes(value) || value === 'all');

    if (normalized.includes('all')) {
      return allowedStatuses;
    }

    return normalized.length > 0 ? normalized : ['active'];
  };

  const normalizedStatuses = normalizeStatuses(status);
  let statusFilter = 'active';

  if (normalizedStatuses.length === allowedStatuses.length) {
    statusFilter = 'all';
  } else if (normalizedStatuses.length === 1) {
    statusFilter = normalizedStatuses[0];
  } else {
    statusFilter = normalizedStatuses;
  }

  const conversations = await AIConversation.findByUser(userId, {
    limit: limit ? parseInt(limit, 10) : 50,
    skip: skip ? parseInt(skip, 10) : 0,
    sortBy: sortBy || 'updatedAt',
    sortOrder: sortOrder ? parseInt(sortOrder, 10) : -1,
    status: statusFilter,
  });

  res.json({
    success: true,
    data: conversations.map((conv) => conv.toJSON()),
  });
});

/**
 * Get a single conversation with messages
 * @route GET /api/v1/ai/conversations/:conversationId
 */
const getConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated',
    });
  }

  if (!conversationId) {
    return res.status(400).json({
      success: false,
      error: 'Conversation ID is required',
    });
  }

  const conversation = await AIConversation.findByUserAndId(userId, conversationId);

  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: 'Conversation not found',
    });
  }

  res.json({
    success: true,
    data: conversation.toJSON(),
  });
});

/**
 * Update conversation (rename, favorite)
 * @route PATCH /api/v1/ai/conversations/:conversationId
 */
const updateConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { title, isFavorite, status: nextStatus } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated',
    });
  }

  if (!conversationId) {
    return res.status(400).json({
      success: false,
      error: 'Conversation ID is required',
    });
  }

  // Validate input
  if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
    return res.status(400).json({
      success: false,
      error: 'Title must be a non-empty string',
    });
  }

  const conversation = await AIConversation.findByUserAndId(userId, conversationId);

  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: 'Conversation not found',
    });
  }

  if (nextStatus !== undefined) {
    const allowedStatuses = ['active', 'archived'];
    if (!allowedStatuses.includes(nextStatus)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid conversation status. Allowed values are active or archived.',
      });
    }

    if (conversation.status === 'deleted' && nextStatus === 'archived') {
      return res.status(400).json({
        success: false,
        error: 'Deleted conversations must be restored before they can be archived.',
      });
    }

    if (nextStatus === 'archived') {
      conversation.status = 'archived';
      conversation.archivedAt = new Date();
    } else if (nextStatus === 'active') {
      conversation.status = 'active';
      conversation.archivedAt = null;
      conversation.deletedAt = null;
      conversation.deletedBy = null;
    }
  }

  // Update fields
  if (title !== undefined) {
    conversation.title = title.trim();
  }
  if (isFavorite !== undefined) {
    conversation.isFavorite = Boolean(isFavorite);
  }

  conversation.updatedAt = new Date();
  await conversation.save();

  logger.info('Conversation updated', {
    userId,
    conversationId,
    title,
    isFavorite,
    status: nextStatus,
  });

  res.json({
    success: true,
    data: conversation.toJSON(),
  });
});

/**
 * Delete a conversation
 * @route DELETE /api/v1/ai/conversations/:conversationId
 */
const deleteConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user?.id;
  const forceDelete =
    req.query.force === 'true' || req.query.force === '1' || req.body?.force === true;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated',
    });
  }

  if (!conversationId) {
    return res.status(400).json({
      success: false,
      error: 'Conversation ID is required',
    });
  }

  const conversation = await AIConversation.findByUserAndId(userId, conversationId);

  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: 'Conversation not found',
    });
  }

  if (forceDelete) {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can permanently delete conversations',
      });
    }

    await AIConversation.deleteOne({ conversationId, userId });
    logger.info('Conversation hard deleted', { userId, conversationId });

    return res.json({
      success: true,
      data: { id: conversationId, hardDeleted: true },
    });
  }

  if (conversation.status === 'deleted') {
    return res.json({
      success: true,
      data: conversation.toJSON(),
    });
  }

  conversation.status = 'deleted';
  conversation.deletedAt = new Date();
  conversation.deletedBy = userId;
  conversation.archivedAt = null;
  conversation.updatedAt = new Date();
  await conversation.save();

  logger.info('Conversation soft deleted', { userId, conversationId });

  res.json({
    success: true,
    data: conversation.toJSON(),
  });
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
  getCodeSuggestions,
  submitSuggestionTelemetry,
  createConversation,
  getConversations,
  getConversation,
  updateConversation,
  deleteConversation,
};
