const fs = require('fs').promises;
const LocalStorageProvider = require('../services/storage/local-provider');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');

const localProvider = new LocalStorageProvider();

const getFileSystem = asyncHandler(async (req, res) => {
  try {
    await localProvider.list('/');

    const buildTree = async (dirPath) => {
      const entries = await localProvider.list(dirPath);
      const nodes = await Promise.all(
        entries.map(async (entry) => {
          const node = {
            id: `${entry.path}-${Date.now()}`,
            name: entry.name,
            type: entry.isDirectory ? 'directory' : 'file',
            path: entry.path,
            size: entry.size,
            lastModified: entry.modifiedAt || new Date().toISOString(),
          };

          if (entry.isDirectory) {
            node.children = await buildTree(entry.path);
          }

          return node;
        })
      );

      return nodes;
    };

    const root = {
      id: 'root',
      name: 'root',
      type: 'directory',
      path: '/',
      lastModified: new Date().toISOString(),
      children: await buildTree('/'),
    };

    res.json({
      success: true,
      data: root,
    });
  } catch (error) {
    logger.error('Error fetching file system', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch file system',
    });
  }
});

const readFile = asyncHandler(async (req, res) => {
  try {
    const { path: filePath } = req.query;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'File path is required',
      });
    }

    const content = await localProvider.read(filePath);

    res.json({
      success: true,
      data: { content },
    });
  } catch (error) {
    logger.error('Error reading file', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to read file',
    });
  }
});

const writeFile = asyncHandler(async (req, res) => {
  try {
    const { path: filePath, content } = req.body;

    if (!filePath || content === undefined) {
      return res.status(400).json({
        success: false,
        error: 'File path and content are required',
      });
    }

    await localProvider.write(filePath, content);

    res.json({
      success: true,
      data: { path: filePath },
    });
  } catch (error) {
    logger.error('Error writing file', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to write file',
    });
  }
});

const createFile = asyncHandler(async (req, res) => {
  try {
    const { path: filePath, type } = req.body;

    if (!filePath || !type) {
      return res.status(400).json({
        success: false,
        error: 'File path and type are required',
      });
    }

    if (type === 'directory') {
      const fullPath = localProvider.validatePath(filePath);
      await fs.mkdir(fullPath, { recursive: true });
    } else {
      await localProvider.write(filePath, '');
    }

    const node = {
      id: `${filePath}-${Date.now()}`,
      name: filePath.split('/').pop(),
      type,
      path: filePath,
      lastModified: new Date().toISOString(),
    };

    res.status(201).json({
      success: true,
      data: node,
    });
  } catch (error) {
    logger.error('Error creating file', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create file',
    });
  }
});

const deleteFile = asyncHandler(async (req, res) => {
  try {
    const { path: filePath } = req.query;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'File path is required',
      });
    }

    await localProvider.delete(filePath);

    res.json({
      success: true,
      data: { path: filePath },
    });
  } catch (error) {
    logger.error('Error deleting file', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete file',
    });
  }
});

const renameFile = asyncHandler(async (req, res) => {
  try {
    const { oldPath, newPath } = req.body;

    if (!oldPath || !newPath) {
      return res.status(400).json({
        success: false,
        error: 'Old path and new path are required',
      });
    }

    await localProvider.rename(oldPath, newPath);

    const node = {
      id: `${newPath}-${Date.now()}`,
      name: newPath.split('/').pop(),
      type: 'file',
      path: newPath,
      lastModified: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: node,
    });
  } catch (error) {
    logger.error('Error renaming file', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to rename file',
    });
  }
});

const copyFile = asyncHandler(async (req, res) => {
  try {
    const { sourcePath, destinationPath } = req.body;

    if (!sourcePath || !destinationPath) {
      return res.status(400).json({
        success: false,
        error: 'Source path and destination path are required',
      });
    }

    // Read source and write to destination
    const content = await localProvider.read(sourcePath);
    await localProvider.write(destinationPath, content);

    const node = {
      id: `${destinationPath}-${Date.now()}`,
      name: destinationPath.split('/').pop(),
      type: 'file',
      path: destinationPath,
      lastModified: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: node,
    });
  } catch (error) {
    logger.error('Error copying file', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to copy file',
    });
  }
});

const downloadFile = asyncHandler(async (req, res) => {
  try {
    const { path: filePath } = req.query;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'File path is required',
      });
    }

    const content = await localProvider.read(filePath);
    const filename = filePath.split('/').pop();

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(content);
  } catch (error) {
    logger.error('Error downloading file', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to download file',
    });
  }
});

const uploadFile = asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided',
      });
    }

    const uploadPath = req.body.uploadPath || '/';
    const fileName = req.file.originalname;
    const filePath = uploadPath === '/' ? `/${fileName}` : `${uploadPath}/${fileName}`;

    // Save the uploaded file
    const content = req.file.buffer.toString('utf8');
    await localProvider.write(filePath, content);

    const node = {
      id: `${filePath}-${Date.now()}`,
      name: fileName,
      type: 'file',
      path: filePath,
      size: req.file.size,
      lastModified: new Date().toISOString(),
    };

    res.status(201).json({
      success: true,
      data: node,
      message: 'File uploaded successfully',
    });
  } catch (error) {
    logger.error('Error uploading file', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload file',
    });
  }
});

module.exports = {
  getFileSystem,
  readFile,
  writeFile,
  createFile,
  deleteFile,
  renameFile,
  copyFile,
  downloadFile,
  uploadFile,
};
