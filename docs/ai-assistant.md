# AI Assistant Backend

This document provides comprehensive information about the AI Assistant backend implementation, including API endpoints, WebSocket events, security considerations, and usage guidelines.

## Overview

The AI Assistant backend provides intelligent code completion, explanation, and refactoring capabilities with support for multiple AI providers. It features secure credential management, streaming responses, caching, and comprehensive telemetry.

## Features

- **Multiple AI Provider Support**: OpenAI, Anthropic Claude, Google Gemini, with extensible provider architecture
- **Secure Credential Storage**: Encrypted API key storage per user with scoped access
- **Streaming Responses**: Real-time token streaming for better UX
- **Intelligent Caching**: LRU cache to reduce latency and costs
- **Rate Limiting**: Per-user rate limiting to prevent abuse
- **Contextual Prompts**: Smart prompt construction using file content, cursor position, and recent operations
- **Telemetry**: Usage metrics, latency tracking, and accuracy feedback
- **WebSocket Integration**: Real-time AI assistance in collaborative editing sessions

## Architecture

### Core Components

1. **AI Provider Factory** (`services/ai/ai-provider-factory.js`)
   - Manages multiple AI providers
   - Handles provider registration and lifecycle
   - Provides default provider fallback

2. **Base AI Provider** (`services/ai/base-ai-provider.js`)
   - Abstract base class for all AI providers
   - Implements common functionality (rate limiting, caching)
   - Defines provider interface

3. **Provider Implementations**
   - **OpenAI Provider** (`services/ai/openai-provider.js`)
   - **Anthropic Provider** (`services/ai/anthropic-provider.js`)
   - **Gemini Provider** (`services/ai/gemini.provider.js`)

4. **AI Assistant Service** (`services/ai-assistant.service.js`)
   - Main service orchestrating AI operations
   - Handles prompt construction and context management
   - Manages caching and rate limiting

5. **Credential Management** (`models/AICredential.js`)
   - Secure storage of encrypted API keys
   - User-scoped credential access
   - Usage tracking and statistics

## API Endpoints

### Authentication

All AI endpoints require authentication. In development mode, you can pass `userId` in the request body or `X-User-ID` header. In production, JWT tokens are required.

### AI Assistant Endpoints

#### Stream Code Completion

```http
POST /api/v1/ai/completion/stream
Content-Type: application/json

{
  "userId": "user123",
  "sessionId": "session456",
  "context": {
    "language": "javascript",
    "fileContent": "const x = ",
    "cursorPosition": 10,
    "prefix": "const x = ",
    "suffix": ";",
    "recentOperations": [
      {"type": "insert", "content": "const"}
    ]
  },
  "provider": "openai",
  "model": "gpt-3.5-turbo",
  "maxTokens": 1000,
  "temperature": 0.7,
  "instruction": "Complete this variable declaration",
  "useCache": true
}
```

**Response**: Server-Sent Events (SSE) stream

```
data: {"content":"Hello","finishReason":null,"requestId":"req-123"}
data: {"content":" world","finishReason":"stop","usage":{"total_tokens":10}}
data: {"type":"done"}
```

#### Explain Code

```http
POST /api/v1/ai/explain
Content-Type: application/json

{
  "userId": "user123",
  "sessionId": "session456",
  "code": "const factorial = n => n <= 1 ? 1 : n * factorial(n-1);",
  "language": "javascript"
}
```

#### Refactor Code

```http
POST /api/v1/ai/refactor
Content-Type: application/json

{
  "userId": "user123",
  "sessionId": "session456",
  "code": "function old() { return x * x; }",
  "language": "javascript",
  "refactorType": "modernize"
}
```

**Refactor Types**: `improve`, `optimize`, `modernize`, `simplify`

#### Cancel Request

```http
POST /api/v1/ai/cancel
Content-Type: application/json

{
  "userId": "user123",
  "sessionId": "session456"
}
```

#### Get Providers

```http
GET /api/v1/ai/providers
```

#### Get Cache Statistics

```http
GET /api/v1/ai/cache/stats
```

#### Submit Feedback

```http
POST /api/v1/ai/feedback
Content-Type: application/json

{
  "requestId": "req-123",
  "helpful": true,
  "rating": 5,
  "comment": "Very helpful suggestion!"
}
```

### Credential Management Endpoints

#### Create Credential

```http
POST /api/v1/ai/credentials
Content-Type: application/json

{
  "provider": "openai",
  "apiKey": "sk-...",
  "displayName": "My OpenAI Key",
  "metadata": {
    "organization": "org-123",
    "model": "gpt-4"
  }
}
```

#### Get User Credentials

```http
GET /api/v1/ai/credentials
```

#### Get Credential Statistics

```http
GET /api/v1/ai/credentials/stats
```

#### Update Credential

```http
PUT /api/v1/ai/credentials/:id
Content-Type: application/json

{
  "displayName": "Updated Name",
  "isActive": true,
  "metadata": {
    "model": "gpt-4-turbo"
  }
}
```

#### Delete Credential

```http
DELETE /api/v1/ai/credentials/:id
```

#### Test Credential

```http
POST /api/v1/ai/credentials/:id/test
```

## WebSocket Events

### Client to Server

#### Request Completion

```json
{
  "type": "AI_COMPLETION_REQUEST",
  "userId": "user123",
  "sessionId": "session456",
  "context": {
    "language": "javascript",
    "fileContent": "const x = "
  },
  "provider": "openai",
  "model": "gpt-3.5-turbo"
}
```

#### Cancel Completion

```json
{
  "type": "AI_COMPLETION_CANCEL",
  "userId": "user123",
  "sessionId": "session456"
}
```

#### Explain Code

```json
{
  "type": "AI_EXPLAIN_REQUEST",
  "userId": "user123",
  "sessionId": "session456",
  "code": "const x = 1;",
  "language": "javascript"
}
```

#### Refactor Code

```json
{
  "type": "AI_REFACTOR_REQUEST",
  "userId": "user123",
  "sessionId": "session456",
  "code": "function old() {}",
  "language": "javascript",
  "refactorType": "modernize"
}
```

#### Submit Feedback

```json
{
  "type": "AI_FEEDBACK",
  "requestId": "req-123",
  "helpful": true,
  "rating": 5,
  "comment": "Great suggestion!"
}
```

### Server to Client

#### Completion Chunk

```json
{
  "type": "AI_COMPLETION_CHUNK",
  "userId": "user123",
  "sessionId": "session456",
  "content": "Hello world",
  "finishReason": null,
  "requestId": "req-123"
}
```

#### Completion Done

```json
{
  "type": "AI_COMPLETION_DONE",
  "userId": "user123",
  "sessionId": "session456"
}
```

#### Error

```json
{
  "type": "AI_COMPLETION_ERROR",
  "userId": "user123",
  "sessionId": "session456",
  "error": "Rate limit exceeded"
}
```

## Security Considerations

### API Key Storage

- API keys are encrypted using AES-256-GCM
- Encryption keys are managed via environment variables
- In development, a fallback key is used (not production-safe)
- Keys are never returned in plaintext after storage

### Environment Variables

```bash
# AI Provider Keys (for environment-based providers)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=sk-gemini-...
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_MODEL=gemini-1.5-flash-latest

# Encryption Key (required for production)
AI_ENCRYPTION_KEY=32-byte-hex-key

# JWT Secret (for production authentication)
JWT_SECRET=your-jwt-secret-min-32-chars
```

### Rate Limiting

- Per-user rate limiting: 60 requests per minute
- Per-session concurrent request limit: 1 active request
- Provider-specific rate limiting handled by individual providers

### Access Control

- Users can only access their own credentials
- Credential operations require authentication
- API keys are scoped per user and provider

## Performance Targets

### Latency

- **First Token**: < 500ms (cached), < 2000ms (uncached)
- **Streaming**: 50-100ms between tokens
- **Cache Hit**: < 50ms

### Accuracy

- **Target Accuracy**: 85% helpful suggestions
- **Context Utilization**: 90%+ of provided context used
- **Error Rate**: < 5% failed requests

### Caching

- **Cache Size**: 100 entries (LRU)
- **TTL**: 5 minutes
- **Hit Rate Target**: 30%+ for repeated requests

## Configuration

### Provider Configuration

```javascript
// OpenAI Provider
{
  apiKey: 'sk-...',
  baseURL: 'https://api.openai.com/v1', // optional
  organization: 'org-123' // optional
}

// Anthropic Provider
{
  apiKey: 'sk-ant-...',
  baseURL: 'https://api.anthropic.com' // optional
}

// Gemini Provider
{
  apiKey: 'sk-gemini-...',
  baseURL: 'https://generativelanguage.googleapis.com/v1beta', // optional
  model: 'gemini-1.5-flash-latest' // optional
}
```

### Cache Configuration

```javascript
{
  maxSize: 100,        // Maximum cache entries
  ttlMs: 300000        // 5 minutes TTL
}
```

## Error Handling

### Common Error Codes

- `400 Bad Request`: Invalid parameters
- `401 Unauthorized`: Missing/invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Credential not found
- `409 Conflict`: Duplicate credential
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Provider errors

### Error Response Format

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    "provider": "openai",
    "requestId": "req-123"
  }
}
```

## Monitoring and Telemetry

### Metrics Collected

- Request latency (p50, p95, p99)
- Token usage per provider
- Cache hit/miss rates
- Error rates by type
- User feedback scores

### Logging

All AI operations are logged with:

- User ID (anonymized)
- Provider and model
- Request/response sizes
- Duration and success status
- Error details (sanitized)

## Testing

### Unit Tests

```bash
# Run AI assistant tests
npm test -- --grep "AI Assistant"

# Run credential tests
npm test -- --grep "AI Credentials"

# Run provider tests
npm test -- --grep "OpenAI Provider"
```

### Integration Tests

```bash
# Run AI integration tests
npm run test:ai-integration
```

### Test Coverage

- Provider implementations (mocked API responses)
- Credential lifecycle management
- Rate limiting and caching
- Error handling paths
- WebSocket message handling

## Development Guidelines

### Adding New Providers

1. Extend `BaseAIProvider` class
2. Implement `streamCompletion()` and `completion()` methods
3. Add provider to `AIProviderFactory`
4. Update credential validation schema
5. Add tests for the new provider

### Caching Strategy

- Cache based on prompt hash + parameters
- Include provider and model in cache key
- Respect TTL and size limits
- Handle cache invalidation on provider errors

### Rate Limiting

- Implement in-memory rate limiting per user
- Consider Redis for distributed deployments
- Provide clear error messages when limits exceeded
- Allow different limits per provider/tier

## Troubleshooting

### Common Issues

1. **API Key Errors**
   - Verify encryption key is set
   - Check credential format
   - Test credential via test endpoint

2. **Rate Limiting**
   - Monitor usage statistics
   - Implement exponential backoff
   - Consider caching more aggressively

3. **High Latency**
   - Check cache hit rates
   - Monitor provider response times
   - Consider model selection

4. **Poor Quality Responses**
   - Review prompt construction
   - Adjust temperature settings
   - Collect and analyze feedback

### Debug Tools

- Cache statistics endpoint
- Provider capabilities endpoint
- Credential usage statistics
- Request/response logging

## Future Enhancements

### Planned Features

- [ ] Support for Azure OpenAI
- [ ] Custom model fine-tuning
- [ ] Advanced prompt templates
- [ ] Multi-provider fallback
- [ ] Distributed caching with Redis
- [ ] Usage analytics dashboard
- [ ] Custom rate limiting rules
- [ ] Prompt optimization suggestions

### Performance Improvements

- [ ] Streaming response compression
- [ ] Connection pooling for providers
- [ ] Smart cache warming
- [ ] Predictive pre-fetching

## Security Best Practices

1. **Never log API keys** - Use credential IDs in logs
2. **Validate all inputs** - Sanitize prompts and parameters
3. **Monitor for abuse** - Track usage patterns and anomalies
4. **Regular key rotation** - Encourage users to update keys
5. **Secure key storage** - Use proper key management in production
6. **Rate limiting** - Prevent DoS and cost overruns
7. **Audit trails** - Log all credential operations

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review logs for error details
3. Test credentials via the test endpoint
4. Monitor provider status pages
5. Contact support with request IDs from logs
