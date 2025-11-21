import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  setActiveConversation,
  createConversation,
  fetchConversation,
  fetchConversations,
  renameConversation,
  deleteConversation,
  toggleFavoriteConversation,
  updateConversationStatus,
  clearConversationCache,
} from '../../store/slices/aiSlice';
import type { AIConversation } from '../../types';
import Button from '../ui/Button';
import { getConversationMetadata } from '../../utils/conversationAnalytics';

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

const ArchiveIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor" {...props}>
    <rect x="3" y="4" width="18" height="5" rx="1" />
    <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" />
    <path d="M9 13h6" strokeLinecap="round" />
  </svg>
);

const InboxIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path d="M3 13h5l2 3h4l2-3h5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 5h14l2 8-2 6H5l-2-6z" />
  </svg>
);

const RestoreIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path d="M21 12a9 9 0 1 1-9-9" strokeLinecap="round" />
    <path d="M21 3v9h-9" strokeLinecap="round" strokeLinejoin="round" />
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
  view: ConversationTab;
  isBulkMode: boolean;
  isSelected: boolean;
  onSelect: (conv: AIConversation) => void;
  onToggleSelection: (conversationId: string) => void;
  onArchiveToggle: (conversation: AIConversation) => void;
  onDelete: (conversationId: string) => void;
  onHardDelete: (conversationId: string) => void;
  onRestore: (conversationId: string) => void;
  onToggleFavorite: (conv: AIConversation) => void;
}

const ConversationListItem: React.FC<ConversationListItemProps> = ({
  conversation,
  isActive,
  view,
  isBulkMode,
  isSelected,
  onSelect,
  onToggleSelection,
  onArchiveToggle,
  onDelete,
  onHardDelete,
  onRestore,
  onToggleFavorite,
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(
    conversation.title || getConversationTitle(conversation)
  );
  const dispatch = useAppDispatch();

  const handleRenameSave = useCallback(() => {
    if (newTitle.trim() && newTitle.trim() !== conversation.title) {
      dispatch(renameConversation({ conversationId: conversation.id, title: newTitle.trim() }))
        .unwrap()
        .then(() => setIsRenaming(false))
        .catch(() => setIsRenaming(false));
    } else {
      setIsRenaming(false);
    }
  }, [dispatch, conversation.id, conversation.title, newTitle]);

  const handleRenameCancel = useCallback(() => {
    setNewTitle(conversation.title || getConversationTitle(conversation));
    setIsRenaming(false);
  }, [conversation]);

  const metadata = useMemo(() => getConversationMetadata(conversation), [conversation]);
  const messageCount = metadata.messageCount;
  const updatedDate = metadata.lastModified ? new Date(metadata.lastModified) : null;
  const formattedUpdated =
    updatedDate && !Number.isNaN(updatedDate.getTime()) ? formatDate(updatedDate) : 'now';
  const archivedDate = conversation.archivedAt
    ? formatDate(new Date(conversation.archivedAt))
    : null;
  const deletedDate = conversation.deletedAt ? formatDate(new Date(conversation.deletedAt)) : null;

  const showFavorite = view !== 'deleted';

  return (
    <div
      className={cn(
        'group flex flex-col gap-2 rounded-lg border px-3 py-2 transition-all hover:bg-gray-50 dark:hover:bg-gray-800',
        isActive
          ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-500/20'
          : 'border-gray-200 dark:border-gray-700'
      )}
    >
      <div className="flex items-start gap-3">
        {isBulkMode && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(conversation.id)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
        )}
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
                {conversation.isFavorite && showFavorite && (
                  <StarIcon className="h-3 w-3 flex-shrink-0 text-amber-400" />
                )}
              </>
            )}
          </div>
          <span className="truncate text-xs text-gray-500 dark:text-gray-400">
            {conversation.messages[conversation.messages.length - 1]?.content.substring(0, 50) ||
              'No messages yet'}
            {conversation.messages[conversation.messages.length - 1]?.content.length > 50
              ? '...'
              : ''}
          </span>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
            <span>
              {messageCount} message{messageCount !== 1 ? 's' : ''}
            </span>
            <span>• Updated {formattedUpdated}</span>
            {view === 'archived' && archivedDate && <span>• Archived {archivedDate}</span>}
            {view === 'deleted' && deletedDate && <span>• Deleted {deletedDate}</span>}
          </div>
        </button>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {showFavorite && (
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
          )}
          {view !== 'deleted' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsRenaming(true);
              }}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
              title="Rename conversation"
            >
              ✎
            </button>
          )}
          {view === 'active' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onArchiveToggle(conversation);
              }}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
              title="Archive conversation"
            >
              <ArchiveIcon className="h-4 w-4" />
            </button>
          )}
          {view === 'archived' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onArchiveToggle(conversation);
              }}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
              title="Unarchive conversation"
            >
              <InboxIcon className="h-4 w-4" />
            </button>
          )}
          {view === 'deleted' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRestore(conversation.id);
              }}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-600 hover:bg-green-100 hover:text-green-600 dark:text-gray-400 dark:hover:bg-green-900/30 dark:hover:text-green-400"
              title="Restore conversation"
            >
              <RestoreIcon className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (view === 'deleted') {
                onHardDelete(conversation.id);
              } else {
                onDelete(conversation.id);
              }
            }}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-600 hover:bg-red-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            title={view === 'deleted' ? 'Delete permanently' : 'Delete conversation'}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

type ConversationTab = 'active' | 'archived' | 'deleted';
type ConversationActionType = 'archive' | 'unarchive' | 'delete' | 'restore' | 'hardDelete';

interface ConversationSidebarProps {
  className?: string;
}

const TAB_LABELS: Record<ConversationTab, string> = {
  active: 'Active',
  archived: 'Archived',
  deleted: 'Deleted',
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

const formatRelativeTime = (timestamp?: number | null) => {
  if (!timestamp) return 'Never';
  const diffMs = Date.now() - timestamp;
  if (diffMs < 60000) return 'Just now';
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
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

const ConversationSidebar: React.FC<ConversationSidebarProps> = ({ className }) => {
  const dispatch = useAppDispatch();
  const {
    conversations,
    archivedConversations,
    deletedConversations,
    activeConversation,
    isLoading,
    cacheLastCleanup,
  } = useAppSelector((state) => state.ai);

  const [activeTab, setActiveTab] = useState<ConversationTab>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<{
    type: ConversationActionType;
    ids: string[];
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [loadedTabs, setLoadedTabs] = useState<Record<ConversationTab, boolean>>({
    active: false,
    archived: false,
    deleted: false,
  });

  const conversationsByTab = useMemo(
    () => ({
      active: conversations,
      archived: archivedConversations,
      deleted: deletedConversations,
    }),
    [conversations, archivedConversations, deletedConversations]
  );

  useEffect(() => {
    if (!loadedTabs[activeTab]) {
      dispatch(fetchConversations(activeTab))
        .unwrap()
        .catch(() => undefined)
        .finally(() =>
          setLoadedTabs((prev) => ({
            ...prev,
            [activeTab]: true,
          }))
        );
    }
  }, [activeTab, loadedTabs, dispatch]);

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) =>
        conversationsByTab[activeTab].some((conversation) => conversation.id === id)
      )
    );
  }, [activeTab, conversationsByTab]);

  const filteredConversations = useMemo(() => {
    const list = conversationsByTab[activeTab] || [];
    if (!searchQuery.trim()) return list;
    const query = searchQuery.toLowerCase();
    return list.filter((conv) => {
      const title = conv.title || getConversationTitle(conv);
      return title.toLowerCase().includes(query);
    });
  }, [conversationsByTab, activeTab, searchQuery]);

  const favoriteConversations = useMemo(() => {
    if (activeTab !== 'active') return [];
    return filteredConversations.filter((c) => c.isFavorite);
  }, [filteredConversations, activeTab]);

  const regularConversations = useMemo(() => {
    if (activeTab !== 'active') {
      return filteredConversations;
    }
    return filteredConversations.filter((c) => !c.isFavorite);
  }, [filteredConversations, activeTab]);

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

  const handleToggleSelection = useCallback((conversationId: string) => {
    setSelectedIds((current) =>
      current.includes(conversationId)
        ? current.filter((id) => id !== conversationId)
        : [...current, conversationId]
    );
  }, []);

  const handleTabChange = useCallback((tab: ConversationTab) => {
    setActiveTab(tab);
    setSelectedIds([]);
    setIsBulkMode(false);
  }, []);

  const handleClearCache = useCallback(() => {
    dispatch(clearConversationCache());
    setLoadedTabs({ active: false, archived: false, deleted: false });
    setSelectedIds([]);
    setIsBulkMode(false);
    dispatch(fetchConversations(activeTab));
  }, [dispatch, activeTab]);

  const startAction = useCallback((type: ConversationActionType, ids: string[]) => {
    if (ids.length === 0) return;
    setPendingAction({ type, ids });
  }, []);

  const handleConfirmAction = useCallback(async () => {
    if (!pendingAction) return;
    setActionLoading(true);
    try {
      if (pendingAction.type === 'archive') {
        await Promise.all(
          pendingAction.ids.map((id) =>
            dispatch(updateConversationStatus({ conversationId: id, status: 'archived' })).unwrap()
          )
        );
      } else if (pendingAction.type === 'unarchive' || pendingAction.type === 'restore') {
        await Promise.all(
          pendingAction.ids.map((id) =>
            dispatch(updateConversationStatus({ conversationId: id, status: 'active' })).unwrap()
          )
        );
      } else if (pendingAction.type === 'delete') {
        await Promise.all(
          pendingAction.ids.map((id) =>
            dispatch(deleteConversation({ conversationId: id })).unwrap()
          )
        );
      } else if (pendingAction.type === 'hardDelete') {
        await Promise.all(
          pendingAction.ids.map((id) =>
            dispatch(deleteConversation({ conversationId: id, force: true })).unwrap()
          )
        );
      }
    } catch (error) {
      console.error('Bulk action failed', error);
    } finally {
      setActionLoading(false);
      setPendingAction(null);
      setSelectedIds([]);
      if (pendingAction.ids.length > 1) {
        setIsBulkMode(false);
      }
    }
  }, [pendingAction, dispatch]);

  const bulkSelectionCount = selectedIds.length;
  const bulkActionsAvailable = isBulkMode && bulkSelectionCount > 0;

  const handleSingleDelete = useCallback(
    (conversationId: string) => {
      startAction('delete', [conversationId]);
    },
    [startAction]
  );

  const handleSingleArchiveToggle = useCallback(
    (conversation: AIConversation) => {
      if (conversation.status === 'archived') {
        startAction('unarchive', [conversation.id]);
      } else {
        startAction('archive', [conversation.id]);
      }
    },
    [startAction]
  );

  const handleSingleRestore = useCallback(
    (conversationId: string) => {
      startAction('restore', [conversationId]);
    },
    [startAction]
  );

  const handleSingleHardDelete = useCallback(
    (conversationId: string) => {
      startAction('hardDelete', [conversationId]);
    },
    [startAction]
  );

  const placeholderByTab: Record<ConversationTab, string> = {
    active: 'Search conversations...',
    archived: 'Search archived conversations...',
    deleted: 'Search deleted conversations...',
  };

  const confirmCopy: Record<
    ConversationActionType,
    { title: string; message: string; confirm?: string }
  > = {
    archive: {
      title: 'Archive conversation?',
      message: 'Archived conversations move out of your main list and can be restored at any time.',
      confirm: 'Archive',
    },
    unarchive: {
      title: 'Unarchive conversation?',
      message: 'This conversation will return to your active list.',
      confirm: 'Unarchive',
    },
    delete: {
      title: 'Delete conversation?',
      message: 'Deleted conversations move to the trash where they can be restored later.',
      confirm: 'Delete',
    },
    restore: {
      title: 'Restore conversation?',
      message: 'The conversation will move back to your active list.',
      confirm: 'Restore',
    },
    hardDelete: {
      title: 'Permanently delete conversation?',
      message: 'This action cannot be undone. The conversation will be removed forever.',
      confirm: 'Delete permanently',
    },
  };

  const currentConfirm = pendingAction ? confirmCopy[pendingAction.type] : null;

  const cacheInfo = formatRelativeTime(cacheLastCleanup);

  const bulkActionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      {activeTab === 'active' && (
        <>
          <Button size="sm" variant="secondary" onClick={() => startAction('archive', selectedIds)}>
            Archive selected
          </Button>
          <Button size="sm" variant="danger" onClick={() => startAction('delete', selectedIds)}>
            Delete selected
          </Button>
        </>
      )}
      {activeTab === 'archived' && (
        <>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => startAction('unarchive', selectedIds)}
          >
            Unarchive selected
          </Button>
          <Button size="sm" variant="danger" onClick={() => startAction('delete', selectedIds)}>
            Delete selected
          </Button>
        </>
      )}
      {activeTab === 'deleted' && (
        <>
          <Button size="sm" variant="secondary" onClick={() => startAction('restore', selectedIds)}>
            Restore selected
          </Button>
          <Button size="sm" variant="danger" onClick={() => startAction('hardDelete', selectedIds)}>
            Delete permanently
          </Button>
        </>
      )}
      <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
        Clear selection
      </Button>
    </div>
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {(Object.keys(TAB_LABELS) as ConversationTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition',
                  activeTab === tab
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-200'
                    : 'text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800'
                )}
              >
                {TAB_LABELS[tab]} {tab === 'deleted' && `(${deletedConversations.length})`}
              </button>
            ))}
          </div>
          <button
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            onClick={() =>
              setIsBulkMode((prev) => {
                if (prev) setSelectedIds([]);
                return !prev;
              })
            }
          >
            {isBulkMode ? 'Exit bulk select' : 'Select multiple'}
          </button>
        </div>
        <div className="mt-3 relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={placeholderByTab[activeTab]}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
          />
        </div>
      </div>

      {bulkActionsAvailable && (
        <div className="border-b border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-700 dark:border-primary-400/40 dark:bg-primary-500/10 dark:text-primary-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {bulkSelectionCount} conversation{bulkSelectionCount === 1 ? '' : 's'} selected
            </span>
            {bulkActionButtons}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading && filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <SpinnerIcon className="h-5 w-5 text-primary-500" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading conversations...</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center px-4">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No conversations</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {searchQuery
                ? 'Try adjusting your search'
                : activeTab === 'archived'
                  ? 'Archive conversations to manage them here'
                  : activeTab === 'deleted'
                    ? 'Deleted conversations will show up here'
                    : 'Start a new conversation'}
            </p>
          </div>
        ) : (
          <div className="space-y-2 p-3">
            {activeTab === 'active' && favoriteConversations.length > 0 && (
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
                      view={activeTab}
                      isBulkMode={isBulkMode}
                      isSelected={selectedIds.includes(conv.id)}
                      onSelect={handleSelectConversation}
                      onToggleSelection={handleToggleSelection}
                      onArchiveToggle={handleSingleArchiveToggle}
                      onDelete={handleSingleDelete}
                      onHardDelete={handleSingleHardDelete}
                      onRestore={handleSingleRestore}
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
              {(activeTab === 'active' ? regularConversations : filteredConversations).map(
                (conv) => (
                  <ConversationListItem
                    key={conv.id}
                    conversation={conv}
                    isActive={activeConversation?.id === conv.id}
                    view={activeTab}
                    isBulkMode={isBulkMode}
                    isSelected={selectedIds.includes(conv.id)}
                    onSelect={handleSelectConversation}
                    onToggleSelection={handleToggleSelection}
                    onArchiveToggle={handleSingleArchiveToggle}
                    onDelete={handleSingleDelete}
                    onHardDelete={handleSingleHardDelete}
                    onRestore={handleSingleRestore}
                    onToggleFavorite={handleToggleFavorite}
                  />
                )
              )}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 px-4 py-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-600 dark:text-gray-300">Cache</p>
            <p>Last cleaned: {cacheInfo}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClearCache}>
            Clear cache
          </Button>
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(pendingAction)}
        title={currentConfirm?.title || ''}
        message={currentConfirm?.message || ''}
        confirmLabel={currentConfirm?.confirm}
        onConfirm={handleConfirmAction}
        onCancel={() => setPendingAction(null)}
        isLoading={actionLoading}
      />
    </div>
  );
};

export default ConversationSidebar;
