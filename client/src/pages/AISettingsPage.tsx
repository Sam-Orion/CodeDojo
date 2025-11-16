import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchCredentials,
  createCredential,
  updateCredential,
  deleteCredential,
  testCredential,
  fetchUsageStats,
  updateSettings,
  clearError,
  exportSettings,
} from '../store/slices/aiSettingsSlice';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card, { CardHeader, CardBody } from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Loader from '../components/ui/Loader';

const AISettingsPage = () => {
  const dispatch = useAppDispatch();
  const {
    credentials,
    settings,
    usageStats,
    supportedProviders,
    isLoading,
    isTesting,
    error,
    testResults,
  } = useAppSelector((state) => state.aiSettings);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCredential, setEditingCredential] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    provider: '',
    displayName: '',
    apiKey: '',
    model: '',
    baseURL: '',
    organization: '',
  });

  const [showApiKey, setShowApiKey] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    dispatch(fetchCredentials());
    dispatch(fetchUsageStats());
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => dispatch(clearError()), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, dispatch]);

  const handleAddCredential = () => {
    setFormData({
      provider: '',
      displayName: '',
      apiKey: '',
      model: '',
      baseURL: '',
      organization: '',
    });
    setEditingCredential(null);
    setShowAddModal(true);
  };

  const handleEditCredential = (credId: string) => {
    const credential = credentials.find((c) => c._id === credId);
    if (credential) {
      setFormData({
        provider: credential.provider,
        displayName: credential.displayName,
        apiKey: '',
        model: credential.metadata?.model || '',
        baseURL: credential.metadata?.baseURL || '',
        organization: credential.metadata?.organization || '',
      });
      setEditingCredential(credId);
      setShowAddModal(true);
    }
  };

  const handleSubmit = async () => {
    if (!formData.provider || !formData.displayName || (!editingCredential && !formData.apiKey)) {
      return;
    }

    const metadata: Record<string, string> = {};
    if (formData.model) metadata.model = formData.model;
    if (formData.baseURL) metadata.baseURL = formData.baseURL;
    if (formData.organization) metadata.organization = formData.organization;

    if (editingCredential) {
      const updates: Record<string, unknown> = {
        id: editingCredential,
        displayName: formData.displayName,
        metadata,
      };
      if (formData.apiKey) {
        updates.apiKey = formData.apiKey;
      }
      await dispatch(updateCredential(updates as any));
    } else {
      await dispatch(
        createCredential({
          provider: formData.provider,
          apiKey: formData.apiKey,
          displayName: formData.displayName,
          metadata,
        })
      );
    }

    setShowAddModal(false);
    dispatch(fetchCredentials());
    dispatch(fetchUsageStats());
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this credential?')) {
      await dispatch(deleteCredential(id));
      dispatch(fetchUsageStats());
    }
  };

  const handleTest = async (id: string) => {
    await dispatch(testCredential(id));
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    await dispatch(
      updateCredential({
        id,
        isActive: !currentStatus,
      })
    );
  };

  const handleProviderChange = (
    type: 'defaultProvider' | 'chatProvider' | 'codeProvider' | 'fallbackProvider',
    value: string
  ) => {
    dispatch(updateSettings({ [type]: value || null }));
  };

  const getProviderInfo = (providerName: string) => {
    return supportedProviders.find((p) => p.name === providerName);
  };

  const getCredentialForProvider = (providerName: string) => {
    return credentials.find((c) => c.provider === providerName && c.isActive);
  };

  const handleExportSettings = () => {
    dispatch(exportSettings());
  };

  if (isLoading && credentials.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-8 max-w-6xl">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">AI Provider Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage API keys and configure AI providers
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleExportSettings}>
            Export Settings
          </Button>
          <Button variant="primary" onClick={handleAddCredential}>
            Add API Key
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Supported AI Providers
          </h2>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {supportedProviders.map((provider) => {
              const credential = getCredentialForProvider(provider.name);
              const isConfigured = !!credential;
              const testResult = credential ? testResults[credential._id] : null;

              return (
                <div
                  key={provider.name}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{provider.icon}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {provider.displayName}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {provider.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isConfigured ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          ✓ Configured
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          Not Configured
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {provider.capabilities.map((cap: string) => (
                      <span
                        key={cap}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>

                  {credential && (
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Display Name:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {credential.displayName}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Usage Count:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {credential.usageCount}
                        </span>
                      </div>
                      {credential.lastUsedAt && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Last Used:</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {new Date(credential.lastUsedAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {testResult && typeof testResult === 'object' && 'success' in testResult && (
                    <div
                      className={`text-xs p-2 rounded mb-2 ${
                        testResult.success
                          ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      }`}
                    >
                      {testResult.success ? '✓ ' : '✗ '}
                      {'message' in testResult ? testResult.message : ''}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {isConfigured ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleEditCredential(credential._id)}
                          className="flex-1"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleTest(credential._id)}
                          disabled={!!isTesting[credential._id]}
                          className="flex-1"
                        >
                          {isTesting[credential._id] ? 'Testing...' : 'Test'}
                        </Button>
                        <Button
                          variant={credential.isActive ? 'ghost' : 'primary'}
                          size="sm"
                          onClick={() => handleToggleActive(credential._id, credential.isActive)}
                        >
                          {credential.isActive ? 'Disable' : 'Enable'}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleAddCredential}
                        className="flex-1"
                      >
                        Configure
                      </Button>
                    )}
                  </div>

                  <div className="mt-2">
                    <a
                      href={provider.documentation}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View Documentation →
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Provider Selection
          </h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <label className="label mb-1">Default Provider</label>
            <select
              value={settings.defaultProvider || ''}
              onChange={(e) => handleProviderChange('defaultProvider', e.target.value)}
              className="input-field"
            >
              <option value="">-- Select Default Provider --</option>
              {credentials
                .filter((c) => c.isActive)
                .map((c) => (
                  <option key={c._id} value={c.provider}>
                    {getProviderInfo(c.provider)?.displayName} - {c.displayName}
                  </option>
                ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Used when no specific provider is selected
            </p>
          </div>

          <div>
            <label className="label mb-1">Chat Provider</label>
            <select
              value={settings.chatProvider || ''}
              onChange={(e) => handleProviderChange('chatProvider', e.target.value)}
              className="input-field"
            >
              <option value="">-- Use Default --</option>
              {credentials
                .filter((c) => c.isActive)
                .map((c) => (
                  <option key={c._id} value={c.provider}>
                    {getProviderInfo(c.provider)?.displayName} - {c.displayName}
                  </option>
                ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Specific provider for chat conversations
            </p>
          </div>

          <div>
            <label className="label mb-1">Code Generation Provider</label>
            <select
              value={settings.codeProvider || ''}
              onChange={(e) => handleProviderChange('codeProvider', e.target.value)}
              className="input-field"
            >
              <option value="">-- Use Default --</option>
              {credentials
                .filter((c) => c.isActive)
                .map((c) => (
                  <option key={c._id} value={c.provider}>
                    {getProviderInfo(c.provider)?.displayName} - {c.displayName}
                  </option>
                ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Specific provider for code generation and completion
            </p>
          </div>

          <div>
            <label className="label mb-1">Fallback Provider</label>
            <select
              value={settings.fallbackProvider || ''}
              onChange={(e) => handleProviderChange('fallbackProvider', e.target.value)}
              className="input-field"
            >
              <option value="">-- No Fallback --</option>
              {credentials
                .filter((c) => c.isActive)
                .map((c) => (
                  <option key={c._id} value={c.provider}>
                    {getProviderInfo(c.provider)?.displayName} - {c.displayName}
                  </option>
                ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Used when primary provider fails or is unavailable
            </p>
          </div>
        </CardBody>
      </Card>

      {usageStats && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Usage Statistics
            </h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {usageStats.totalCredentials}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Credentials</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {usageStats.activeCredentials}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Active Credentials</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {usageStats.totalUsage.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total API Calls</div>
              </div>
            </div>

            {Object.keys(usageStats.byProvider).length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Usage by Provider
                </h3>
                <div className="space-y-2">
                  {Object.entries(usageStats.byProvider).map(([provider, stats]) => {
                    const statsObj = stats as { count: number; usage: number };
                    return (
                      <div
                        key={provider}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">
                            {getProviderInfo(provider)?.icon || '🤖'}
                          </span>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {getProviderInfo(provider)?.displayName || provider}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {statsObj.count} credential{statsObj.count !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {statsObj.usage.toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">API calls</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">All Credentials</h2>
        </CardHeader>
        <CardBody>
          {credentials.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No credentials configured. Add your first API key to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {credentials.map((credential) => (
                <div
                  key={credential._id}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">
                      {getProviderInfo(credential.provider)?.icon || '🤖'}
                    </span>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {credential.displayName}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {getProviderInfo(credential.provider)?.displayName || credential.provider}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-1">
                        Key ID: {credential.keyId.substring(0, 8)}...
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        credential.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {credential.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleEditCredential(credential._id)}
                    >
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(credential._id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={editingCredential ? 'Edit API Key' : 'Add API Key'}
      >
        <div className="space-y-4">
          {!editingCredential && (
            <div>
              <label className="label mb-1">Provider</label>
              <select
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                className="input-field"
                required
              >
                <option value="">-- Select Provider --</option>
                {supportedProviders.map((provider) => (
                  <option key={provider.name} value={provider.name}>
                    {provider.icon} {provider.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Input
            type="text"
            label="Display Name"
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            placeholder="e.g., My OpenAI Key"
            required
          />

          <div>
            <label className="label mb-1">
              API Key {editingCredential && '(leave empty to keep current)'}
            </label>
            <div className="relative">
              <input
                type={showApiKey.form ? 'text' : 'password'}
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                className="input-field pr-20"
                placeholder="sk-..."
                required={!editingCredential}
              />
              <button
                type="button"
                onClick={() => setShowApiKey({ ...showApiKey, form: !showApiKey.form })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {showApiKey.form ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Your API key is encrypted and stored securely
            </p>
          </div>

          <Input
            type="text"
            label="Model (Optional)"
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            placeholder="e.g., gpt-4, claude-3-opus"
          />

          <Input
            type="text"
            label="Base URL (Optional)"
            value={formData.baseURL}
            onChange={(e) => setFormData({ ...formData, baseURL: e.target.value })}
            placeholder="e.g., https://api.openai.com/v1"
          />

          <Input
            type="text"
            label="Organization (Optional)"
            value={formData.organization}
            onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
            placeholder="For OpenAI organization ID"
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!formData.displayName || (!editingCredential && !formData.apiKey)}
            >
              {editingCredential ? 'Update' : 'Add'} Credential
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AISettingsPage;
