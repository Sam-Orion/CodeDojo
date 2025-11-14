import { useState } from 'react';
import ChatInput from '../components/chat/ChatInput';

const ChatInputDemoPage = () => {
  const [messages, setMessages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (message: string) => {
    setMessages((prev) => [...prev, message]);

    // Simulate loading state
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 2000);
  };

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          ChatInput Component Demo
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Test the ChatInput component with various states and interactions
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Demo Section */}
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Interactive Demo
            </h2>
            <ChatInput onSubmit={handleSubmit} isLoading={isLoading} />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Disabled State
            </h2>
            <ChatInput onSubmit={() => {}} disabled={true} />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Loading State
            </h2>
            <ChatInput onSubmit={() => {}} isLoading={true} />
          </div>
        </div>

        {/* Messages Display */}
        <div className="flex flex-col gap-4">
          <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Submitted Messages ({messages.length})
            </h2>
            <div className="flex-1 space-y-2 overflow-auto">
              {messages.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No messages submitted yet. Try typing a message and clicking Send!
                </p>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      Message #{index + 1}
                    </div>
                    <div className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">
                      {message}
                    </div>
                  </div>
                ))
              )}
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="mt-4 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Clear Messages
              </button>
            )}
          </div>

          {/* Features List */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Features</h2>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Multi-line textarea input</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Submit button with loading state</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Clear button to empty input</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Character counter (display only)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Enter key to submit</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Shift+Enter for newline</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Auto-resize textarea</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Disabled state support</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Dark mode styling</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInputDemoPage;
