interface AISuggestionsIndicatorProps {
  isLoading: boolean;
  error: string | null;
  suggestionsCount: number;
}

const AISuggestionsIndicator = ({
  isLoading,
  error,
  suggestionsCount,
}: AISuggestionsIndicatorProps) => {
  if (!isLoading && !error && suggestionsCount === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm text-white shadow-lg border border-gray-700">
      {isLoading && (
        <>
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-blue-500" />
          <span>Getting AI suggestions...</span>
        </>
      )}
      {error && !isLoading && (
        <>
          <svg
            className="h-4 w-4 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-red-400">{error}</span>
        </>
      )}
      {!isLoading && !error && suggestionsCount > 0 && (
        <>
          <svg
            className="h-4 w-4 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-green-400">{suggestionsCount} suggestions ready</span>
        </>
      )}
    </div>
  );
};

export default AISuggestionsIndicator;
