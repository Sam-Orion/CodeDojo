# Storage Provider OAuth Integration

This document describes the implementation of OAuth-based storage provider connections for Google Drive and OneDrive.

## Overview

The storage provider OAuth system allows users to connect their Google Drive and OneDrive accounts to the application, enabling secure file access and management through OAuth 2.0 authentication flows.

## Architecture

### Redux State Management

The `storageProviderSlice` manages all storage provider related state:

```typescript
interface StorageProviderState {
  providers: StorageProvider[];
  currentProviderId: string | null;
  isLoading: boolean;
  error: string | null;
  isConnecting: boolean;
  connectionError: string | null;
}
```

### Components

#### 1. StorageProvidersPage

- Main page for managing storage provider connections
- Displays connected and available providers
- Allows users to connect/disconnect providers
- Shows provider details (email, last accessed, token expiry)

#### 2. ProviderConnectionModal

- Modal dialog for initiating provider connections
- Provider selection with radio buttons
- Status indicators for connected/disconnected providers
- Handles OAuth flow initiation for Google Drive and OneDrive
- Manages local storage provider connections

#### 3. OAuthCallback

- Handles OAuth callback from OAuth providers
- Processes authorization code
- Exchanges code for access token via backend
- Displays success/error states during connection process
- Auto-redirects to storage providers page after completion

### API Endpoints

The implementation expects the following backend API endpoints:

```
GET    /api/v1/storage/providers
       - Fetch list of all storage providers

POST   /api/v1/storage/providers/connect
       - Connect a storage provider
       - Payload: { type: string, code: string }
       - Returns: { provider: StorageProvider }

POST   /api/v1/storage/providers/{providerId}/disconnect
       - Disconnect a storage provider
       - Returns: { success: boolean }

POST   /api/v1/storage/providers/{providerId}/refresh-token
       - Refresh OAuth token for a provider
       - Returns: { provider: StorageProvider }

POST   /api/v1/storage/providers/{providerId}/set-current
       - Set the currently active storage provider
       - Returns: { success: boolean }
```

## OAuth Flow

### Google Drive

1. User clicks "Connect Account" for Google Drive
2. Application redirects to Google OAuth consent screen
3. User grants permissions
4. Google redirects to `/oauth/callback` with authorization code
5. Frontend exchanges code for token via backend
6. Token is stored in backend database
7. Redux state is updated with connected provider

**OAuth Configuration:**

- Authorization URL: `https://accounts.google.com/o/oauth2/v2/auth`
- Scope: `https://www.googleapis.com/auth/drive`
- Client ID: Set via `VITE_GOOGLE_CLIENT_ID` environment variable

### OneDrive

1. User clicks "Connect Account" for OneDrive
2. Application redirects to Microsoft OAuth consent screen
3. User grants permissions
4. Microsoft redirects to `/oauth/callback` with authorization code
5. Frontend exchanges code for token via backend
6. Token is stored in backend database
7. Redux state is updated with connected provider

**OAuth Configuration:**

- Authorization URL: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
- Scopes: `Files.Read.All offline_access`
- Client ID: Set via `VITE_MICROSOFT_CLIENT_ID` environment variable

### Local Storage

Local storage doesn't require OAuth. Users can connect directly:

1. User selects "Local Storage" provider
2. Clicks "Connect Account"
3. Backend registers local storage as connected provider
4. Redux state is updated

## Usage

### Accessing Storage Providers

Navigate to `/storage-providers` in the application to manage storage provider connections.

### Connecting a Provider

1. Click "+ Connect Provider" button
2. Select desired provider (Google Drive, OneDrive, or Local)
3. Click "Connect Account"
4. Complete OAuth flow (if applicable)
5. Provider appears in connected providers list

### Disconnecting a Provider

1. Find connected provider in the list
2. Click "Disconnect" button
3. Confirm disconnection in modal
4. Provider is removed from connected providers

### Setting Active Provider

1. Find connected provider in the list
2. Click "Set as Active" button
3. Provider becomes the current/active provider

## Environment Setup

Add the following environment variables to your `.env` file:

```
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
VITE_MICROSOFT_CLIENT_ID=your_microsoft_client_id_here
```

### Getting OAuth Credentials

#### Google Drive

1. Go to Google Cloud Console: https://console.cloud.google.com
2. Create new project
3. Enable Google Drive API
4. Create OAuth 2.0 credentials (OAuth consent screen)
5. Add authorized redirect URIs: `http://localhost:5173/oauth/callback` (dev) and production URL
6. Copy Client ID to `.env` as `VITE_GOOGLE_CLIENT_ID`

#### OneDrive

1. Go to Azure Portal: https://portal.azure.com
2. Go to App registrations
3. Create new application
4. Add redirect URI: `http://localhost:5173/oauth/callback` (dev) and production URL
5. Create client secret
6. Copy Application (client) ID to `.env` as `VITE_MICROSOFT_CLIENT_ID`

## Data Flow

```
User Action
    ↓
ProviderConnectionModal
    ↓
OAuth Provider (Google/Microsoft)
    ↓
OAuth Callback Handler (/oauth/callback)
    ↓
Backend: Exchange code for token
    ↓
Backend: Store token in database
    ↓
Redux: connectProvider thunk
    ↓
StorageProviderSlice state update
    ↓
UI: Display connected provider
```

## Error Handling

### Connection Errors

- Invalid authorization code
- OAuth provider rejection
- Backend token exchange failure
- Network errors

All errors are captured in `connectionError` state and displayed to the user in the ProviderConnectionModal.

### Token Refresh

Tokens may expire. The `refreshToken` async thunk handles:

1. Detecting expired tokens
2. Requesting new tokens from OAuth provider via backend
3. Storing new tokens
4. Updating Redux state

## Testing

### Unit Tests

`storageProviderSlice.test.ts` - Redux slice testing:

- State initialization
- Action reducers
- Async thunk behaviors
- Error handling
- State transitions

### Integration Tests

`ProviderConnectionModal.test.tsx` - Component testing:

- Modal rendering
- Provider selection
- Connect/disconnect flows
- Error display

`OAuthCallback.test.tsx` - OAuth flow testing:

- Authorization code handling
- Error state display
- Redirect behavior

## Security Considerations

1. **Token Storage**: Tokens are stored in backend database, not in client localStorage
2. **HTTPS**: OAuth flow should only work over HTTPS in production
3. **Redirect URI Validation**: Backend must validate redirect URIs match registered URLs
4. **PKCE**: Consider implementing PKCE for additional security
5. **Token Refresh**: Tokens should be refreshed before expiry

## Future Enhancements

1. Batch operations for multiple files
2. File sync and upload functionality
3. Provider-specific file picker
4. Automatic token refresh on expiry
5. Provider switching with file context preservation
6. Advanced provider settings and permissions
7. Multi-account support per provider

## Troubleshooting

### "Missing client ID" Error

- Ensure environment variables are set in `.env`
- Restart development server after adding environment variables
- Verify variable names: `VITE_GOOGLE_CLIENT_ID`, `VITE_MICROSOFT_CLIENT_ID`

### "Redirect URI mismatch" Error

- Verify redirect URI in OAuth provider settings matches `{origin}/oauth/callback`
- Check production URL is registered if deploying

### "Authorization Code Expired" Error

- OAuth codes expire after ~10 minutes
- User must restart the connection process

### Token Refresh Failures

- Check backend has refresh token stored
- Verify OAuth provider hasn't revoked permissions
- Check token expiry time in provider state

## References

- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Microsoft OAuth Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-overview)
- [OAuth 2.0 Specification](https://tools.ietf.org/html/rfc6749)
