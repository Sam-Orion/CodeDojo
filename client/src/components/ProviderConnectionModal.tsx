import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { connectProvider, disconnectProvider } from '../store/slices/storageProviderSlice';
import { StorageProviderType } from '../types';

interface ProviderConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PROVIDERS: { type: StorageProviderType; name: string; icon: string; description: string }[] =
  [
    {
      type: 'google_drive',
      name: 'Google Drive',
      icon: '📄',
      description: 'Connect your Google Drive account to access your files',
    },
    {
      type: 'onedrive',
      name: 'OneDrive',
      icon: '☁️',
      description: 'Connect your Microsoft OneDrive account',
    },
    {
      type: 'local',
      name: 'Local Storage',
      icon: '💾',
      description: 'Use local file storage',
    },
  ];

const ProviderConnectionModal = ({ isOpen, onClose }: ProviderConnectionModalProps) => {
  const dispatch = useAppDispatch();
  const { providers, isConnecting, connectionError } = useAppSelector(
    (state) => state.storageProvider
  );
  const [selectedProvider, setSelectedProvider] = useState<StorageProviderType>('google_drive');

  const connectedProvider = providers.find((p) => p.type === selectedProvider && p.isConnected);

  const handleConnect = () => {
    const providerConfig = PROVIDERS.find((p) => p.type === selectedProvider);
    if (!providerConfig) return;

    if (selectedProvider === 'local') {
      dispatch(
        connectProvider({
          type: selectedProvider,
          code: 'local',
        })
      );
    } else {
      const redirectUri = `${window.location.origin}/oauth/callback`;
      const clientId =
        selectedProvider === 'google_drive'
          ? import.meta.env.VITE_GOOGLE_CLIENT_ID
          : import.meta.env.VITE_MICROSOFT_CLIENT_ID;

      if (!clientId) {
        console.error(`Missing client ID for ${selectedProvider}`);
        return;
      }

      let authUrl = '';
      if (selectedProvider === 'google_drive') {
        authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=https://www.googleapis.com/auth/drive`;
      } else if (selectedProvider === 'onedrive') {
        authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=Files.Read.All offline_access`;
      }

      if (authUrl) {
        window.location.href = authUrl;
      }
    }
  };

  const handleDisconnect = async () => {
    if (connectedProvider) {
      await dispatch(disconnectProvider(connectedProvider.id));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Connect Storage Provider"
      size="md"
      footer={
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {connectedProvider ? (
            <Button
              variant="danger"
              onClick={handleDisconnect}
              isLoading={isConnecting}
              disabled={isConnecting}
            >
              Disconnect
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleConnect}
              isLoading={isConnecting}
              disabled={isConnecting || !selectedProvider}
            >
              Connect Account
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {connectionError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-800 dark:bg-red-900 dark:border-red-800 dark:text-red-100">
            <p className="text-sm font-medium">{connectionError}</p>
          </div>
        )}

        <div className="space-y-3">
          {PROVIDERS.map((provider) => {
            const isConnected = providers.some((p) => p.type === provider.type && p.isConnected);
            const isSelected = selectedProvider === provider.type;

            return (
              <div
                key={provider.type}
                onClick={() => setSelectedProvider(provider.type)}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900 dark:border-primary-400'
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="provider"
                    value={provider.type}
                    checked={isSelected}
                    onChange={() => setSelectedProvider(provider.type)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{provider.icon}</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {provider.name}
                        </h3>
                        {isConnected && (
                          <span className="inline-block mt-1 px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 text-xs rounded font-medium">
                            Connected
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      {provider.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {connectedProvider && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md dark:bg-blue-900 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-100">
              <span className="font-semibold">Connected as:</span>{' '}
              {connectedProvider.email || connectedProvider.name}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ProviderConnectionModal;
