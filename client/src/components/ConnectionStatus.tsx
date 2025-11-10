import { useEffect, useState, useMemo } from 'react';
import { useAppSelector } from '../store';

const ConnectionStatus = () => {
  const { connectionStatus } = useAppSelector((state) => state.collaboration);
  const [dotCount, setDotCount] = useState(0);

  const displayText = useMemo(() => {
    const statusMap: Record<string, string> = {
      idle: 'Idle',
      connecting: 'Connecting',
      connected: 'Connected',
      disconnected: 'Disconnected',
      error: 'Error',
    };
    return statusMap[connectionStatus] || 'Unknown';
  }, [connectionStatus]);

  useEffect(() => {
    if (connectionStatus === 'connecting') {
      const interval = setInterval(() => {
        setDotCount((prev) => (prev + 1) % 4);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [connectionStatus]);

  const getStatusColor = (): string => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'disconnected':
        return 'bg-red-500';
      case 'error':
        return 'bg-red-600';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusTextColor = (): string => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-600 dark:text-green-400';
      case 'connecting':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'disconnected':
        return 'text-red-600 dark:text-red-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded bg-gray-100 dark:bg-gray-800">
      <div
        className={`h-2 w-2 rounded-full ${getStatusColor()} ${
          connectionStatus === 'connecting' ? 'animate-pulse' : ''
        }`}
      />
      <span className={`text-xs font-medium ${getStatusTextColor()}`}>
        {displayText}
        {connectionStatus === 'connecting' && '.'.repeat(dotCount)}
      </span>
    </div>
  );
};

export default ConnectionStatus;
