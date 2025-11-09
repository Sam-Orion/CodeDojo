import { useEffect, useState } from 'react';
import { useAppSelector } from '../store';

export const useAuth = () => {
  const auth = useAppSelector((state) => state.auth);
  return auth;
};

export const useLocalStorage = <T>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue] as const;
};

export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export const useWebSocket = () => {
  const [isConnected] = useState(false);

  useEffect(() => {
    // WebSocket connection will be handled by the WebSocketManager
    // This hook just provides connection status
    // const handleConnect = () => setIsConnected(true)
    // const handleDisconnect = () => setIsConnected(false)

    // These would be connected to the WebSocketManager events
    // wsManager.on('connect', handleConnect)
    // wsManager.on('disconnect', handleDisconnect)

    return () => {
      // wsManager.off('connect', handleConnect)
      // wsManager.off('disconnect', handleDisconnect)
    };
  }, []);

  return { isConnected };
};
