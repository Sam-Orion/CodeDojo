const http = require('http');

// Helper function to make HTTP requests
function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Run examples
async function runExamples() {
  console.log('CodeDojo Terminal REST API Examples');
  console.log('===================================\n');

  try {
    // Get capabilities
    console.log('1. Getting terminal capabilities...');
    const capabilities = await makeRequest('/api/v1/terminal/capabilities');
    console.log('✓ Capabilities:', JSON.stringify(capabilities.data.executionModes, null, 2));
    console.log('✓ Available providers:', capabilities.data.executionModes.cloud.providers);
    console.log('');

    // Get supported languages
    console.log('2. Getting supported languages...');
    const languages = await makeRequest('/api/v1/terminal/languages');
    console.log('✓ Supported languages:', languages.data.languages.join(', '));
    console.log('');

    // Get language details
    console.log('3. Language details:');
    const pythonDetail = languages.data.details.find((l) => l.language === 'python');
    console.log('  Python:', {
      extensions: pythonDetail.extensions,
      hasRepl: pythonDetail.hasRepl,
      dockerImage: pythonDetail.dockerImage,
    });

    const jsDetail = languages.data.details.find((l) => l.language === 'javascript');
    console.log('  JavaScript:', {
      extensions: jsDetail.extensions,
      hasRepl: jsDetail.hasRepl,
      dockerImage: jsDetail.dockerImage,
    });
    console.log('');

    // Get stats
    console.log('4. Getting terminal stats...');
    const stats = await makeRequest('/api/v1/terminal/stats');
    console.log('✓ Stats:', JSON.stringify(stats.data.sessions, null, 2));
    console.log('');

    console.log('✓ All examples completed successfully!');
  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

// Run if server is available
console.log('Note: Make sure the server is running with: npm run dev\n');
runExamples();
