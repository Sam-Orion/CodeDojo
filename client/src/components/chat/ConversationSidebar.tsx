import React, { useState, useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  setActiveConversation,
  createConversation,
  fetchConversation,
  renameConversation,
  deleteConversation,
  toggleFavoriteConversation,
} from '../../store/slices/aiSlice';
import type { AIConversation } from '../../types';
import Button from '../ui/Button';

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

const PlusIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" {...props}>
    <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
    <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
  </svg>
);

const StarIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const TrashIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" {...props}>
    <path d="M4 6h16" strokeLinecap="round" />
    <path d="M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6" />
    <path d="M18 6v12.5A1.5 1.5 0 0 1 16.5 20h-9A1.5 1.5 0 0 1 6 18.5V6" />
    <path d="M10 10v6" strokeLinecap="round" />
    <path d="M14 10v6" strokeLinecap="round" />
  </svg>
);

const SearchIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" {...props}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" strokeLinecap="round" />
  </svg>
);

const SpinnerIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    className={cn('animate-spin', className)}
    {...props}
  >
    <path d="M12 3a9 9 0 1 1-9 9" strokeWidth={2} strokeLinecap="round" opacity={0.25} />
    <path d="M21 12a9 9 0 0 0-9-9" strokeWidth={2} strokeLinecap="round" />
  </svg>
);

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{message}</p>
        <div className="mt-6 flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={isLoading}>
            {isLoading && <SpinnerIcon className="mr-2 h-4 w-4" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

interface ConversationListItemProps {
  conversation: AIConversation;
  isActive: boolean;
  onSelect: (conv: AIConversation) => void;
  onDelete: (convId: string) => void;
  onToggleFavorite: (conv: AIConversation) => void;
}

const ConversationListItem: React.FC<ConversationListItemProps> = ({
  conversation,
  isActive,
  onSelect,
  onDelete,
  onToggleFavorite,
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(
    conversation.title || getConversationTitle(conversation)
  );
  const dispatch = useAppDispatch();

  const handleRenameSave = useCallback(() => {
    if (newTitle.trim()) {
      dispatch(renameConversation({ conversationId: conversation.id, title: newTitle.trim() }))
        .unwrap()
        .then(() => {
          setIsRenaming(false);
        })
        .catch(() => {
          // Error is handled by Redux
          setIsRenaming(false);
        });
    }
  }, [newTitle, conversation.id, dispatch]);

  const handleRenameCancel = useCallback(() => {
    setNewTitle(conversation.title || getConversationTitle(conversation));
    setIsRenaming(false);
  }, [conversation]);

  const messageCount = conversation.messages.length;
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  const lastModified = new Date(conversation.updatedAt);
  const formattedDate = formatDate(lastModified);

  return (
    <div
      className={cn(
        'group flex flex-col gap-2 rounded-lg border px-3 py-2 transition-all hover:bg-gray-50 dark:hover:bg-gray-800',
        isActive
          ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-500/20'
          : 'border-gray-200 dark:border-gray-700'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => onSelect(conversation)}
          className={cn(
            'flex-1 flex-col items-start gap-1 overflow-hidden text-left transition-colors hover:text-primary-600 dark:hover:text-primary-300',
            isActive ? 'text-primary-700 dark:text-primary-200' : 'text-gray-900 dark:text-gray-100'
          )}
        >
          <div className="flex items-center gap-2 w-full">
            {isRenaming ? (
              <input
                autoFocus
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onBlur={handleRenameSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSave();
                  if (e.key === 'Escape') handleRenameCancel();
                }}
                className="flex-1 rounded border border-primary-400 bg-white px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span className="font-medium truncate text-sm">
                  {conversation.title || getConversationTitle(conversation)}
                </span>
                {conversation.isFavorite && (
                  <StarIcon className="h-3 w-3 flex-shrink-0 text-amber-400" />
                )}
              </>
            )}
          </div>
          <span className="truncate text-xs text-gray-500 dark:text-gray-400">
            {lastMessage?.content.substring(0, 50) || 'No messages yet'}
            {lastMessage && lastMessage.content.length > 50 ? '...' : ''}
          </span>
        </button>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onToggleFavorite(conversation)}
            className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title={conversation.isFavorite ? 'Unpin from favorites' : 'Pin to favorites'}
          >
            <StarIcon
              className={cn(
                'h-4 w-4',
                conversation.isFavorite
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-gray-400 dark:text-gray-500'
              )}
            />
          </button>
          <button
            onClick={() => setIsRenaming(true)}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
            title="Rename conversation"
          >
            ✎
          </button>
          <button
            onClick={() => onDelete(conversation.id)}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-600 hover:bg-red-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            title="Delete conversation"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          {messageCount} message{messageCount !== 1 ? 's' : ''}
        </span>
        <span>{formattedDate}</span>
      </div>
    </div>
  );
};

const getConversationTitle = (conversation: AIConversation): string => {
  if (conversation.title) return conversation.title;
  const firstUserMessage = conversation.messages.find((m) => m.role === 'user');
  if (firstUserMessage) {
    const preview = firstUserMessage.content.substring(0, 50);
    return preview.length >= 50 ? preview + '...' : preview;
  }
  return 'Untitled Conversation';
};

const formatDate = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

interface ConversationSidebarProps {
  className?: string;
}

const ConversationSidebar: React.FC<ConversationSidebarProps> = ({ className }) => {
  const dispatch = useAppDispatch();
  const { conversations, activeConversation, isLoading } = useAppSelector((state) => state.ai);

  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    conversationId: string | null;
  }>({
    isOpen: false,
    conversationId: null,
  });

  const handleCreateConversation = useCallback(() => {
    dispatch(createConversation());
  }, [dispatch]);

  const handleSelectConversation = useCallback(
    (conversation: AIConversation) => {
      dispatch(setActiveConversation(conversation));
      dispatch(fetchConversation(conversation.id));
    },
    [dispatch]
  );

  const handleDeleteConversation = useCallback((conversationId: string) => {
    setDeleteConfirm({ isOpen: true, conversationId });
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (deleteConfirm.conversationId) {
      dispatch(deleteConversation(deleteConfirm.conversationId))
        .unwrap()
        .then(() => {
          setDeleteConfirm({ isOpen: false, conversationId: null });
        })
        .catch(() => {
          // Error is handled by Redux
          setDeleteConfirm({ isOpen: false, conversationId: null });
        });
    }
  }, [deleteConfirm.conversationId, dispatch]);

  const handleToggleFavorite = useCallback(
    (conversation: AIConversation) => {
      dispatch(
        toggleFavoriteConversation({
          conversationId: conversation.id,
          isFavorite: !conversation.isFavorite,
        })
      );
    },
    [dispatch]
  );

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;

    const query = searchQuery.toLowerCase();
    return conversations.filter((conv) => {
      const title = conv.title || getConversationTitle(conv);
      return title.toLowerCase().includes(query);
    });
  }, [conversations, searchQuery]);

  const favoriteConversations = useMemo(
    () => filteredConversations.filter((c) => c.isFavorite),
    [filteredConversations]
  );

  const regularConversations = useMemo(
    () => filteredConversations.filter((c) => !c.isFavorite),
    [filteredConversations]
  );

  return (
    <div className={cn('flex h-full flex-col bg-gray-50 dark:bg-gray-900', className)}>
      <div className="border-b border-gray-200 p-4 dark:border-gray-800">
        <Button className="w-full" onClick={handleCreateConversation} disabled={isLoading}>
          <PlusIcon className="mr-2 h-4 w-4" />
          New Conversation
        </Button>
      </div>

      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <SpinnerIcon className="h-5 w-5 text-primary-500" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading conversations...</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center px-4">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No conversations</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {searchQuery ? 'Try adjusting your search' : 'Start a new conversation'}
            </p>
          </div>
        ) : (
          <div className="space-y-2 p-3">
            {favoriteConversations.length > 0 && (
              <>
                <p className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Favorites
                </p>
                <div className="space-y-2 pb-3">
                  {favoriteConversations.map((conv) => (
                    <ConversationListItem
                      key={conv.id}
                      conversation={conv}
                      isActive={activeConversation?.id === conv.id}
                      onSelect={handleSelectConversation}
                      onDelete={handleDeleteConversation}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))}
                </div>
                <p className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  All Conversations
                </p>
              </>
            )}
            <div className="space-y-2">
              {regularConversations.map((conv) => (
                <ConversationListItem
                  key={conv.id}
                  conversation={conv}
                  isActive={activeConversation?.id === conv.id}
                  onSelect={handleSelectConversation}
                  onDelete={handleDeleteConversation}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Delete conversation?"
        message="This action cannot be undone. The conversation and all its messages will be permanently deleted."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, conversationId: null })}
      />
    </div>
  );
};

export default ConversationSidebar;
