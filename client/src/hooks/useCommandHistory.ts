import { useCallback } from 'react';
import commandHistory from '../utils/commandHistory';

export const useCommandHistory = () => {
  const addToHistory = useCallback((command: string, language?: string) => {
    commandHistory.add(command, language);
  }, []);

  const getPrevious = useCallback(() => {
    return commandHistory.getPrevious();
  }, []);

  const getNext = useCallback(() => {
    return commandHistory.getNext();
  }, []);

  const resetIndex = useCallback(() => {
    commandHistory.resetIndex();
  }, []);

  const getAllHistory = useCallback((limit?: number) => {
    return commandHistory.getAll(limit);
  }, []);

  const searchHistory = useCallback((query: string, limit = 10) => {
    return commandHistory.search(query, limit);
  }, []);

  const clearHistory = useCallback(() => {
    commandHistory.clear();
  }, []);

  return {
    addToHistory,
    getPrevious,
    getNext,
    resetIndex,
    getAllHistory,
    searchHistory,
    clearHistory,
  };
};
