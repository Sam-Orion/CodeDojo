const aiProviderFactory = require('./ai/ai-provider-factory');
const aiCache = require('./ai/ai-cache');
const { AICredential, AIConversation } = require('../models');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * AI Assistant Service - Main service for AI code completion and assistance
 */
class AIAssistantService {
  constructor() {
    this.activeRequests = new Map(); // Track active streaming requests
    this.initializeProviders();

    // Cleanup expired cache entries every 5 minutes
    setInterval(() => aiCache.cleanup(), 300000);
  }

  /**
   * Initialize AI providers from environment variables
   */
  async initializeProviders() {
    try {
      // Initialize OpenAI if API key is available
      if (process.env.OPENAI_API_KEY) {
        aiProviderFactory.registerOpenAI(
          {
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: process.env.OPENAI_BASE_URL,
          },
          true
        ); // Set as default
        logger.info('OpenAI provider initialized from environment');
      }

      // Initialize Anthropic if API key is available
      if (process.env.ANTHROPIC_API_KEY) {
        aiProviderFactory.registerAnthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
          baseURL: process.env.ANTHROPIC_BASE_URL,
        });
        logger.info('Anthropic provider initialized from environment');
      }

      if (process.env.GEMINI_API_KEY) {
        aiProviderFactory.registerGemini({
          apiKey: process.env.GEMINI_API_KEY,
          baseURL: process.env.GEMINI_API_BASE_URL,
          model: process.env.GEMINI_MODEL,
        });
        logger.info('Gemini provider initialized from environment');
      }
    } catch (error) {
      logger.error('Failed to initialize AI providers', { error: error.message });
    }
  }

  /**
   * Ensure a conversation exists for the given user
   * @param {string} userId
   * @param {string} conversationId
   * @returns {Promise<AIConversation>}
   */
  async ensureConversation(userId, conversationId) {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    let conversation = await AIConversation.findByUserAndId(userId, conversationId);
    if (!conversation) {
      conversation = new AIConversation({
        conversationId,
        userId,
        title: null,
        messages: [],
        isFavorite: false,
        metadata: {},
      });
    }

    return conversation;
  }

  /**
   * Append messages to a conversation and persist it
   * @param {string} userId
   * @param {string} conversationId
   * @param {Array<object>} messages
   */
  async addMessagesToConversation(userId, conversationId, messages = []) {
    if (!messages || messages.length === 0) {
      return null;
    }

    const conversation = await this.ensureConversation(userId, conversationId);
    messages.forEach((message) => conversation.addMessage(message));
    await conversation.save();
    return conversation;
  }

  /**
   * Update a conversation message
   * @param {string} userId
   * @param {string} conversationId
   * @param {string} messageId
   * @param {object} updates
   */
  async updateConversationMessage(userId, conversationId, messageId, updates) {
    const conversation = await AIConversation.findByUserAndId(userId, conversationId);
    if (!conversation) {
      return null;
    }
    const updated = conversation.updateMessage(messageId, updates);
    if (updated) {
      await conversation.save();
    }
    return updated ? conversation : null;
  }

  /**
   * Get user's AI provider with credentials
   * @param {string} userId - User ID
   * @param {string} preferredProvider - Preferred provider name
   * @returns {Object} - Provider instance and credential info
   */
  async getUserProvider(userId, preferredProvider = null) {
    // Try to get user's credential for preferred provider
    if (preferredProvider) {
      const credential = await AICredential.findByUserAndProvider(userId, preferredProvider);
      if (credential) {
        const provider = aiProviderFactory.getProvider(preferredProvider);
        // Create provider instance with user's API key
        const UserProviderClass = provider.constructor;
        const userProvider = new UserProviderClass({
          ...provider.config,
          apiKey: credential.getApiKey(),
          ...credential.metadata,
        });
        return { provider: userProvider, credential, providerName: preferredProvider };
      }
    }

    // Fallback to any available user credential
    const credentials = await AICredential.findByUser(userId);
    for (const cred of credentials) {
      if (aiProviderFactory.hasProvider(cred.provider)) {
        const baseProvider = aiProviderFactory.getProvider(cred.provider);
        const UserProviderClass = baseProvider.constructor;
        const userProvider = new UserProviderClass({
          ...baseProvider.config,
          apiKey: cred.getApiKey(),
          ...cred.metadata,
        });
        return { provider: userProvider, credential: cred, providerName: cred.provider };
      }
    }

    // Fallback to default provider with environment key
    const defaultProvider = aiProviderFactory.getProvider();
    return {
      provider: defaultProvider,
      credential: null,
      providerName: aiProviderFactory.defaultProvider,
    };
  }

  /**
   * Build contextual prompt from file content and cursor position
   * @param {Object} context - Code context
   * @returns {string} - Constructed prompt
   */
  buildPrompt(context) {
    const {
      language,
      fileContent,
      cursorPosition,
      prefix,
      suffix,
      instruction,
      recentOperations = [],
    } = context;

    let prompt = '';

    // Add language context
    if (language) {
      prompt += `Language: ${language}\n\n`;
    }

    // Add instruction if provided
    if (instruction) {
      prompt += `Task: ${instruction}\n\n`;
    }

    // Add file context with chunking for large files
    if (fileContent) {
      const maxContextLength = 8000; // Leave room for response
      let contextContent = fileContent;

      if (fileContent.length > maxContextLength) {
        // For large files, focus on cursor area
        const cursorOffset = cursorPosition || 0;
        const halfContext = maxContextLength / 2;
        const start = Math.max(0, cursorOffset - halfContext);
        const end = Math.min(fileContent.length, cursorOffset + halfContext);

        contextContent = fileContent.slice(start, end);
        prompt += `Note: Showing excerpt from larger file (positions ${start}-${end})\n\n`;
      }

      prompt += 'File content:\n```\n' + contextContent + '\n```\n\n';
    }

    // Add cursor position context
    if (prefix !== undefined || suffix !== undefined) {
      prompt += 'Code around cursor:\n';
      if (prefix) {
        prompt += 'Before cursor:\n```\n' + prefix + '\n```\n\n';
      }
      if (suffix) {
        prompt += 'After cursor:\n```\n' + suffix + '\n```\n\n';
      }
    }

    // Add recent operations for context
    if (recentOperations.length > 0) {
      prompt += 'Recent changes:\n';
      recentOperations.slice(-5).forEach((op, index) => {
        prompt += `${index + 1}. ${op.type}: ${JSON.stringify(op.content).slice(0, 100)}...\n`;
      });
      prompt += '\n';
    }

    // Add completion request
    if (!instruction) {
      prompt += 'Please provide code completion or suggestion based on the context above.';
    }

    return prompt;
  }

  /**
   * Stream code completion
   * @param {Object} params - Completion parameters
   * @returns {AsyncGenerator} - Streaming completion
   */
  async *streamCompletion(params) {
    const {
      userId,
      sessionId,
      context,
      provider,
      model,
      maxTokens = 1000,
      temperature = 0.7,
      instruction = null,
      useCache = true,
    } = params;

    const requestId = uuidv4();

    try {
      // Check for existing active request
      if (this.activeRequests.has(`${userId}:${sessionId}`)) {
        throw new Error('Another AI request is already active for this session');
      }

      this.activeRequests.set(`${userId}:${sessionId}`, requestId);

      // Get user's provider
      const {
        provider: aiProvider,
        credential,
        providerName,
      } = await this.getUserProvider(userId, provider);

      // Build prompt
      const prompt = this.buildPrompt({ ...context, instruction });

      // Check cache first
      if (useCache) {
        const cacheKey = aiCache.generateKey({
          provider: providerName,
          model: model || 'default',
          prompt,
          maxTokens,
          temperature,
        });

        const cached = aiCache.get(cacheKey);
        if (cached) {
          yield { content: cached.content, finishReason: 'cached', usage: cached.usage };
          return;
        }
      }

      // Stream from provider
      let fullResponse = '';
      let usage = null;
      const startTime = Date.now();

      for await (const chunk of aiProvider.streamCompletion({
        prompt,
        model,
        maxTokens,
        temperature,
        userId,
        sessionId,
      })) {
        fullResponse += chunk.content;
        usage = chunk.usage;

        yield {
          ...chunk,
          requestId,
          provider: providerName,
          timestamp: Date.now(),
        };
      }

      // Cache the response
      if (useCache && fullResponse) {
        const cacheKey = aiCache.generateKey({
          provider: providerName,
          model: model || 'default',
          prompt,
          maxTokens,
          temperature,
        });

        aiCache.set(cacheKey, {
          content: fullResponse,
          usage,
          provider: providerName,
        });
      }

      // Update credential usage
      if (credential) {
        await credential.incrementUsage();
      }

      // Log metrics
      const duration = Date.now() - startTime;
      logger.info('AI completion completed', {
        userId,
        sessionId,
        provider: providerName,
        model,
        duration,
        tokens: usage?.total_tokens || 0,
        responseLength: fullResponse.length,
      });
    } catch (error) {
      logger.error('AI completion error', {
        userId,
        sessionId,
        error: error.message,
        requestId,
      });
      throw error;
    } finally {
      this.activeRequests.delete(`${userId}:${sessionId}`);
    }
  }

  /**
   * Cancel active request
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   */
  cancelRequest(userId, sessionId) {
    const key = `${userId}:${sessionId}`;
    if (this.activeRequests.has(key)) {
      this.activeRequests.delete(key);
      logger.info('AI request cancelled', { userId, sessionId });
    }
  }

  /**
   * Get code explanation
   * @param {Object} params - Explanation parameters
   * @returns {AsyncGenerator} - Streaming explanation
   */
  async *explainCode(params) {
    const { code, language = 'javascript' } = params;

    const instruction = `Please explain this ${language} code in detail. Focus on:
1. What the code does
2. How it works
3. Key concepts or patterns used
4. Any potential improvements or best practices

Code to explain:
\`\`\`${language}
${code}
\`\`\``;

    yield* this.streamCompletion({
      ...params,
      context: { language, fileContent: code },
      instruction,
      maxTokens: 1500,
      temperature: 0.3,
    });
  }

  /**
   * Refactor code
   * @param {Object} params - Refactoring parameters
   * @returns {AsyncGenerator} - Streaming refactoring
   */
  async *refactorCode(params) {
    const { code, language = 'javascript', refactorType = 'improve' } = params;

    const instructions = {
      improve: 'Improve this code for better readability, performance, and maintainability.',
      optimize: 'Optimize this code for better performance.',
      modernize: 'Modernize this code using current best practices and language features.',
      simplify: 'Simplify this code while maintaining the same functionality.',
    };

    const instruction = `${instructions[refactorType] || instructions.improve}

Provide the refactored code and explain the changes made.

Original code:
\`\`\`${language}
${code}
\`\`\``;

    yield* this.streamCompletion({
      ...params,
      context: { language, fileContent: code },
      instruction,
      maxTokens: 2000,
      temperature: 0.2,
    });
  }

  /**
   * Process a chat message and get AI response
   * @param {Object} params - Message parameters
   * @returns {Object} - Message response with user and assistant messages
   */
  async processMessage(params) {
    const { userId, conversationId, content, provider: preferredProvider = null } = params;

    try {
      // Get user provider or default
      const { provider, providerName } = await this.getUserProvider(userId, preferredProvider);

      // Generate unique message IDs
      const userMessageId = uuidv4();
      const assistantMessageId = uuidv4();
      const timestamp = Date.now();

      // Create user message
      const userMessage = {
        id: userMessageId,
        role: 'user',
        content,
        timestamp,
        status: 'success',
        feedback: null,
      };

      // Persist the user's message immediately
      await this.addMessagesToConversation(userId, conversationId, [userMessage]);

      // Prepare prompt for AI
      const prompt = `You are a helpful AI assistant. Please respond to the following message:

${content}`;

      // Call AI provider (non-streaming version)
      let assistantContent = '';
      let tokenCount = 0;

      try {
        // Use the provider's stream method and collect all chunks
        const stream = provider.streamCompletion({
          prompt,
          maxTokens: 2000,
          temperature: 0.7,
        });

        for await (const chunk of stream) {
          if (chunk.type === 'content') {
            assistantContent += chunk.content || '';
          } else if (chunk.type === 'done' && chunk.usage) {
            tokenCount = chunk.usage.totalTokens || 0;
          }
        }
      } catch (streamError) {
        logger.error('Stream processing error', { error: streamError.message });
        throw new Error(`AI provider error: ${streamError.message}`);
      }

      if (!assistantContent) {
        throw new Error('No response received from AI provider');
      }

      // Create assistant message
      const assistantMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: assistantContent,
        timestamp: Date.now(),
        model: providerName,
        tokenCount,
        status: 'success',
        feedback: null,
      };

      // Save assistant message
      await this.addMessagesToConversation(userId, conversationId, [assistantMessage]);

      logger.info('Message processed successfully', {
        userId,
        conversationId,
        provider: providerName,
        tokenCount,
      });

      // Return both messages
      return {
        userMessage,
        assistantMessage,
      };
    } catch (error) {
      logger.error('Process message error', {
        error: error.message,
        userId,
        conversationId,
      });
      throw error;
    }
  }

  /**
   * Process a chat message with streaming response
   * @param {Object} params - Message parameters
   * @returns {AsyncGenerator} - Streaming response tokens
   */
  async *processMessageStream(params) {
    const { userId, conversationId, content, provider: preferredProvider = null } = params;
    const requestId = uuidv4();

    try {
      // Get user provider or default
      const { provider, providerName } = await this.getUserProvider(userId, preferredProvider);

      // Generate unique message IDs
      const userMessageId = uuidv4();
      const assistantMessageId = uuidv4();
      const timestamp = Date.now();

      // Create and save user message immediately
      const userMessage = {
        id: userMessageId,
        role: 'user',
        content,
        timestamp,
        status: 'success',
        feedback: null,
      };

      await this.addMessagesToConversation(userId, conversationId, [userMessage]);

      // Yield user message info
      yield {
        type: 'userMessage',
        messageId: userMessageId,
      };

      // Prepare prompt for AI
      const prompt = `You are a helpful AI assistant. Please respond to the following message:

${content}`;

      logger.info('Starting message stream', {
        userId,
        conversationId,
        provider: providerName,
        requestId,
      });

      let totalTokens = 0;
      let assistantContent = '';

      // Send assistant message ID
      yield {
        type: 'assistantMessageId',
        messageId: assistantMessageId,
      };

      // Stream completion from provider
      const stream = provider.streamCompletion({
        prompt,
        maxTokens: 2000,
        temperature: 0.7,
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content' && chunk.content) {
          assistantContent += chunk.content;
          // Stream each token/chunk as it arrives
          yield {
            type: 'token',
            token: chunk.content,
            tokenCount: totalTokens,
          };
        } else if (chunk.type === 'done' && chunk.usage) {
          totalTokens = chunk.usage.totalTokens || 0;
          // Send final metadata
          yield {
            type: 'metadata',
            tokenCount: totalTokens,
          };
        }
      }

      // Save the assistant message to database
      const assistantMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: assistantContent,
        timestamp: Date.now(),
        model: providerName,
        tokenCount: totalTokens,
        status: 'success',
        feedback: null,
      };

      await this.addMessagesToConversation(userId, conversationId, [assistantMessage]);

      logger.info('Message stream completed', {
        userId,
        conversationId,
        provider: providerName,
        totalTokens,
        requestId,
      });
    } catch (error) {
      logger.error('Process message stream error', {
        error: error.message,
        userId,
        conversationId,
        requestId,
      });
      yield {
        type: 'error',
        error: error.message,
      };
    }
  }

  /**
   * Get available providers and capabilities
   * @returns {Object} - Provider information
   */
  getProviders() {
    return {
      available: aiProviderFactory.getAvailableProviders(),
      default: aiProviderFactory.defaultProvider,
    };
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache stats
   */
  getCacheStats() {
    return aiCache.getStats();
  }

  /**
   * Get code suggestions from AI
   * @param {Object} params - Suggestion parameters
   * @returns {Object} - Array of suggestions with confidence scores
   */
  async getCodeSuggestions(params) {
    const {
      userId,
      sessionId,
      context,
      maxSuggestions = 5,
      temperature = 0.3,
      provider: preferredProvider = null,
    } = params;

    const requestId = uuidv4();

    try {
      const { provider, providerName } = await this.getUserProvider(userId, preferredProvider);

      const prompt = `You are an AI code completion assistant. Based on the following context, provide ${maxSuggestions} relevant code suggestions.

Language: ${context.language}
Current line: ${context.currentLine}

Code before cursor:
\`\`\`
${context.prefix.substring(Math.max(0, context.prefix.length - 300))}
\`\`\`

Code after cursor:
\`\`\`
${context.suffix.substring(0, 300)}
\`\`\`

Provide suggestions as a JSON array with this structure:
[
  {
    "content": "suggested code",
    "confidence": 0.95,
    "description": "Brief description of what this does"
  }
]

Focus on:
1. Completing the current statement or expression
2. Suggesting common patterns that fit the context
3. Maintaining code style and conventions
4. Only suggesting syntactically valid code

Return ONLY the JSON array, no additional text.`;

      const startTime = Date.now();
      let fullResponse = '';

      for await (const chunk of provider.streamCompletion({
        prompt,
        model: null,
        maxTokens: 800,
        temperature,
        userId,
        sessionId,
      })) {
        fullResponse += chunk.content;
      }

      let suggestions = [];
      try {
        const jsonMatch = fullResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          suggestions = parsed
            .filter((s) => s.content && s.confidence)
            .slice(0, maxSuggestions)
            .map((s, index) => ({
              id: `${requestId}-${index}`,
              content: s.content.trim(),
              confidence: Math.min(1, Math.max(0, s.confidence)),
              description: s.description || 'AI code suggestion',
            }));
        }
      } catch (parseError) {
        logger.warn('Failed to parse AI suggestions response', {
          error: parseError.message,
          response: fullResponse.substring(0, 200),
        });

        const lines = fullResponse.split('\n').filter((l) => l.trim());
        suggestions = lines.slice(0, maxSuggestions).map((content, index) => ({
          id: `${requestId}-${index}`,
          content: content.trim(),
          confidence: 0.6,
          description: 'AI code suggestion',
        }));
      }

      const duration = Date.now() - startTime;
      logger.info('Code suggestions generated', {
        userId,
        sessionId,
        provider: providerName,
        suggestionCount: suggestions.length,
        duration,
      });

      return {
        suggestions,
        requestId,
        provider: providerName,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Code suggestion error', {
        userId,
        sessionId,
        error: error.message,
        requestId,
      });
      throw error;
    }
  }
}

module.exports = new AIAssistantService();
