import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../store';
import { connectProvider } from '../store/slices/storageProviderSlice';

const OAuthCallback = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (errorParam) {
          setError(errorDescription || errorParam);
          setIsProcessing(false);
          setTimeout(() => navigate('/storage-providers'), 3000);
          return;
        }

        if (!code) {
          setError('No authorization code received');
          setIsProcessing(false);
          setTimeout(() => navigate('/storage-providers'), 3000);
          return;
        }

        let providerType = 'google_drive';
        if (state) {
          try {
            const decodedState = JSON.parse(atob(state));
            providerType = decodedState.provider || 'google_drive';
          } catch {
            console.warn('Failed to parse state parameter');
          }
        }

        await dispatch(connectProvider({ type: providerType, code })).unwrap();

        setIsProcessing(false);
        navigate('/storage-providers');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to connect provider';
        setError(message);
        setIsProcessing(false);
        setTimeout(() => navigate('/storage-providers'), 3000);
      }
    };

    processCallback();
  }, [dispatch, navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center">
        {isProcessing ? (
          <>
            <div className="inline-block">
              <svg
                className="h-12 w-12 animate-spin text-primary-600"
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
            </div>
            <p className="mt-4 text-gray-700 dark:text-gray-300 font-medium">
              Connecting your storage provider...
            </p>
          </>
        ) : error ? (
          <>
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">
              Connection Failed
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">Redirecting you back...</p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-4">✓</div>
            <h1 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
              Successfully Connected!
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Your storage provider has been connected. Redirecting you back...
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default OAuthCallback;
