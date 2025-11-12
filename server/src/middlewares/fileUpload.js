const logger = require('../utils/logger');

const fileUploadMiddleware = (req, res, next) => {
  if (req.method !== 'POST') {
    return next();
  }

  const contentType = req.headers['content-type'];
  if (!contentType || !contentType.includes('multipart/form-data')) {
    return next();
  }

  const boundary = contentType.split('boundary=')[1];
  if (!boundary) {
    return next();
  }

  const chunks = [];
  let buffer = Buffer.alloc(0);

  req.on('data', (chunk) => {
    chunks.push(chunk);
  });

  req.on('end', () => {
    try {
      buffer = Buffer.concat(chunks);
      const parts = buffer.toString('binary').split(`--${boundary}`);

      req.file = null;
      req.body = req.body || {};

      for (let i = 1; i < parts.length - 1; i++) {
        const part = parts[i];
        const match = part.match(/name="([^"]*)"/);
        const fieldName = match ? match[1] : null;

        if (fieldName === 'file') {
          const fileMatch = part.match(/filename="([^"]*)"/);
          const filename = fileMatch ? fileMatch[1] : 'file';
          const contentTypeMatch = part.match(/Content-Type:\s*([^\r\n]*)/);
          const mimeType = contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream';

          const fileDataStart = part.indexOf('\r\n\r\n') + 4;
          const fileDataEnd = part.lastIndexOf('\r\n');
          const fileData = part.substring(fileDataStart, fileDataEnd);

          req.file = {
            fieldname: fieldName,
            originalname: filename,
            encoding: '7bit',
            mimetype: mimeType,
            buffer: Buffer.from(fileData, 'binary'),
            size: fileData.length,
          };
        } else if (fieldName) {
          const fieldDataStart = part.indexOf('\r\n\r\n') + 4;
          const fieldDataEnd = part.lastIndexOf('\r\n');
          const fieldData = part.substring(fieldDataStart, fieldDataEnd);
          req.body[fieldName] = fieldData;
        }
      }

      next();
    } catch (error) {
      logger.error('File upload parsing error', { error: error.message });
      next();
    }
  });

  req.on('error', (err) => {
    logger.error('Request stream error', { error: err.message });
    next();
  });
};

module.exports = fileUploadMiddleware;
