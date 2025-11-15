import { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  AICodeSuggestion,
  AICompletionContext,
  AICompletionRequest,
  AISuggestionTelemetry,
} from '../types';
import { useAppSelector } from '../store';

interface UseAICodeSuggestionsOptions {
  maxSuggestions?: number;
  temperature?: number;
  minConfidence?: number;
  debounceMs?: number;
}

interface UseAICodeSuggestionsReturn {
  suggestions: AICodeSuggestion[];
  isLoading: boolean;
  error: string | null;
  requestSuggestions: (context: AICompletionContext) => Promise<void>;
  clearSuggestions: () => void;
  trackSuggestion: (
    suggestionId: string,
    action: 'accepted' | 'rejected' | 'dismissed' | 'shown'
  ) => void;
}

export const useAICodeSuggestions = (
  options: UseAICodeSuggestionsOptions = {}
): UseAICodeSuggestionsReturn => {
  const { maxSuggestions = 5, temperature = 0.3, minConfidence = 0.5, debounceMs = 300 } = options;

  const [suggestions, setSuggestions] = useState<AICodeSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const telemetryQueueRef = useRef<AISuggestionTelemetry[]>([]);

  const token = useAppSelector((state) => state.auth.token);
  const userId = useAppSelector((state) => state.auth.user?.id);

  const sendTelemetry = useCallback(
    async (telemetry: AISuggestionTelemetry) => {
      try {
        await axios.post('/api/v1/ai/suggestions/telemetry', telemetry, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (err) {
        console.error('Failed to send telemetry:', err);
      }
    },
    [token]
  );

  const trackSuggestion = useCallback(
    (suggestionId: string, action: 'accepted' | 'rejected' | 'dismissed' | 'shown') => {
      if (!requestIdRef.current) return;

      const telemetry: AISuggestionTelemetry = {
        requestId: requestIdRef.current,
        suggestionId,
        action,
        timestamp: Date.now(),
      };

      telemetryQueueRef.current.push(telemetry);
      sendTelemetry(telemetry);
    },
    [sendTelemetry]
  );

  const requestSuggestions = useCallback(
    async (context: AICompletionContext): Promise<AICodeSuggestion[]> => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      return new Promise((resolve, reject) => {
        debounceTimerRef.current = setTimeout(async () => {
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }

          abortControllerRef.current = new AbortController();
          setIsLoading(true);
          setError(null);

          try {
            const requestPayload: AICompletionRequest = {
              context,
              maxSuggestions,
              temperature,
            };

            const response = await axios.post(
              '/api/v1/ai/suggestions',
              {
                ...requestPayload,
                userId,
                sessionId: `editor-${Date.now()}`,
              },
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                signal: abortControllerRef.current.signal,
                timeout: 10000,
              }
            );

            if (response.data.success) {
              const filteredSuggestions = (response.data.data.suggestions || []).filter(
                (s: AICodeSuggestion) => s.confidence >= minConfidence
              );

              setSuggestions(filteredSuggestions);
              requestIdRef.current = response.data.data.requestId;

              filteredSuggestions.forEach((suggestion: AICodeSuggestion) => {
                trackSuggestion(suggestion.id, 'shown');
              });

              resolve(filteredSuggestions);
            } else {
              const error = response.data.error || 'Failed to get suggestions';
              setError(error);
              setSuggestions([]);
              reject(new Error(error));
            }
          } catch (err: any) {
            if (axios.isCancel(err) || err.name === 'CanceledError') {
              resolve([]);
              return;
            }

            const errorMessage =
              err.response?.data?.error || err.message || 'Failed to fetch AI suggestions';
            setError(errorMessage);
            setSuggestions([]);
            reject(new Error(errorMessage));
          } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
          }
        }, debounceMs);
      });
    },
    [maxSuggestions, temperature, minConfidence, token, userId, debounceMs, trackSuggestion]
  );

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setError(null);
    requestIdRef.current = null;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    requestSuggestions,
    clearSuggestions,
    trackSuggestion,
  };
};
