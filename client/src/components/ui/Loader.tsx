import { ReactNode } from 'react';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  fullscreen?: boolean;
  message?: string;
}

const Loader = ({ size = 'md', fullscreen = false, message = 'Loading...' }: LoaderProps) => {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-4',
    lg: 'h-12 w-12 border-4',
  };

  const loader = (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`animate-spin rounded-full border-primary-600 border-t-transparent ${sizeClasses[size]}`}
      />
      {message && <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
        {loader}
      </div>
    );
  }

  return loader;
};

interface LoadingOverlayProps {
  isLoading: boolean;
  children: ReactNode;
}

export const LoadingOverlay = ({ isLoading, children }: LoadingOverlayProps) => {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm z-40">
          <Loader size="md" />
        </div>
      )}
    </div>
  );
};

export default Loader;
