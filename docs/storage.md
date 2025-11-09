# Storage Abstraction - Multi-Cloud Filesystem Documentation

## Overview

The storage abstraction layer provides a unified interface for interacting with multiple cloud storage providers and local filesystem. Currently supported providers:

- **Local Storage**: Filesystem-backed storage with sandbox directory restrictions
- **Google Drive**: OAuth2-based integration with Google Drive API
- **OneDrive**: OAuth2-based integration with Microsoft Graph API

## Features

### Multi-Cloud Provider Support

Users can connect multiple storage providers and switch between them seamlessly. Each provider supports:

- **File Operations**: List, read, write, rename, delete
- **Search**: Full-text search across files
- **Metadata**: Get file/folder metadata (size, MIME type, timestamps)
- **Stream APIs**: Efficient read/write streams for large files

### File Format Support

The following 15+ file formats are supported with proper MIME detection and encoding:

| Format      | Extension(s)          | MIME Type          | Encoding |
| ----------- | --------------------- | ------------------ | -------- |
| JavaScript  | .js, .mjs, .cjs       | text/javascript    | utf8     |
| TypeScript  | .ts, .tsx             | text/typescript    | utf8     |
| Python      | .py                   | text/x-python      | utf8     |
| Java        | .java                 | text/x-java-source | utf8     |
| C           | .c                    | text/x-c           | utf8     |
| C++         | .cpp, .cc, .cxx, .c++ | text/x-c++src      | utf8     |
| Go          | .go                   | text/x-go          | utf8     |
| Rust        | .rs                   | text/x-rustsrc     | utf8     |
| HTML        | .html, .htm           | text/html          | utf8     |
| CSS         | .css                  | text/css           | utf8     |
| JSON        | .json                 | application/json   | utf8     |
| YAML        | .yaml, .yml           | text/yaml          | utf8     |
| Markdown    | .md, .markdown        | text/markdown      | utf8     |
| XML         | .xml                  | application/xml    | utf8     |
| SQL         | .sql                  | text/x-sql         | utf8     |
| Plain Text  | .txt                  | text/plain         | utf8     |
| Shell       | .sh, .bash            | text/x-shellscript | utf8     |
| Environment | .env\*                | text/plain         | utf8     |

### Security & Encryption

- **Credential Encryption**: All OAuth tokens and refresh tokens are encrypted at rest using AES-256-GCM
- **Sandbox Directory**: Local storage is restricted to a configurable base directory
- **Audit Logging**: All file operations are logged with timestamp, user, action, and status
- **Never Logged**: Access tokens and refresh tokens are never logged in plain text

### Conflict Resolution

Files use a **last-write-wins** strategy with version metadata:

- Each file operation includes version information
- Concurrent writes are resolved by accepting the most recent operation
- Version metadata is preserved for audit trails

## API Endpoints

### Provider Management

#### List Available Providers

```
GET /api/v1/storage/providers
```

Response:

```json
{
  "providers": ["local", "google-drive", "onedrive"],
  "count": 3
}
```

#### Get User's Connected Providers

```
GET /api/v1/storage/user-providers
Query Parameters:
  - userId (required or from auth context)
```

Response:

```json
{
  "providers": [
    {
      "id": "credential_id",
      "provider": "google-drive",
      "displayName": "My Google Drive",
      "email": "user@gmail.com",
      "isDefault": true,
      "isActive": true,
      "metadata": {
        "storageQuota": 15000000000,
        "storageUsed": 5000000000
      },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### Link Storage Provider

```
POST /api/v1/storage/link
```

Request Body:

```json
{
  "provider": "google-drive",
  "displayName": "My Google Drive",
  "email": "user@gmail.com",
  "accessToken": "ya29.a0Af...",
  "refreshToken": "1//0g...",
  "metadata": {
    "storageQuota": 15000000000
  }
}
```

Response (201 Created):

```json
{
  "id": "credential_id",
  "provider": "google-drive",
  "displayName": "My Google Drive",
  "email": "user@gmail.com",
  "isDefault": false,
  "isActive": true,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

#### Set Default Provider

```
POST /api/v1/storage/default
```

Request Body:

```json
{
  "credentialId": "credential_id"
}
```

Response:

```json
{
  "success": true,
  "message": "Default provider set successfully"
}
```

#### Get Default Provider

```
GET /api/v1/storage/default
Query Parameters:
  - userId (required or from auth context)
```

Response:

```json
{
  "provider": "google-drive",
  "displayName": "My Google Drive",
  "isDefault": true
}
```

#### Unlink Provider

```
DELETE /api/v1/storage/unlink/:credentialId
```

Response:

```json
{
  "success": true,
  "message": "Provider unlinked successfully"
}
```

### File Operations

#### List Files

```
GET /api/v1/storage/list
Query Parameters:
  - provider (required): "local", "google-drive", or "onedrive"
  - path (optional, default "/"): Directory path
  - userId (required or from auth context)
```

Response:

```json
{
  "files": [
    {
      "id": "file_id",
      "name": "index.js",
      "path": "/index.js",
      "type": "file",
      "size": 1024,
      "mimeType": "text/javascript",
      "modifiedAt": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-15T10:00:00Z",
      "isDirectory": false
    }
  ],
  "count": 1,
  "path": "/",
  "provider": "local"
}
```

#### Read File

```
GET /api/v1/storage/read
Query Parameters:
  - provider (required)
  - path (required): File path
  - userId (required or from auth context)
```

Response:

```
Content-Type: text/plain; charset=utf-8
[File content as text or binary]
```

#### Write File

```
POST /api/v1/storage/write
```

Request Body:

```json
{
  "provider": "local",
  "path": "/new-file.js",
  "content": "console.log('hello');"
}
```

Response (201 Created):

```json
{
  "path": "/new-file.js",
  "name": "new-file.js",
  "size": 25,
  "mimeType": "text/javascript",
  "modifiedAt": "2024-01-15T10:30:00Z",
  "version": 1
}
```

#### Rename File

```
POST /api/v1/storage/rename
```

Request Body:

```json
{
  "provider": "local",
  "oldPath": "/old-name.js",
  "newPath": "/new-name.js"
}
```

Response:

```json
{
  "oldPath": "/old-name.js",
  "newPath": "/new-name.js",
  "name": "new-name.js",
  "mimeType": "text/javascript"
}
```

#### Delete File

```
POST /api/v1/storage/delete
```

Request Body:

```json
{
  "provider": "local",
  "path": "/file-to-delete.js"
}
```

Response:

```json
{
  "success": true
}
```

#### Search Files

```
GET /api/v1/storage/search
Query Parameters:
  - provider (required)
  - query (required): Search term
  - maxResults (optional, default 100)
  - userId (required or from auth context)
```

Response:

```json
{
  "results": [
    {
      "id": "file_id",
      "name": "test.js",
      "path": "/test.js",
      "type": "file",
      "size": 512,
      "mimeType": "text/javascript",
      "modifiedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 1,
  "query": "test",
  "provider": "local"
}
```

#### Get File Metadata

```
GET /api/v1/storage/metadata
Query Parameters:
  - provider (required)
  - path (required): File path
  - userId (required or from auth context)
```

Response:

```json
{
  "path": "/index.js",
  "name": "index.js",
  "type": "file",
  "size": 1024,
  "mimeType": "text/javascript",
  "encoding": "utf8",
  "createdAt": "2024-01-15T10:00:00Z",
  "modifiedAt": "2024-01-15T10:30:00Z",
  "isDirectory": false,
  "isBinary": false
}
```

### Audit Logs

#### Get File Action Audit Logs

```
GET /api/v1/storage/audit-logs
Query Parameters:
  - userId (required or from auth context)
  - provider (optional): Filter by provider
  - action (optional): Filter by action (read, write, rename, delete, search, list, metadata)
  - startDate (optional): ISO date string
  - endDate (optional): ISO date string
  - limit (optional, default 100)
  - offset (optional, default 0)
```

Response:

```json
{
  "logs": [
    {
      "id": "log_id",
      "userId": "user_123",
      "provider": "local",
      "action": "write",
      "filePath": "/index.js",
      "fileName": "index.js",
      "fileSize": 1024,
      "mimeType": "text/javascript",
      "status": "success",
      "errorMessage": null,
      "metadata": {
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "correlationId": "abc-123"
      },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 150,
  "limit": 100,
  "offset": 0
}
```

## OAuth Setup

### Google Drive Integration

#### Prerequisites

1. Create a Google Cloud project
2. Enable Google Drive API
3. Create OAuth 2.0 credentials (Desktop application)

#### Steps

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable the Google Drive API:
   - Search for "Google Drive API"
   - Click "Enable"
4. Create OAuth 2.0 credentials:
   - Go to "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Desktop application"
   - Add authorized redirect URI: `http://localhost:3000/api/v1/storage/oauth/google/callback`
5. Copy Client ID and Client Secret
6. Set environment variables:

```bash
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URL=http://localhost:3000/api/v1/storage/oauth/google/callback
```

#### Required Scopes

- `https://www.googleapis.com/auth/drive` - Full access to Google Drive
- `https://www.googleapis.com/auth/drive.file` - Access to files created or opened by the app

### Microsoft OneDrive Integration

#### Prerequisites

1. Register an Azure application
2. Configure application permissions
3. Create a client secret

#### Steps

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to "Azure Active Directory" > "App registrations"
3. Click "New registration"
4. Fill in the details:
   - Name: CodeDojo Storage
   - Supported account types: Accounts in this organizational directory only
   - Redirect URI: Web - `http://localhost:3000/api/v1/storage/oauth/microsoft/callback`
5. Click "Register"
6. Copy Application (client) ID
7. Create a client secret:
   - Go to "Certificates & secrets"
   - Click "New client secret"
   - Copy the secret value
8. Configure API permissions:
   - Click "API permissions"
   - Add permissions: `Files.ReadWrite.All`, `offline_access`
9. Set environment variables:

```bash
MICROSOFT_CLIENT_ID=your_client_id
MICROSOFT_CLIENT_SECRET=your_client_secret
MICROSOFT_REDIRECT_URL=http://localhost:3000/api/v1/storage/oauth/microsoft/callback
```

## Environment Variables

```bash
# Storage Configuration
STORAGE_BASE_PATH=./storage                    # Base directory for local storage
STORAGE_ENCRYPTION_KEY=<32_byte_hex_key>      # AES-256 key for encrypting credentials

# Google Drive OAuth
GOOGLE_CLIENT_ID=<client_id>
GOOGLE_CLIENT_SECRET=<client_secret>
GOOGLE_REDIRECT_URL=http://localhost:3000/api/v1/storage/oauth/google/callback

# Microsoft OneDrive OAuth
MICROSOFT_CLIENT_ID=<client_id>
MICROSOFT_CLIENT_SECRET=<client_secret>
MICROSOFT_REDIRECT_URL=http://localhost:3000/api/v1/storage/oauth/microsoft/callback
```

## Error Handling

All storage endpoints return proper HTTP status codes:

- **200 OK** - Successful read or list operation
- **201 Created** - File successfully created
- **400 Bad Request** - Invalid parameters or missing required fields
- **401 Unauthorized** - Authentication required
- **403 Forbidden** - Access denied or credentials expired
- **404 Not Found** - File or provider not found
- **409 Conflict** - File already exists or conflict
- **500 Internal Server Error** - Server error with descriptive message

Error Response Format:

```json
{
  "error": "Descriptive error message",
  "code": "ERROR_CODE",
  "provider": "local",
  "action": "write"
}
```

## Best Practices

1. **Always validate file paths** before operations
2. **Use appropriate MIME types** when writing files
3. **Normalize line endings** for text files (already handled by the service)
4. **Implement retry logic** for cloud provider operations
5. **Cache file metadata** to reduce API calls
6. **Monitor audit logs** for security and compliance
7. **Regularly refresh credentials** for cloud providers
8. **Implement proper error handling** for network failures
9. **Use encryption keys** from secure key management systems in production
10. **Test with multiple providers** to ensure compatibility

## Implementation Examples

### Reading a File

```javascript
const response = await fetch('/api/v1/storage/read', {
  method: 'GET',
  headers: {
    Authorization: 'Bearer token',
  },
  body: JSON.stringify({
    provider: 'google-drive',
    path: '/project/index.js',
  }),
});

const content = await response.text();
```

### Writing a File with Last-Write-Wins

```javascript
const response = await fetch('/api/v1/storage/write', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer token',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    provider: 'local',
    path: '/project/index.js',
    content: 'console.log("hello");',
    version: 2, // Version metadata for conflict resolution
  }),
});

const result = await response.json();
console.log(`File saved at: ${result.modifiedAt}`);
```

### Listing Files

```javascript
const response = await fetch('/api/v1/storage/list?provider=local&path=/', {
  headers: { Authorization: 'Bearer token' },
});

const { files } = await response.json();
files.forEach((file) => {
  console.log(`${file.name} (${file.size} bytes)`);
});
```

## Testing

Run storage tests:

```bash
npm run test -- tests/storage.test.js
```

Tests cover:

- Format detection and MIME types
- Provider registry and initialization
- Local filesystem operations (CRUD)
- File search and metadata retrieval
- Path validation and sandbox restrictions
- Line ending normalization
- Stream creation

## Troubleshooting

### Google Drive Authentication Issues

- Verify Client ID and Client Secret are correct
- Ensure redirect URI matches exactly in Google Cloud Console
- Check that Google Drive API is enabled

### OneDrive Token Expiration

- Implement automatic token refresh
- Check `accessTokenExpiry` timestamp
- Request new refresh token if needed

### Local Storage Path Issues

- Verify `STORAGE_BASE_PATH` directory exists and is writable
- Check file permissions on sandbox directory
- Ensure no path traversal attempts are made

### File Encoding Issues

- Use `normalizeNewlines` option for text files
- Verify MIME type is correctly detected
- Check system locale and file encoding

## Future Enhancements

- AWS S3 integration
- Azure Blob Storage support
- Dropbox integration
- Box integration
- File versioning and rollback
- Collaborative file locking
- Real-time file synchronization
- Full-text search indexing
- File preview generation
