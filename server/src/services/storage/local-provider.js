const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const BaseStorageProvider = require('./base-provider');
const FileFormatMapper = require('./file-format-mapper');
const logger = require('../../utils/logger');

class LocalStorageProvider extends BaseStorageProvider {
  constructor(options = {}) {
    super(options);
    this.basePath = options.basePath || path.join(process.cwd(), 'storage');
    this.sandboxPath = path.resolve(this.basePath);

    // Ensure sandbox directory exists
    if (!fsSync.existsSync(this.sandboxPath)) {
      fsSync.mkdirSync(this.sandboxPath, { recursive: true });
    }
  }

  validatePath(filePath) {
    // Remove leading slash for proper path.resolve behavior
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    const resolvedPath = path.resolve(this.sandboxPath, cleanPath);

    // Normalize paths for comparison
    const normalizedResolvedPath = path.normalize(resolvedPath);
    const normalizedSandboxPath = path.normalize(this.sandboxPath);

    // Check if resolved path is within sandbox
    if (
      !normalizedResolvedPath.startsWith(normalizedSandboxPath + path.sep) &&
      normalizedResolvedPath !== normalizedSandboxPath
    ) {
      throw new Error(`Access denied: Path ${filePath} is outside sandbox directory`);
    }
    return normalizedResolvedPath;
  }

  async list(dirPath = '/') {
    try {
      const fullPath = this.validatePath(dirPath);
      const entries = await fs.readdir(fullPath, { withFileTypes: true });

      const files = await Promise.all(
        entries.map(async (entry) => {
          const entryPath = path.join(dirPath, entry.name);
          const fullEntryPath = path.join(fullPath, entry.name);
          const stats = await fs.stat(fullEntryPath);

          return {
            name: entry.name,
            path: entryPath,
            type: entry.isDirectory() ? 'folder' : 'file',
            size: stats.size,
            mimeType: entry.isDirectory()
              ? 'application/x-folder'
              : FileFormatMapper.getMimeType(entry.name),
            modifiedAt: stats.mtime,
            createdAt: stats.birthtime,
            isDirectory: entry.isDirectory(),
          };
        })
      );

      return files;
    } catch (error) {
      logger.error('Error listing directory', { path: dirPath, error: error.message });
      throw error;
    }
  }

  async read(filePath, options = {}) {
    try {
      const fullPath = this.validatePath(filePath);
      const stats = await fs.stat(fullPath);

      if (stats.isDirectory()) {
        throw new Error('Cannot read a directory');
      }

      const encoding = options.encoding || FileFormatMapper.getEncoding(filePath);
      const content = await fs.readFile(fullPath, encoding);

      // Normalize line endings for text files
      if (!FileFormatMapper.isBinary(filePath) && options.normalizeNewlines !== false) {
        return FileFormatMapper.normalizeLineEndings(content);
      }

      return content;
    } catch (error) {
      logger.error('Error reading file', { path: filePath, error: error.message });
      throw error;
    }
  }

  async write(filePath, content, options = {}) {
    try {
      const fullPath = this.validatePath(filePath);

      // Create parent directory if it doesn't exist
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });

      // Normalize newlines for text files if not binary
      let contentToWrite = content;
      if (!FileFormatMapper.isBinary(filePath) && options.normalizeNewlines !== false) {
        contentToWrite = FileFormatMapper.normalizeLineEndings(content);
      }

      const encoding = options.encoding || FileFormatMapper.getEncoding(filePath);
      await fs.writeFile(fullPath, contentToWrite, encoding);

      const stats = await fs.stat(fullPath);
      return {
        path: filePath,
        name: path.basename(filePath),
        size: stats.size,
        mimeType: FileFormatMapper.getMimeType(filePath),
        modifiedAt: stats.mtime,
        version: options.version || 1,
      };
    } catch (error) {
      logger.error('Error writing file', { path: filePath, error: error.message });
      throw error;
    }
  }

  async rename(oldPath, newPath) {
    try {
      const fullOldPath = this.validatePath(oldPath);
      const fullNewPath = this.validatePath(newPath);

      await fs.rename(fullOldPath, fullNewPath);

      const stats = await fs.stat(fullNewPath);
      return {
        oldPath,
        newPath,
        name: path.basename(newPath),
        size: stats.size,
        mimeType: FileFormatMapper.getMimeType(newPath),
        modifiedAt: stats.mtime,
      };
    } catch (error) {
      logger.error('Error renaming file', { oldPath, newPath, error: error.message });
      throw error;
    }
  }

  async delete(filePath, options = {}) {
    try {
      const fullPath = this.validatePath(filePath);
      const stats = await fs.stat(fullPath);

      if (stats.isDirectory()) {
        if (options.recursive !== false) {
          await fs.rm(fullPath, { recursive: true, force: true });
        } else {
          await fs.rmdir(fullPath);
        }
      } else {
        await fs.unlink(fullPath);
      }

      return true;
    } catch (error) {
      logger.error('Error deleting file', { path: filePath, error: error.message });
      throw error;
    }
  }

  async search(query, options = {}) {
    try {
      const searchPath = this.validatePath(options.path || '/');
      const results = [];
      const maxResults = options.maxResults || 100;

      const searchRecursive = async (dirPath) => {
        if (results.length >= maxResults) return;

        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });

          for (const entry of entries) {
            if (results.length >= maxResults) break;

            const entryPath = path.join(dirPath, entry.name);
            const relPath = path.relative(searchPath, entryPath);

            if (entry.name.toLowerCase().includes(query.toLowerCase())) {
              const stats = await fs.stat(entryPath);
              results.push({
                name: entry.name,
                path: relPath,
                type: entry.isDirectory() ? 'folder' : 'file',
                size: stats.size,
                mimeType: entry.isDirectory()
                  ? 'application/x-folder'
                  : FileFormatMapper.getMimeType(entry.name),
                modifiedAt: stats.mtime,
              });
            }

            if (entry.isDirectory() && options.recursive !== false) {
              await searchRecursive(entryPath);
            }
          }
        } catch (err) {
          // Skip directories we can't read
          logger.warn('Error searching directory', { path: dirPath, error: err.message });
        }
      };

      await searchRecursive(searchPath);
      return results;
    } catch (error) {
      logger.error('Error searching files', { query, error: error.message });
      throw error;
    }
  }

  async metadata(filePath) {
    try {
      const fullPath = this.validatePath(filePath);
      const stats = await fs.stat(fullPath);

      return {
        path: filePath,
        name: path.basename(filePath),
        type: stats.isDirectory() ? 'folder' : 'file',
        size: stats.size,
        mimeType: stats.isDirectory()
          ? 'application/x-folder'
          : FileFormatMapper.getMimeType(filePath),
        encoding: stats.isDirectory() ? null : FileFormatMapper.getEncoding(filePath),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        isDirectory: stats.isDirectory(),
        isBinary: stats.isDirectory() ? false : FileFormatMapper.isBinary(filePath),
      };
    } catch (error) {
      logger.error('Error getting metadata', { path: filePath, error: error.message });
      throw error;
    }
  }

  createReadStream(filePath) {
    try {
      const fullPath = this.validatePath(filePath);
      return fsSync.createReadStream(fullPath, {
        encoding: FileFormatMapper.getEncoding(filePath),
      });
    } catch (error) {
      logger.error('Error creating read stream', { path: filePath, error: error.message });
      throw error;
    }
  }

  createWriteStream(filePath, options = {}) {
    try {
      const fullPath = this.validatePath(filePath);
      const dir = path.dirname(fullPath);

      // Create directory synchronously
      if (!fsSync.existsSync(dir)) {
        fsSync.mkdirSync(dir, { recursive: true });
      }

      return fsSync.createWriteStream(fullPath, {
        encoding: options.encoding || FileFormatMapper.getEncoding(filePath),
        flags: options.append ? 'a' : 'w',
      });
    } catch (error) {
      logger.error('Error creating write stream', { path: filePath, error: error.message });
      throw error;
    }
  }

  async isAuthenticated() {
    // Local provider is always authenticated if directory is accessible
    try {
      await fs.access(this.sandboxPath);
      return true;
    } catch {
      return false;
    }
  }

  async refreshAuth() {
    // Local provider doesn't need authentication refresh
    return Promise.resolve();
  }

  async getStorageInfo() {
    try {
      await fs.stat(this.sandboxPath);
      return {
        provider: 'local',
        basePath: this.sandboxPath,
        accessible: true,
        type: 'filesystem',
      };
    } catch (error) {
      return {
        provider: 'local',
        basePath: this.sandboxPath,
        accessible: false,
        error: error.message,
      };
    }
  }
}

module.exports = LocalStorageProvider;
