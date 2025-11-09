const { google } = require('googleapis');
const BaseStorageProvider = require('./base-provider');
const FileFormatMapper = require('./file-format-mapper');
const logger = require('../../utils/logger');

class GoogleDriveProvider extends BaseStorageProvider {
  constructor(options = {}) {
    super(options);
    this.accessToken = options.accessToken;
    this.refreshToken = options.refreshToken;
    this.clientId = options.clientId || process.env.GOOGLE_CLIENT_ID;
    this.clientSecret = options.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    this.redirectUrl = options.redirectUrl || process.env.GOOGLE_REDIRECT_URL;

    this.drive = null;
    this.isInitialized = false;

    if (this.accessToken) {
      this.initializeClient();
    }
  }

  initializeClient() {
    try {
      const auth = new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUrl);

      if (this.accessToken) {
        auth.setCredentials({
          access_token: this.accessToken,
          refresh_token: this.refreshToken,
        });
      }

      this.drive = google.drive({
        version: 'v3',
        auth,
      });

      this.auth = auth;
      this.isInitialized = true;
    } catch (error) {
      logger.error('Error initializing Google Drive client', { error: error.message });
      throw error;
    }
  }

  async refreshAuth() {
    try {
      if (!this.auth || !this.refreshToken) {
        throw new Error('Cannot refresh: missing auth or refresh token');
      }

      const { credentials } = await this.auth.refreshAccessToken();
      this.accessToken = credentials.access_token;
      this.auth.setCredentials(credentials);

      return {
        accessToken: this.accessToken,
        expiryDate: credentials.expiry_date,
      };
    } catch (error) {
      logger.error('Error refreshing Google Drive auth', { error: error.message });
      throw error;
    }
  }

  async isAuthenticated() {
    try {
      if (!this.drive) {
        return false;
      }

      const response = await this.drive.about.get({
        fields: 'user',
      });

      return !!response.data.user;
    } catch (error) {
      logger.error('Error checking Google Drive authentication', { error: error.message });
      return false;
    }
  }

  async list(path = 'root', options = {}) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive client not initialized');
      }

      const folderId = path === '/' || path === 'root' ? 'root' : path;

      const query = `'${folderId}' in parents and trashed = false`;
      const response = await this.drive.files.list({
        q: query,
        spaces: 'drive',
        fields: 'files(id, name, mimeType, size, modifiedTime, createdTime, parents)',
        pageSize: options.pageSize || 100,
      });

      return (response.data.files || []).map((file) => ({
        id: file.id,
        name: file.name,
        path: `${path}/${file.id}`,
        type: file.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
        size: parseInt(file.size) || 0,
        mimeType: this.googleMimeToStandard(file.mimeType),
        modifiedAt: new Date(file.modifiedTime),
        createdAt: new Date(file.createdTime),
        isDirectory: file.mimeType === 'application/vnd.google-apps.folder',
      }));
    } catch (error) {
      logger.error('Error listing Google Drive files', { path, error: error.message });
      throw error;
    }
  }

  async read(filePath, options = {}) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive client not initialized');
      }

      const fileId = this.extractFileId(filePath);

      const response = await this.drive.files.get(
        {
          fileId,
          alt: 'media',
        },
        { responseType: 'stream' }
      );

      if (options.stream) {
        return response.data;
      }

      // Convert stream to buffer
      return new Promise((resolve, reject) => {
        const chunks = [];
        response.data.on('data', (chunk) => chunks.push(chunk));
        response.data.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const encoding = options.encoding || FileFormatMapper.getEncoding(filePath);

          if (encoding && encoding !== 'binary') {
            let content = buffer.toString(encoding);
            if (options.normalizeNewlines !== false) {
              content = FileFormatMapper.normalizeLineEndings(content);
            }
            resolve(content);
          } else {
            resolve(buffer);
          }
        });
        response.data.on('error', reject);
      });
    } catch (error) {
      logger.error('Error reading file from Google Drive', { filePath, error: error.message });
      throw error;
    }
  }

  async write(filePath, content, options = {}) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive client not initialized');
      }

      const fileName = filePath.split('/').pop();
      const parentId = options.parentId || 'root';

      let media;
      if (Buffer.isBuffer(content)) {
        media = {
          mimeType: FileFormatMapper.getMimeType(filePath),
          body: content,
        };
      } else {
        const normalized = FileFormatMapper.normalizeLineEndings(content);
        media = {
          mimeType: FileFormatMapper.getMimeType(filePath),
          body: normalized,
        };
      }

      const fileMetadata = {
        name: fileName,
        parents: [parentId],
      };

      // Check if file exists (for update)
      let existingFile = null;
      if (options.update) {
        try {
          const query = `name = '${fileName}' and '${parentId}' in parents and trashed = false`;
          const response = await this.drive.files.list({
            q: query,
            spaces: 'drive',
            fields: 'files(id)',
          });

          if (response.data.files && response.data.files.length > 0) {
            existingFile = response.data.files[0];
          }
        } catch (err) {
          // Ignore - file doesn't exist
        }
      }

      let response;
      if (existingFile) {
        response = await this.drive.files.update({
          fileId: existingFile.id,
          media,
        });
      } else {
        response = await this.drive.files.create({
          resource: fileMetadata,
          media,
          fields: 'id, name, size, mimeType, modifiedTime',
        });
      }

      return {
        id: response.data.id,
        path: `/${response.data.id}`,
        name: response.data.name,
        size: parseInt(response.data.size) || 0,
        mimeType: this.googleMimeToStandard(response.data.mimeType),
        modifiedAt: new Date(response.data.modifiedTime),
        version: options.version || 1,
      };
    } catch (error) {
      logger.error('Error writing file to Google Drive', { filePath, error: error.message });
      throw error;
    }
  }

  async rename(oldPath, newPath) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive client not initialized');
      }

      const fileId = this.extractFileId(oldPath);
      const newName = newPath.split('/').pop();

      const response = await this.drive.files.update({
        fileId,
        resource: {
          name: newName,
        },
        fields: 'id, name, mimeType, modifiedTime',
      });

      return {
        oldPath,
        newPath,
        id: response.data.id,
        name: response.data.name,
        mimeType: this.googleMimeToStandard(response.data.mimeType),
        modifiedAt: new Date(response.data.modifiedTime),
      };
    } catch (error) {
      logger.error('Error renaming file in Google Drive', {
        oldPath,
        newPath,
        error: error.message,
      });
      throw error;
    }
  }

  async delete(filePath, _options = {}) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive client not initialized');
      }

      const fileId = this.extractFileId(filePath);

      await this.drive.files.delete({
        fileId,
      });

      return true;
    } catch (error) {
      logger.error('Error deleting file from Google Drive', { filePath, error: error.message });
      throw error;
    }
  }

  async search(query, options = {}) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive client not initialized');
      }

      const q = `name contains '${query}' and trashed = false`;

      const response = await this.drive.files.list({
        q,
        spaces: 'drive',
        fields: 'files(id, name, mimeType, size, modifiedTime)',
        pageSize: options.maxResults || 100,
      });

      return (response.data.files || []).map((file) => ({
        id: file.id,
        name: file.name,
        path: `/${file.id}`,
        type: file.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
        size: parseInt(file.size) || 0,
        mimeType: this.googleMimeToStandard(file.mimeType),
        modifiedAt: new Date(file.modifiedTime),
      }));
    } catch (error) {
      logger.error('Error searching Google Drive', { query, error: error.message });
      throw error;
    }
  }

  async metadata(filePath) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive client not initialized');
      }

      const fileId = this.extractFileId(filePath);

      const response = await this.drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, modifiedTime, createdTime, trashed',
      });

      const file = response.data;

      return {
        id: file.id,
        path: filePath,
        name: file.name,
        type: file.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
        size: parseInt(file.size) || 0,
        mimeType: this.googleMimeToStandard(file.mimeType),
        encoding:
          file.mimeType === 'application/vnd.google-apps.folder'
            ? null
            : FileFormatMapper.getEncoding(file.name),
        createdAt: new Date(file.createdTime),
        modifiedAt: new Date(file.modifiedTime),
        isDirectory: file.mimeType === 'application/vnd.google-apps.folder',
        isBinary:
          file.mimeType === 'application/vnd.google-apps.folder'
            ? false
            : FileFormatMapper.isBinary(file.name),
      };
    } catch (error) {
      logger.error('Error getting metadata from Google Drive', { filePath, error: error.message });
      throw error;
    }
  }

  async createReadStream(filePath) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive client not initialized');
      }

      const fileId = this.extractFileId(filePath);

      const response = await this.drive.files.get(
        {
          fileId,
          alt: 'media',
        },
        { responseType: 'stream' }
      );

      return response.data;
    } catch (error) {
      logger.error('Error creating read stream from Google Drive', {
        filePath,
        error: error.message,
      });
      throw error;
    }
  }

  googleMimeToStandard(googleMime) {
    if (!googleMime) return 'application/octet-stream';

    const mimeMap = {
      'application/vnd.google-apps.document': 'text/plain',
      'application/vnd.google-apps.spreadsheet': 'text/csv',
      'application/vnd.google-apps.presentation': 'text/plain',
      'application/vnd.google-apps.folder': 'application/x-folder',
    };

    return mimeMap[googleMime] || googleMime;
  }

  extractFileId(filePath) {
    // Handle path like "/fileId" or just "fileId"
    return filePath.replace(/^\//, '');
  }

  async getStorageInfo() {
    try {
      if (!this.drive) {
        return {
          provider: 'google-drive',
          authenticated: false,
        };
      }

      const response = await this.drive.about.get({
        fields: 'user, storageQuota',
      });

      return {
        provider: 'google-drive',
        authenticated: true,
        user: response.data.user,
        storageQuota: response.data.storageQuota,
      };
    } catch (error) {
      logger.error('Error getting Google Drive storage info', { error: error.message });
      return {
        provider: 'google-drive',
        authenticated: false,
        error: error.message,
      };
    }
  }
}

module.exports = GoogleDriveProvider;
