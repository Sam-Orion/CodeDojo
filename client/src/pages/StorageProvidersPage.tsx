import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchProviders,
  disconnectProvider,
  setCurrentProviderId,
  updateProviderLastAccessed,
} from '../store/slices/storageProviderSlice';
import Button from '../components/ui/Button';
import Card, { CardBody } from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import ProviderConnectionModal from '../components/ProviderConnectionModal';
import { StorageProviderType } from '../types';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

const PROVIDER_ICONS: Record<StorageProviderType, string> = {
  google_drive: '📄',
  onedrive: '☁️',
  local: '💾',
};

const PROVIDER_NAMES: Record<StorageProviderType, string> = {
  google_drive: 'Google Drive',
  onedrive: 'OneDrive',
  local: 'Local Storage',
};

const StorageProvidersPage = () => {
  const dispatch = useAppDispatch();
  const { providers, currentProviderId, isLoading } = useAppSelector(
    (state) => state.storageProvider
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [selectedForDisconnect, setSelectedForDisconnect] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchProviders());
  }, [dispatch]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, type, duration: 5000 }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const handleConnect = () => {
    setIsModalOpen(true);
  };

  const handleDisconnect = (providerId: string) => {
    setSelectedForDisconnect(providerId);
    setShowDisconnectModal(true);
  };

  const confirmDisconnect = async () => {
    if (!selectedForDisconnect) return;

    setDisconnectingId(selectedForDisconnect);
    try {
      await dispatch(disconnectProvider(selectedForDisconnect)).unwrap();
      addToast('Provider disconnected successfully', 'success');
      setShowDisconnectModal(false);
      setSelectedForDisconnect(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to disconnect provider';
      addToast(message, 'error');
    } finally {
      setDisconnectingId(null);
    }
  };

  const handleSetCurrent = async (providerId: string) => {
    try {
      dispatch(setCurrentProviderId(providerId));
      dispatch(updateProviderLastAccessed(providerId));
      addToast('Provider set as current', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set current provider';
      addToast(message, 'error');
    }
  };

  const connectedProviders = providers.filter((p) => p.isConnected);
  const disconnectedProviders = providers.filter((p) => !p.isConnected);

  const currentProvider = providers.find((p) => p.id === currentProviderId);

  return (
    <div className="flex flex-col gap-8 p-8 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Storage Providers</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your storage provider connections
          </p>
        </div>
        <Button variant="primary" onClick={handleConnect} size="lg">
          + Connect Provider
        </Button>
      </div>

      {isLoading && providers.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="h-12 w-12 animate-spin text-primary-600 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-gray-600 dark:text-gray-400">Loading providers...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {connectedProviders.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Connected Providers
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {connectedProviders.map((provider) => (
                  <Card key={provider.id} isHoverable>
                    <CardBody className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">
                            {PROVIDER_ICONS[provider.type as StorageProviderType]}
                          </span>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {PROVIDER_NAMES[provider.type as StorageProviderType]}
                            </h3>
                            {currentProvider?.id === provider.id && (
                              <span className="inline-block mt-1 px-2 py-1 bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-100 text-xs rounded font-medium">
                                Active
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                        {provider.email && (
                          <p>
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              Email:
                            </span>{' '}
                            {provider.email}
                          </p>
                        )}
                        {provider.lastAccessed && (
                          <p>
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              Last accessed:
                            </span>{' '}
                            {new Date(provider.lastAccessed).toLocaleDateString()}
                          </p>
                        )}
                        {provider.expiresAt && (
                          <p>
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              Token expires:
                            </span>{' '}
                            {new Date(provider.expiresAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2 pt-2">
                        {currentProvider?.id !== provider.id && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleSetCurrent(provider.id)}
                            disabled={isLoading}
                          >
                            Set as Active
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDisconnect(provider.id)}
                          disabled={isLoading || disconnectingId === provider.id}
                          isLoading={disconnectingId === provider.id}
                        >
                          Disconnect
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {disconnectedProviders.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Available Providers
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {disconnectedProviders.map((provider) => (
                  <Card key={provider.id}>
                    <CardBody className="space-y-4 text-center">
                      <span className="text-4xl">
                        {PROVIDER_ICONS[provider.type as StorageProviderType]}
                      </span>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {PROVIDER_NAMES[provider.type as StorageProviderType]}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Not connected
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleConnect}
                        className="w-full"
                      >
                        Connect
                      </Button>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {providers.length === 0 && (
            <Card>
              <CardBody className="text-center py-12">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  No storage providers available
                </p>
                <Button variant="primary" onClick={handleConnect}>
                  Connect Your First Provider
                </Button>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      <ProviderConnectionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <Modal
        isOpen={showDisconnectModal}
        onClose={() => setShowDisconnectModal(false)}
        title="Disconnect Provider"
        size="sm"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setShowDisconnectModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDisconnect}
              isLoading={disconnectingId !== null}
              disabled={disconnectingId !== null}
            >
              Disconnect
            </Button>
          </div>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Are you sure you want to disconnect this storage provider? You will need to reconnect it
          to access your files.
        </p>
      </Modal>

      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 ${
              toast.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-900 dark:text-green-100 dark:border-green-800'
                : toast.type === 'error'
                  ? 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-900 dark:text-red-100 dark:border-red-800'
                  : 'bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-900 dark:text-blue-100 dark:border-blue-800'
            }`}
          >
            <span className="text-lg font-bold">
              {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
            </span>
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StorageProvidersPage;
