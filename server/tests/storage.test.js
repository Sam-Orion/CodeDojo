const assert = require('assert');
const fs = require('fs').promises;
const path = require('path');
const LocalStorageProvider = require('../src/services/storage/local-provider');
const FileFormatMapper = require('../src/services/storage/file-format-mapper');
const providerRegistry = require('../src/services/storage/provider-registry');

describe('Storage Abstraction', () => {
  describe('FileFormatMapper', () => {
    it('should detect supported formats', () => {
      const formats = FileFormatMapper.getSupportedFormats();
      assert(formats.includes('js'));
      assert(formats.includes('py'));
      assert(formats.includes('ts'));
      assert(formats.includes('json'));
      assert(formats.includes('md'));
      assert(formats.includes('env'));
    });

    it('should detect format from file path', () => {
      assert.strictEqual(FileFormatMapper.detectFormat('test.js'), 'js');
      assert.strictEqual(FileFormatMapper.detectFormat('script.py'), 'py');
      assert.strictEqual(FileFormatMapper.detectFormat('config.json'), 'json');
      assert.strictEqual(FileFormatMapper.detectFormat('readme.md'), 'md');
      assert.strictEqual(FileFormatMapper.detectFormat('.env'), 'env');
      assert.strictEqual(FileFormatMapper.detectFormat('.env.example'), 'env');
      assert.strictEqual(FileFormatMapper.detectFormat('.env.local'), 'env');
      assert.strictEqual(FileFormatMapper.detectFormat('unknown.xyz'), null);
    });

    it('should get correct MIME type', () => {
      assert.strictEqual(FileFormatMapper.getMimeType('test.js'), 'text/javascript');
      assert.strictEqual(FileFormatMapper.getMimeType('script.py'), 'text/x-python');
      assert.strictEqual(FileFormatMapper.getMimeType('data.json'), 'application/json');
      assert.strictEqual(FileFormatMapper.getMimeType('readme.md'), 'text/markdown');
    });

    it('should identify binary vs text files', () => {
      assert.strictEqual(FileFormatMapper.isBinary('test.js'), false);
      assert.strictEqual(FileFormatMapper.isBinary('script.py'), false);
      assert.strictEqual(FileFormatMapper.isBinary('readme.md'), false);
      assert.strictEqual(FileFormatMapper.isBinary('unknown.xyz'), true);
    });

    it('should normalize line endings', () => {
      const windowsText = 'line1\r\nline2\r\nline3';
      const macText = 'line1\rline2\rline3';
      const unixText = 'line1\nline2\nline3';

      const normalized = FileFormatMapper.normalizeLineEndings(windowsText);
      assert.strictEqual(normalized, unixText);

      const macNormalized = FileFormatMapper.normalizeLineEndings(macText);
      assert.strictEqual(macNormalized, unixText);
    });

    it('should get format description', () => {
      const desc = FileFormatMapper.getFormatDescription('js');
      assert(desc);
      assert.strictEqual(desc.format, 'js');
      assert.strictEqual(desc.mimeType, 'text/javascript');
      assert.strictEqual(desc.isBinary, false);
    });
  });

  describe('ProviderRegistry', () => {
    it('should list available providers', () => {
      const providers = providerRegistry.getAvailableProviders();
      assert(providers.includes('local'));
      assert(providers.includes('google-drive'));
      assert(providers.includes('onedrive'));
    });

    it('should check if provider is registered', () => {
      assert(providerRegistry.isProviderRegistered('local'));
      assert(providerRegistry.isProviderRegistered('google-drive'));
      assert(providerRegistry.isProviderRegistered('onedrive'));
      assert(!providerRegistry.isProviderRegistered('unknown'));
    });

    it('should create provider instance', () => {
      const provider = providerRegistry.createProvider('local', {
        basePath: path.join(__dirname, 'storage-test'),
      });
      assert(provider);
      assert.strictEqual(typeof provider.list, 'function');
      assert.strictEqual(typeof provider.read, 'function');
      assert.strictEqual(typeof provider.write, 'function');
    });

    it('should throw error for unknown provider', () => {
      assert.throws(() => {
        providerRegistry.createProvider('unknown');
      }, /Unknown provider/);
    });
  });

  describe('LocalStorageProvider', () => {
    let provider;
    const testDir = path.join(__dirname, 'storage-test');

    before(async () => {
      try {
        await fs.rm(testDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
      provider = new LocalStorageProvider({ basePath: testDir });
    });

    after(async () => {
      try {
        await fs.rm(testDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    });

    it('should be authenticated', async () => {
      const authenticated = await provider.isAuthenticated();
      assert.strictEqual(authenticated, true);
    });

    it('should create and list files', async () => {
      await provider.write('/test.js', 'console.log("hello");');
      await provider.write('/script.py', 'print("hello")');

      const files = await provider.list('/');
      assert.strictEqual(files.length, 2);
      assert(files.some((f) => f.name === 'test.js'));
      assert(files.some((f) => f.name === 'script.py'));
    });

    it('should read file content', async () => {
      const content = await provider.read('/test.js');
      assert.strictEqual(content, 'console.log("hello");');
    });

    it('should write and overwrite files', async () => {
      await provider.write('/test.js', 'updated content');
      const content = await provider.read('/test.js');
      assert.strictEqual(content, 'updated content');
    });

    it('should rename files', async () => {
      await provider.write('/original.js', 'content');
      await provider.rename('/original.js', '/renamed.js');

      const files = await provider.list('/');
      assert(!files.some((f) => f.name === 'original.js'));
      assert(files.some((f) => f.name === 'renamed.js'));
    });

    it('should delete files', async () => {
      await provider.write('/to-delete.js', 'content');
      await provider.delete('/to-delete.js');

      const files = await provider.list('/');
      assert(!files.some((f) => f.name === 'to-delete.js'));
    });

    it('should search files', async () => {
      await provider.write('/search-test.js', 'content');
      await provider.write('/another-file.py', 'content');

      const results = await provider.search('search');
      assert(results.some((r) => r.name === 'search-test.js'));
    });

    it('should get file metadata', async () => {
      await provider.write('/metadata-test.js', 'content');
      const metadata = await provider.metadata('/metadata-test.js');

      assert.strictEqual(metadata.name, 'metadata-test.js');
      assert.strictEqual(metadata.type, 'file');
      assert(metadata.size > 0);
      assert.strictEqual(metadata.mimeType, 'text/javascript');
      assert.strictEqual(metadata.isBinary, false);
    });

    it('should create directories', async () => {
      await provider.write('/dir1/subdir/file.js', 'content');
      const files = await provider.list('/dir1/subdir');

      assert(files.some((f) => f.name === 'file.js'));
    });

    it('should normalize line endings when writing', async () => {
      await provider.write('/newlines.js', 'line1\r\nline2\r\nline3');
      const content = await provider.read('/newlines.js');
      assert.strictEqual(content, 'line1\nline2\nline3');
    });

    it('should reject paths outside sandbox', async () => {
      assert.throws(() => {
        provider.validatePath('../../etc/passwd');
      }, /Access denied/);
    });

    it('should handle directory operations', async () => {
      await provider.write('/dir/file1.js', 'content1');
      await provider.write('/dir/file2.js', 'content2');

      const files = await provider.list('/dir');
      assert.strictEqual(files.length, 2);

      await provider.delete('/dir', { recursive: true });
      const listAfterDelete = await provider.list('/');
      assert(!listAfterDelete.some((f) => f.name === 'dir'));
    });

    it('should get storage info', async () => {
      const info = await provider.getStorageInfo();
      assert.strictEqual(info.provider, 'local');
      assert.strictEqual(info.accessible, true);
      assert.strictEqual(info.type, 'filesystem');
    });

    it('should create read stream', async () => {
      await provider.write('/stream-test.js', 'stream content');
      const stream = provider.createReadStream('/stream-test.js');
      assert(stream);
      assert.strictEqual(typeof stream.on, 'function');
    });

    it('should create write stream', async () => {
      const stream = provider.createWriteStream('/write-stream-test.js');
      assert(stream);
      assert.strictEqual(typeof stream.write, 'function');
    });

    it('should respect file encodings', async () => {
      await provider.write('/utf8.txt', 'Hello World');
      const metadata = await provider.metadata('/utf8.txt');
      assert.strictEqual(metadata.encoding, 'utf8');
    });
  });
});
