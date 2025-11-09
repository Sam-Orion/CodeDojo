class BaseStorageProvider {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * List files and folders in a directory
   * @param {string} _dirPath - Directory path
   * @returns {Promise<Array>} - Array of file/folder objects
   */
  async list(_dirPath) {
    throw new Error('list() not implemented');
  }

  /**
   * Read file content
   * @param {string} filePath - File path
   * @param {object} _options - Read options (encoding, stream, etc)
   * @returns {Promise<Buffer|string>} - File content
   */
  async read(filePath, _options = {}) {
    throw new Error('read() not implemented');
  }

  /**
   * Write file content
   * @param {string} filePath - File path
   * @param {Buffer|string} content - Content to write
   * @param {object} _options - Write options
   * @returns {Promise<object>} - File metadata
   */
  async write(filePath, content, _options = {}) {
    throw new Error('write() not implemented');
  }

  /**
   * Rename file or folder
   * @param {string} _oldPath - Old path
   * @param {string} _newPath - New path
   * @returns {Promise<object>} - File metadata
   */
  async rename(_oldPath, _newPath) {
    throw new Error('rename() not implemented');
  }

  /**
   * Delete file or folder
   * @param {string} filePath - File path
   * @param {object} _options - Delete options (recursive, etc)
   * @returns {Promise<boolean>} - Success status
   */
  async delete(filePath, _options = {}) {
    throw new Error('delete() not implemented');
  }

  /**
   * Search for files
   * @param {string} query - Search query
   * @param {object} _options - Search options
   * @returns {Promise<Array>} - Array of matching files
   */
  async search(query, _options = {}) {
    throw new Error('search() not implemented');
  }

  /**
   * Get file or folder metadata
   * @param {string} _filePath - File path
   * @returns {Promise<object>} - Metadata object
   */
  async metadata(_filePath) {
    throw new Error('metadata() not implemented');
  }

  /**
   * Create read stream
   * @param {string} _filePath - File path
   * @returns {Stream} - Read stream
   */
  createReadStream(_filePath) {
    throw new Error('createReadStream() not implemented');
  }

  /**
   * Create write stream
   * @param {string} _filePath - File path
   * @param {object} _options - Write options
   * @returns {Stream} - Write stream
   */
  createWriteStream(_filePath, _options = {}) {
    throw new Error('createWriteStream() not implemented');
  }

  /**
   * Check if provider is authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    throw new Error('isAuthenticated() not implemented');
  }

  /**
   * Refresh authentication tokens if needed
   * @returns {Promise<void>}
   */
  async refreshAuth() {
    throw new Error('refreshAuth() not implemented');
  }
}

module.exports = BaseStorageProvider;
