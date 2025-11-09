const axios = require('axios');
const BaseStorageProvider = require('./base-provider');
const FileFormatMapper = require('./file-format-mapper');
const logger = require('../../utils/logger');

class OneDriveProvider extends BaseStorageProvider {
  constructor(options = {}) {
    super(options);
    this.accessToken = options.accessToken;
    this.refreshToken = options.refreshToken;
    this.clientId = options.clientId || process.env.MICROSOFT_CLIENT_ID;
    this.clientSecret = options.clientSecret || process.env.MICROSOFT_CLIENT_SECRET;
    this.redirectUrl = options.redirectUrl || process.env.MICROSOFT_REDIRECT_URL;
    this.tenantId = options.tenantId || 'common';

    this.baseURL = 'https://graph.microsoft.com/v1.0';
    this.isInitialized = !!this.accessToken;
  }

  async refreshAuth() {
    try {
      if (!this.refreshToken) {
        throw new Error('Cannot refresh: missing refresh token');
      }

      const response = await axios.post(
        `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
          scope: 'files.readwrite.all offline_access',
        }
      );

      this.accessToken = response.data.access_token;
      return {
        accessToken: this.accessToken,
        expiryDate: new Date(Date.now() + response.data.expires_in * 1000),
      };
    } catch (error) {
      logger.error('Error refreshing OneDrive auth', { error: error.message });
      throw error;
    }
  }

  async isAuthenticated() {
    try {
      if (!this.accessToken) {
        return false;
      }

      const response = await axios.get(`${this.baseURL}/me`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return !!response.data.id;
    } catch (error) {
      logger.error('Error checking OneDrive authentication', { error: error.message });
      return false;
    }
  }

  async list(path = 'root', options = {}) {
    try {
      if (!this.accessToken) {
        throw new Error('OneDrive client not authenticated');
      }

      let url;
      if (path === '/' || path === 'root') {
        url = `${this.baseURL}/me/drive/root/children`;
      } else {
        url = `${this.baseURL}/me/drive/items/${path}/children`;
      }

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        params: {
          $top: options.pageSize || 100,
        },
      });

      return (response.data.value || []).map((item) => ({
        id: item.id,
        name: item.name,
        path: item.id,
        type: item.folder ? 'folder' : 'file',
        size: item.size || 0,
        mimeType: item.file ? item.file.mimeType : 'application/x-folder',
        modifiedAt: new Date(item.lastModifiedDateTime),
        createdAt: new Date(item.createdDateTime),
        isDirectory: !!item.folder,
      }));
    } catch (error) {
      logger.error('Error listing OneDrive files', { path, error: error.message });
      throw error;
    }
  }

  async read(filePath, options = {}) {
    try {
      if (!this.accessToken) {
        throw new Error('OneDrive client not authenticated');
      }

      const url = `${this.baseURL}/me/drive/items/${filePath}/content`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        responseType: options.stream ? 'stream' : 'arraybuffer',
      });

      if (options.stream) {
        return response.data;
      }

      const buffer = Buffer.from(response.data);
      const encoding = options.encoding || FileFormatMapper.getEncoding(filePath);

      if (encoding && encoding !== 'binary') {
        let content = buffer.toString(encoding);
        if (options.normalizeNewlines !== false) {
          content = FileFormatMapper.normalizeLineEndings(content);
        }
        return content;
      }

      return buffer;
    } catch (error) {
      logger.error('Error reading file from OneDrive', { filePath, error: error.message });
      throw error;
    }
  }

  async write(filePath, content, options = {}) {
    try {
      if (!this.accessToken) {
        throw new Error('OneDrive client not authenticated');
      }

      const fileName = filePath.split('/').pop();
      const parentId = options.parentId || 'root';

      let data = content;
      if (typeof content === 'string') {
        data = FileFormatMapper.normalizeLineEndings(content);
      }

      // Upload file
      let url = `${this.baseURL}/me/drive/items/${parentId}:/${fileName}:/content`;
      const response = await axios.put(url, data, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': FileFormatMapper.getMimeType(filePath),
        },
      });

      return {
        id: response.data.id,
        path: response.data.id,
        name: response.data.name,
        size: response.data.size || 0,
        mimeType: response.data.file
          ? response.data.file.mimeType
          : FileFormatMapper.getMimeType(filePath),
        modifiedAt: new Date(response.data.lastModifiedDateTime),
        version: options.version || 1,
      };
    } catch (error) {
      logger.error('Error writing file to OneDrive', { filePath, error: error.message });
      throw error;
    }
  }

  async rename(oldPath, newPath) {
    try {
      if (!this.accessToken) {
        throw new Error('OneDrive client not authenticated');
      }

      const newName = newPath.split('/').pop();

      const url = `${this.baseURL}/me/drive/items/${oldPath}`;
      const response = await axios.patch(
        url,
        {
          name: newName,
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      return {
        oldPath,
        newPath: response.data.id,
        id: response.data.id,
        name: response.data.name,
        mimeType: response.data.file
          ? response.data.file.mimeType
          : FileFormatMapper.getMimeType(newName),
        modifiedAt: new Date(response.data.lastModifiedDateTime),
      };
    } catch (error) {
      logger.error('Error renaming file in OneDrive', { oldPath, newPath, error: error.message });
      throw error;
    }
  }

  async delete(filePath, _options = {}) {
    try {
      if (!this.accessToken) {
        throw new Error('OneDrive client not authenticated');
      }

      const url = `${this.baseURL}/me/drive/items/${filePath}`;

      await axios.delete(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return true;
    } catch (error) {
      logger.error('Error deleting file from OneDrive', { filePath, error: error.message });
      throw error;
    }
  }

  async search(query, options = {}) {
    try {
      if (!this.accessToken) {
        throw new Error('OneDrive client not authenticated');
      }

      const url = `${this.baseURL}/me/drive/root/search(q='${query}')`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        params: {
          $top: options.maxResults || 100,
        },
      });

      return (response.data.value || []).map((item) => ({
        id: item.id,
        name: item.name,
        path: item.id,
        type: item.folder ? 'folder' : 'file',
        size: item.size || 0,
        mimeType: item.file ? item.file.mimeType : 'application/x-folder',
        modifiedAt: new Date(item.lastModifiedDateTime),
      }));
    } catch (error) {
      logger.error('Error searching OneDrive', { query, error: error.message });
      throw error;
    }
  }

  async metadata(filePath) {
    try {
      if (!this.accessToken) {
        throw new Error('OneDrive client not authenticated');
      }

      const url = `${this.baseURL}/me/drive/items/${filePath}`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      const item = response.data;

      return {
        id: item.id,
        path: filePath,
        name: item.name,
        type: item.folder ? 'folder' : 'file',
        size: item.size || 0,
        mimeType: item.file ? item.file.mimeType : 'application/x-folder',
        encoding: item.folder ? null : FileFormatMapper.getEncoding(item.name),
        createdAt: new Date(item.createdDateTime),
        modifiedAt: new Date(item.lastModifiedDateTime),
        isDirectory: !!item.folder,
        isBinary: item.folder ? false : FileFormatMapper.isBinary(item.name),
      };
    } catch (error) {
      logger.error('Error getting metadata from OneDrive', { filePath, error: error.message });
      throw error;
    }
  }

  async createReadStream(filePath) {
    try {
      if (!this.accessToken) {
        throw new Error('OneDrive client not authenticated');
      }

      const url = `${this.baseURL}/me/drive/items/${filePath}/content`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        responseType: 'stream',
      });

      return response.data;
    } catch (error) {
      logger.error('Error creating read stream from OneDrive', { filePath, error: error.message });
      throw error;
    }
  }

  async getStorageInfo() {
    try {
      if (!this.accessToken) {
        return {
          provider: 'onedrive',
          authenticated: false,
        };
      }

      const response = await axios.get(`${this.baseURL}/me/drive`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return {
        provider: 'onedrive',
        authenticated: true,
        user: response.data.owner,
        quota: response.data.quota,
      };
    } catch (error) {
      logger.error('Error getting OneDrive storage info', { error: error.message });
      return {
        provider: 'onedrive',
        authenticated: false,
        error: error.message,
      };
    }
  }
}

module.exports = OneDriveProvider;
