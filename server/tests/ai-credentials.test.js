const { expect } = require('chai');
const sinon = require('sinon');
const { AICredential } = require('../src/models');
const aiCredentialsController = require('../src/controllers/ai-credentials.controller');

describe('AI Credentials Controller', () => {
  let sandbox;
  let mockReq;
  let mockRes;
  let mockCredential;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    mockReq = {
      user: { id: 'user123' },
      body: {},
      params: {},
      query: {},
    };

    mockRes = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub(),
      write: sandbox.stub(),
      writeHead: sandbox.stub(),
      end: sandbox.stub(),
    };

    mockCredential = {
      _id: 'cred123',
      userId: 'user123',
      provider: 'openai',
      displayName: 'My OpenAI Key',
      isActive: true,
      usageCount: 5,
      lastUsedAt: new Date(),
      getApiKey: sandbox.stub().returns('sk-test-key'),
      setApiKey: sandbox.stub(),
      save: sandbox.stub().resolves(),
      toObject: sandbox.stub().returns({
        _id: 'cred123',
        userId: 'user123',
        provider: 'openai',
        displayName: 'My OpenAI Key',
        isActive: true,
        usageCount: 5,
      }),
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('createCredential', () => {
    it('should create new credential successfully', async () => {
      mockReq.body = {
        provider: 'openai',
        apiKey: 'sk-test-key',
        displayName: 'My OpenAI Key',
      };

      const createStub = sandbox.stub(AICredential, 'createCredential').resolves(mockCredential);

      await aiCredentialsController.createCredential(mockReq, mockRes);

      expect(createStub.calledOnce).to.be.true;
      expect(createStub.firstCall.args[0]).to.equal('user123');
      expect(createStub.firstCall.args[1]).to.equal('openai');
      expect(createStub.firstCall.args[2]).to.equal('sk-test-key');
      expect(createStub.firstCall.args[3]).to.equal('My OpenAI Key');
      expect(mockRes.status.calledWith(201)).to.be.true;
      expect(mockRes.json.calledOnce).to.be.true;
    });

    it('should return error for missing required fields', async () => {
      mockReq.body = {
        provider: 'openai',
        // Missing apiKey and displayName
      };

      await aiCredentialsController.createCredential(mockReq, mockRes);

      expect(mockRes.status.calledWith(400)).to.be.true;
      expect(mockRes.json.calledWith(sinon.match.has('error'))).to.be.true;
    });

    it('should return error for invalid provider', async () => {
      mockReq.body = {
        provider: 'invalid-provider',
        apiKey: 'test-key',
        displayName: 'Test',
      };

      await aiCredentialsController.createCredential(mockReq, mockRes);

      expect(mockRes.status.calledWith(400)).to.be.true;
      expect(mockRes.json.calledWith(sinon.match.has('error'))).to.be.true;
    });

    it('should return error for duplicate credential', async () => {
      mockReq.body = {
        provider: 'openai',
        apiKey: 'sk-test-key',
        displayName: 'My OpenAI Key',
      };

      sandbox.stub(AICredential, 'findByUserAndProvider').resolves(mockCredential);

      await aiCredentialsController.createCredential(mockReq, mockRes);

      expect(mockRes.status.calledWith(409)).to.be.true;
      expect(mockRes.json.calledWith(sinon.match.has('error'))).to.be.true;
    });
  });

  describe('getCredentials', () => {
    it('should return user credentials', async () => {
      const credentials = [mockCredential];
      sandbox.stub(AICredential, 'findByUser').resolves(credentials);

      await aiCredentialsController.getCredentials(mockReq, mockRes);

      expect(
        mockRes.json.calledWith({
          credentials,
          count: 1,
        })
      ).to.be.true;
    });

    it('should return error for missing userId', async () => {
      delete mockReq.user;
      delete mockReq.query.userId;

      await aiCredentialsController.getCredentials(mockReq, mockRes);

      expect(mockRes.status.calledWith(400)).to.be.true;
      expect(mockRes.json.calledWith(sinon.match.has('error'))).to.be.true;
    });
  });

  describe('getCredential', () => {
    it('should return specific credential', async () => {
      mockReq.params.id = 'cred123';
      sandbox.stub(AICredential, 'findOne').resolves(mockCredential);

      await aiCredentialsController.getCredential(mockReq, mockRes);

      expect(mockRes.json.calledOnce).to.be.true;
      const response = mockRes.json.firstCall.args[0];
      expect(response._id).to.equal('cred123');
      expect(response).to.not.have.property('encryptedApiKey');
    });

    it('should return 404 for non-existent credential', async () => {
      mockReq.params.id = 'nonexistent';
      sandbox.stub(AICredential, 'findOne').resolves(null);

      await aiCredentialsController.getCredential(mockReq, mockRes);

      expect(mockRes.status.calledWith(404)).to.be.true;
      expect(mockRes.json.calledWith(sinon.match.has('error'))).to.be.true;
    });
  });

  describe('updateCredential', () => {
    it('should update credential successfully', async () => {
      mockReq.params.id = 'cred123';
      mockReq.body = {
        displayName: 'Updated Name',
        isActive: false,
      };

      sandbox.stub(AICredential, 'findOne').resolves(mockCredential);

      await aiCredentialsController.updateCredential(mockReq, mockRes);

      expect(mockCredential.displayName).to.equal('Updated Name');
      expect(mockCredential.isActive).to.be.false;
      expect(mockCredential.save.calledOnce).to.be.true;
      expect(mockRes.json.calledOnce).to.be.true;
    });

    it('should update API key when provided', async () => {
      mockReq.params.id = 'cred123';
      mockReq.body = {
        apiKey: 'new-api-key',
      };

      sandbox.stub(AICredential, 'findOne').resolves(mockCredential);

      await aiCredentialsController.updateCredential(mockReq, mockRes);

      expect(mockCredential.setApiKey.calledWith('new-api-key')).to.be.true;
    });
  });

  describe('deleteCredential', () => {
    it('should delete credential successfully', async () => {
      mockReq.params.id = 'cred123';
      sandbox.stub(AICredential, 'findOne').resolves(mockCredential);
      const deleteStub = sandbox.stub(AICredential, 'deleteOne').resolves();

      await aiCredentialsController.deleteCredential(mockReq, mockRes);

      expect(deleteStub.calledWith({ _id: 'cred123' })).to.be.true;
      expect(mockRes.json.calledWith({ success: true })).to.be.true;
    });

    it('should return 404 for non-existent credential', async () => {
      mockReq.params.id = 'nonexistent';
      sandbox.stub(AICredential, 'findOne').resolves(null);

      await aiCredentialsController.deleteCredential(mockReq, mockRes);

      expect(mockRes.status.calledWith(404)).to.be.true;
    });
  });

  describe('testCredential', () => {
    it('should test credential successfully', async () => {
      mockReq.params.id = 'cred123';
      mockCredential.provider = 'openai';
      mockCredential.isActive = true;
      sandbox.stub(AICredential, 'findOne').resolves(mockCredential);

      const OpenAIProvider = require('../src/services/ai/openai.provider');
      sandbox.stub(OpenAIProvider.prototype, 'completion').resolves({
        content: 'Hello World',
        usage: { total_tokens: 5 },
      });

      await aiCredentialsController.testCredential(mockReq, mockRes);

      expect(
        mockRes.json.calledWith(
          sinon.match({
            success: true,
            provider: 'openai',
          })
        )
      ).to.be.true;
    });

    it('should test gemini credential successfully', async () => {
      mockReq.params.id = 'cred123';
      mockCredential.provider = 'gemini';
      mockCredential.isActive = true;
      sandbox.stub(AICredential, 'findOne').resolves(mockCredential);

      const GeminiProvider = require('../src/services/ai/gemini.provider');
      sandbox.stub(GeminiProvider.prototype, 'completion').resolves({
        content: 'Gemini response',
        usage: { totalTokenCount: 7 },
      });

      await aiCredentialsController.testCredential(mockReq, mockRes);

      expect(
        mockRes.json.calledWith(
          sinon.match({
            success: true,
            provider: 'gemini',
          })
        )
      ).to.be.true;
    });

    it('should return error for inactive credential', async () => {
      mockReq.params.id = 'cred123';
      mockCredential.isActive = false;
      sandbox.stub(AICredential, 'findOne').resolves(mockCredential);

      await aiCredentialsController.testCredential(mockReq, mockRes);

      expect(mockRes.status.calledWith(404)).to.be.true;
      mockCredential.isActive = true;
    });

    it('should handle test failure', async () => {
      mockReq.params.id = 'cred123';
      mockCredential.provider = 'openai';
      mockCredential.isActive = true;
      sandbox.stub(AICredential, 'findOne').resolves(mockCredential);

      const OpenAIProvider = require('../src/services/ai/openai.provider');
      sandbox.stub(OpenAIProvider.prototype, 'completion').rejects(new Error('API Error'));

      await aiCredentialsController.testCredential(mockReq, mockRes);

      expect(mockRes.status.calledWith(400)).to.be.true;
      expect(
        mockRes.json.calledWith(
          sinon.match({
            success: false,
          })
        )
      ).to.be.true;
    });
  });

  describe('getCredentialStats', () => {
    it('should return credential statistics', async () => {
      const credentials = [
        mockCredential,
        { ...mockCredential, provider: 'anthropic', isActive: false },
      ];
      sandbox.stub(AICredential, 'find').resolves(credentials);

      await aiCredentialsController.getCredentialStats(mockReq, mockRes);

      expect(
        mockRes.json.calledWith(
          sinon.match({
            totalCredentials: 2,
            activeCredentials: 1,
            totalUsage: 10,
            byProvider: {
              openai: { count: 2, usage: 10 },
              anthropic: { count: 0, usage: 0 },
            },
          })
        )
      ).to.be.true;
    });
  });
});
