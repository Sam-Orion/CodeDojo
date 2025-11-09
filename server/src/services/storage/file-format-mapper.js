const SUPPORTED_FORMATS = {
  js: {
    mimeType: 'text/javascript',
    encoding: 'utf8',
    isBinary: false,
    extensions: ['.js', '.mjs', '.cjs'],
  },
  ts: {
    mimeType: 'text/typescript',
    encoding: 'utf8',
    isBinary: false,
    extensions: ['.ts', '.tsx'],
  },
  py: {
    mimeType: 'text/x-python',
    encoding: 'utf8',
    isBinary: false,
    extensions: ['.py'],
  },
  java: {
    mimeType: 'text/x-java-source',
    encoding: 'utf8',
    isBinary: false,
    extensions: ['.java'],
  },
  c: {
    mimeType: 'text/x-c',
    encoding: 'utf8',
    isBinary: false,
    extensions: ['.c'],
  },
  cpp: {
    mimeType: 'text/x-c++src',
    encoding: 'utf8',
    isBinary: false,
    extensions: ['.cpp', '.cc', '.cxx', '.c++'],
  },
  go: {
    mimeType: 'text/x-go',
    encoding: 'utf8',
    isBinary: false,
    extensions: ['.go'],
  },
  rs: {
    mimeType: 'text/x-rustsrc',
    encoding: 'utf8',
    isBinary: false,
    extensions: ['.rs'],
  },
  html: {
    mimeType: 'text/html',
    encoding: 'utf8',
    isBinary: false,
    extensions: ['.html', '.htm'],
  },
  css: {
    mimeType: 'text/css',
    encoding: 'utf8',
    isBinary: false,
    extensions: ['.css'],
  },
  json: {
    mimeType: 'application/json',
    encoding: 'utf8',
    isBinary: false,
    extensions: ['.json'],
  },
  yaml: {
    mimeType: 'text/yaml',
    encoding: 'utf8',
    isBinary: false,
    extensions: ['.yaml', '.yml'],
  },
  md: {
    mimeType: 'text/markdown',
    encoding: 'utf8',
    isBinary: false,
    extensions: ['.md', '.markdown'],
  },
  xml: {
    mimeType: 'application/xml',
    encoding: 'utf8',
    isBinary: false,
    extensions: ['.xml'],
  },
  sql: {
    mimeType: 'text/x-sql',
    encoding: 'utf8',
    isBinary: false,
    extensions: ['.sql'],
  },
  txt: {
    mimeType: 'text/plain',
    encoding: 'utf8',
    isBinary: false,
    extensions: ['.txt'],
  },
  sh: {
    mimeType: 'text/x-shellscript',
    encoding: 'utf8',
    isBinary: false,
    extensions: ['.sh', '.bash'],
  },
  env: {
    mimeType: 'text/plain',
    encoding: 'utf8',
    isBinary: false,
    extensions: ['.env', '.env.example', '.env.local'],
  },
};

class FileFormatMapper {
  static getSupportedFormats() {
    return Object.keys(SUPPORTED_FORMATS);
  }

  static getFormatConfig(format) {
    return SUPPORTED_FORMATS[format] || null;
  }

  static getMimeType(filePath) {
    const format = this.detectFormat(filePath);
    if (format) {
      return SUPPORTED_FORMATS[format].mimeType;
    }
    // Default MIME types for unknown formats
    return 'application/octet-stream';
  }

  static getEncoding(filePath) {
    const format = this.detectFormat(filePath);
    if (format) {
      return SUPPORTED_FORMATS[format].encoding;
    }
    return 'utf8';
  }

  static isBinary(filePath) {
    const format = this.detectFormat(filePath);
    if (format) {
      return SUPPORTED_FORMATS[format].isBinary;
    }
    return true; // Assume binary for unknown formats
  }

  static detectFormat(filePath) {
    if (!filePath) return null;

    const fileName = filePath.toLowerCase();

    // Check for specific file names (like .env, .env.example)
    if (fileName.includes('.env')) {
      return 'env';
    }

    // Check by extension
    for (const [format, config] of Object.entries(SUPPORTED_FORMATS)) {
      for (const ext of config.extensions) {
        if (fileName.endsWith(ext)) {
          return format;
        }
      }
    }

    return null;
  }

  static normalizeLineEndings(content, _format = null) {
    if (!content) return content;

    if (typeof content !== 'string') {
      return content;
    }

    // Normalize to LF (Unix style)
    return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  static normalizeNewlines(content) {
    return this.normalizeLineEndings(content);
  }

  static isFormatSupported(filePath) {
    return this.detectFormat(filePath) !== null;
  }

  static getFormatDescription(fmt) {
    const config = SUPPORTED_FORMATS[fmt];
    if (!config) return null;

    const extensions = config.extensions.join(', ');
    return {
      format: fmt,
      mimeType: config.mimeType,
      encoding: config.encoding,
      isBinary: config.isBinary,
      extensions,
    };
  }
}

module.exports = FileFormatMapper;
