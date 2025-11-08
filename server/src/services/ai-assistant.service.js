const aiProviderFactory = require('./ai/ai-provider-factory');
const aiCache = require('./ai/ai-cache');
const { AICredential } = require('../models');
const { logger } = require('../utils/logger');
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
    } catch (error) {
      logger.error('Failed to initialize AI providers', { error: error.message });
    }
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
}

module.exports = new AIAssistantService();
