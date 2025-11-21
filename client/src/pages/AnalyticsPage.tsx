import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchConversations } from '../store/slices/aiSlice';
import ConversationAnalyticsDashboard from '../components/chat/ConversationAnalyticsDashboard';
import ConversationMetadataPanel from '../components/chat/ConversationMetadataPanel';
import Loader from '../components/ui/Loader';

const AnalyticsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { conversations, activeConversation, isLoading } = useAppSelector((state) => state.ai);

  useEffect(() => {
    dispatch(fetchConversations());
  }, [dispatch]);

  if (isLoading && conversations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader message="Loading analytics..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Conversation Analytics</h1>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
          Insights and statistics about your AI conversations
        </p>
      </div>

      <ConversationAnalyticsDashboard />

      {activeConversation && (
        <div>
          <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
            Active Conversation Details
          </h2>
          <ConversationMetadataPanel conversation={activeConversation} />
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
