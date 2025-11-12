import {
  KeyboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  addOpenFile,
  fetchFileSystem,
  readFile,
  setCurrentFile,
  deleteFile,
  renameFile,
  copyFile,
  downloadFile,
} from '../../store/slices/filesSlice';
import { addToast } from '../../store/slices/toastSlice';
import { FileNode, StorageProvider } from '../../types';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { LoadingOverlay } from '../ui/Loader';
import ContextMenu, { ContextMenuAction } from './ContextMenu';
import ConfirmModal from './ConfirmModal';
import { copyToClipboard } from '../../utils/clipboard';

interface FileTreeProps {
  onFileOpen?: (file: FileNode, content: string) => void;
}

interface VisibleNode {
  node: FileNode;
  depth: number;
  parentPath: string | null;
  isExpanded: boolean;
}

const providerStyles: Record<
  StorageProvider['type'],
  { label: string; icon: string; bg: string; text: string }
> = {
  google_drive: {
    label: 'Google Drive',
    icon: '🟢',
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
    text: 'text-emerald-700 dark:text-emerald-200',
  },
  onedrive: {
    label: 'Microsoft OneDrive',
    icon: '🔷',
    bg: 'bg-sky-100 dark:bg-sky-900/40',
    text: 'text-sky-700 dark:text-sky-200',
  },
  local: {
    label: 'Local Storage',
    icon: '💾',
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    text: 'text-amber-700 dark:text-amber-200',
  },
};

const formatFileSize = (size?: number) => {
  if (size === undefined || size === null) {
    return '—';
  }

  if (size === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.floor(Math.log(size) / Math.log(1024));
  const sized = size / Math.pow(1024, index);
  return `${sized >= 10 ? sized.toFixed(0) : sized.toFixed(1)} ${units[index]}`;
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleString();
};

const sortNodes = (nodes: FileNode[]) => {
  return [...nodes].sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    }

    return a.type === 'directory' ? -1 : 1;
  });
};

const getParentPath = (path: string, rootPath?: string | null) => {
  if (!rootPath) {
    return null;
  }

  if (path === rootPath) {
    return null;
  }

  const normalized = path.replace(/\/+$/, '');
  const segments = normalized.split('/');
  segments.pop();

  if (segments.length === 0) {
    return rootPath;
  }

  const parent = segments.join('/');
  return parent || rootPath;
};

const cloneWithFilteredChildren = (node: FileNode, children: FileNode[]) => ({
  ...node,
  children,
});

const filterTree = (node: FileNode, term: string): FileNode | null => {
  const lowerTerm = term.toLowerCase();
  const matches = node.name.toLowerCase().includes(lowerTerm);

  if (node.type === 'directory') {
    const filteredChildren = (node.children || [])
      .map((child) => filterTree(child, term))
      .filter((child): child is FileNode => Boolean(child));

    if (matches || filteredChildren.length > 0) {
      return cloneWithFilteredChildren(node, filteredChildren);
    }

    return null;
  }

  if (matches) {
    return { ...node };
  }

  return null;
};

const findPathToNode = (node: FileNode, targetPath: string): FileNode[] | null => {
  if (node.path === targetPath) {
    return [node];
  }

  for (const child of node.children || []) {
    const result = findPathToNode(child, targetPath);
    if (result) {
      return [node, ...result];
    }
  }

  return null;
};

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={`h-4 w-4 transform text-gray-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden
  >
    <path
      fillRule="evenodd"
      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

const FolderIcon = ({ open }: { open: boolean }) => (
  <svg className="h-4 w-4 text-amber-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
    {open ? (
      <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v1H2V6z" />
    ) : (
      <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    )}
  </svg>
);

const FileIcon = () => (
  <svg className="h-4 w-4 text-primary-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
    <path d="M4 4a2 2 0 012-2h5l5 5v9a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
  </svg>
);

const FileTree = ({ onFileOpen }: FileTreeProps) => {
  const dispatch = useAppDispatch();
  const { root, isLoading, error } = useAppSelector((state) => state.files);
  const { providers, currentProviderId } = useAppSelector((state) => state.storageProvider);
  const activeProvider = useMemo(
    () => providers.find((provider) => provider.id === currentProviderId) || null,
    [providers, currentProviderId]
  );

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [currentDirectoryPath, setCurrentDirectoryPath] = useState<string | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    position: { x: number; y: number };
    node: FileNode | null;
  }>({
    visible: false,
    position: { x: 0, y: 0 },
    node: null,
  });

  // Modal states
  const [renameModal, setRenameModal] = useState<{
    visible: boolean;
    node: FileNode | null;
  }>({
    visible: false,
    node: null,
  });

  const [deleteModal, setDeleteModal] = useState<{
    visible: boolean;
    node: FileNode | null;
  }>({
    visible: false,
    node: null,
  });

  const rootPath = root?.path || null;

  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    dispatch(fetchFileSystem());
  }, [dispatch, currentProviderId]);

  const filteredRoot = useMemo(() => {
    if (!root) {
      return null;
    }

    if (!searchTerm.trim()) {
      return root;
    }

    return filterTree(root, searchTerm.trim()) ?? null;
  }, [root, searchTerm]);

  const displayRoot = filteredRoot;

  const buildVisibleNodes = useCallback(
    (rootNode: FileNode) => {
      const nodes: VisibleNode[] = [];

      const traverse = (node: FileNode, depth: number, parentPath: string | null) => {
        const isRootNode = parentPath === null;
        const expanded =
          node.type === 'directory'
            ? searchTerm.trim().length > 0 || expandedNodes[node.path] || isRootNode
            : false;

        nodes.push({
          node,
          depth,
          parentPath,
          isExpanded: expanded,
        });

        if (node.type === 'directory' && expanded) {
          const children = node.children ? sortNodes(node.children) : [];
          children.forEach((child) => traverse(child, depth + 1, node.path));
        }
      };

      traverse(rootNode, 0, null);
      return nodes;
    },
    [expandedNodes, searchTerm]
  );

  const visibleNodes = useMemo(() => {
    if (!displayRoot) {
      return [];
    }

    return buildVisibleNodes(displayRoot);
  }, [displayRoot, buildVisibleNodes]);

  const defaultFocusedId = visibleNodes[0]?.node.id ?? null;
  const resolvedFocusedId = focusedNodeId ?? defaultFocusedId;

  useEffect(() => {
    if (resolvedFocusedId && itemRefs.current[resolvedFocusedId]) {
      itemRefs.current[resolvedFocusedId]?.focus({ preventScroll: false });
    }
  }, [resolvedFocusedId]);

  const effectiveActivePath = useMemo(() => {
    if (activePath) {
      const exists = visibleNodes.some((item) => item.node.path === activePath);
      if (exists) {
        return activePath;
      }
    }
    return rootPath;
  }, [activePath, visibleNodes, rootPath]);

  const effectiveDirectoryPath = useMemo(() => {
    if (currentDirectoryPath) {
      const exists = visibleNodes.some(
        (item) => item.node.path === currentDirectoryPath && item.node.type === 'directory'
      );
      if (exists) {
        return currentDirectoryPath;
      }
    }
    return rootPath;
  }, [currentDirectoryPath, visibleNodes, rootPath]);

  const ensurePathExpanded = useCallback((path: string) => {
    if (!path) {
      return;
    }

    setExpandedNodes((previous) => ({
      ...previous,
      [path]: true,
    }));
  }, []);

  const handleToggleDirectory = useCallback((node: FileNode, expand?: boolean) => {
    if (node.type !== 'directory') {
      return;
    }

    setExpandedNodes((previous) => ({
      ...previous,
      [node.path]: expand !== undefined ? expand : !previous[node.path],
    }));
  }, []);

  const handleOpenFile = useCallback(
    async (node: FileNode) => {
      dispatch(addOpenFile(node));
      dispatch(setCurrentFile(node));

      try {
        const result = await dispatch(readFile(node.path)).unwrap();
        if (onFileOpen) {
          onFileOpen(node, result.content);
        }
      } catch (fileError) {
        console.error('Failed to open file:', fileError);
      }
    },
    [dispatch, onFileOpen]
  );

  const handleSelectNode = useCallback(
    async (node: FileNode, event?: MouseEvent<HTMLDivElement>) => {
      event?.stopPropagation();
      setFocusedNodeId(node.id);
      setActivePath(node.path);

      if (node.type === 'directory') {
        setCurrentDirectoryPath(node.path);
        handleToggleDirectory(node);
      } else {
        const parentPath = getParentPath(node.path, rootPath);
        if (parentPath) {
          ensurePathExpanded(parentPath);
          setCurrentDirectoryPath(parentPath);
        }
        await handleOpenFile(node);
      }
    },
    [ensurePathExpanded, handleOpenFile, handleToggleDirectory, rootPath]
  );

  const handleBreadcrumbClick = useCallback(
    (node: FileNode) => {
      if (node.type !== 'directory') {
        return;
      }

      setCurrentDirectoryPath(node.path);
      setActivePath(node.path);
      setFocusedNodeId(node.id);

      const pathNodes = findPathToNode(root || node, node.path) || [];
      setExpandedNodes((previous) => {
        const updated = { ...previous };
        pathNodes
          .filter((entry) => entry.type === 'directory')
          .forEach((entry) => {
            updated[entry.path] = true;
          });
        return updated;
      });
    },
    [root]
  );

  // Context menu handlers
  const handleContextMenu = useCallback((event: MouseEvent, node: FileNode) => {
    event.preventDefault();
    event.stopPropagation();

    setContextMenu({
      visible: true,
      position: { x: event.clientX, y: event.clientY },
      node,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleContextMenuAction = useCallback(
    async (action: ContextMenuAction, node: FileNode) => {
      try {
        switch (action) {
          case 'open':
            if (node.type === 'file') {
              await handleOpenFile(node);
            }
            break;

          case 'rename':
            setRenameModal({ visible: true, node });
            break;

          case 'delete':
            setDeleteModal({ visible: true, node });
            break;

          case 'download':
            if (node.type === 'file') {
              await dispatch(downloadFile(node.path)).unwrap();
              dispatch(addToast({ message: 'File downloaded successfully', type: 'success' }));
            }
            break;

          case 'duplicate': {
            const parentPath = getParentPath(node.path, rootPath);
            if (parentPath) {
              const extension =
                node.type === 'file' ? node.name.substring(node.name.lastIndexOf('.')) : '';
              const baseName =
                node.type === 'file'
                  ? node.name.substring(0, node.name.lastIndexOf('.'))
                  : node.name;
              const newName = `${baseName} copy${extension}`;
              const newPath = `${parentPath}/${newName}`;

              await dispatch(
                copyFile({ sourcePath: node.path, destinationPath: newPath })
              ).unwrap();
              await dispatch(fetchFileSystem()).unwrap();
              dispatch(addToast({ message: 'File duplicated successfully', type: 'success' }));
            }
            break;
          }

          case 'copyPath': {
            const success = await copyToClipboard(node.path);
            if (success) {
              dispatch(addToast({ message: 'Path copied to clipboard', type: 'success' }));
            } else {
              dispatch(addToast({ message: 'Failed to copy path', type: 'error' }));
            }
            break;
          }
        }
      } catch (error) {
        dispatch(
          addToast({
            message: error instanceof Error ? error.message : 'Operation failed',
            type: 'error',
          })
        );
      }
    },
    [dispatch, handleOpenFile, rootPath]
  );

  const handleRenameConfirm = useCallback(
    async (newName?: string) => {
      if (!renameModal.node || !newName) return;

      const parentPath = getParentPath(renameModal.node.path, rootPath);
      if (!parentPath) return;

      const newPath = `${parentPath}/${newName}`;

      await dispatch(renameFile({ oldPath: renameModal.node.path, newPath })).unwrap();
      await dispatch(fetchFileSystem()).unwrap();

      dispatch(addToast({ message: 'File renamed successfully', type: 'success' }));
      setRenameModal({ visible: false, node: null });
    },
    [dispatch, renameModal.node, rootPath]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteModal.node) return;

    await dispatch(deleteFile(deleteModal.node.path)).unwrap();
    await dispatch(fetchFileSystem()).unwrap();

    dispatch(addToast({ message: 'File deleted successfully', type: 'success' }));
    setDeleteModal({ visible: false, node: null });
  }, [dispatch, deleteModal.node]);

  const onKeyDown = useCallback(
    async (event: KeyboardEvent<HTMLDivElement>) => {
      if (!visibleNodes.length || !resolvedFocusedId) {
        return;
      }

      const currentIndex = visibleNodes.findIndex((item) => item.node.id === resolvedFocusedId);

      if (currentIndex === -1) {
        if (defaultFocusedId) {
          setFocusedNodeId(defaultFocusedId);
        }
        return;
      }

      const currentItem = visibleNodes[currentIndex];

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault();
          if (currentIndex < visibleNodes.length - 1) {
            setFocusedNodeId(visibleNodes[currentIndex + 1].node.id);
          }
          break;
        }
        case 'ArrowUp': {
          event.preventDefault();
          if (currentIndex > 0) {
            setFocusedNodeId(visibleNodes[currentIndex - 1].node.id);
          }
          break;
        }
        case 'ArrowRight': {
          if (currentItem.node.type === 'directory') {
            event.preventDefault();
            if (!currentItem.isExpanded) {
              handleToggleDirectory(currentItem.node, true);
            } else if (currentIndex < visibleNodes.length - 1) {
              setFocusedNodeId(visibleNodes[currentIndex + 1].node.id);
            }
          }
          break;
        }
        case 'ArrowLeft': {
          if (currentItem.node.type === 'directory' && currentItem.isExpanded) {
            event.preventDefault();
            handleToggleDirectory(currentItem.node, false);
          } else if (currentItem.parentPath) {
            event.preventDefault();
            const parent = visibleNodes.find((item) => item.node.path === currentItem.parentPath);
            if (parent) {
              setFocusedNodeId(parent.node.id);
            }
          }
          break;
        }
        case 'Enter': {
          event.preventDefault();
          if (currentItem.node.type === 'directory') {
            await handleSelectNode(currentItem.node);
          } else {
            await handleOpenFile(currentItem.node);
            setActivePath(currentItem.node.path);
            const parentPath = getParentPath(currentItem.node.path, rootPath);
            if (parentPath) {
              setCurrentDirectoryPath(parentPath);
            }
          }
          break;
        }
        default:
          break;
      }
    },
    [
      defaultFocusedId,
      handleOpenFile,
      handleSelectNode,
      handleToggleDirectory,
      resolvedFocusedId,
      rootPath,
      visibleNodes,
    ]
  );

  const breadcrumbNodes = useMemo(() => {
    if (!root || !effectiveDirectoryPath) {
      return [];
    }

    const path = findPathToNode(root, effectiveDirectoryPath);
    if (path) {
      return path;
    }

    return [root];
  }, [root, effectiveDirectoryPath]);

  const providerBadge = useMemo(() => {
    if (activeProvider) {
      const preset =
        providerStyles[activeProvider.type as StorageProvider['type']] ?? providerStyles.local;
      return (
        <div
          className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-medium ${preset.bg} ${preset.text}`}
        >
          <span>{preset.icon}</span>
          <span>{activeProvider.name || preset.label}</span>
        </div>
      );
    }

    const fallback = providerStyles.local;
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-medium ${fallback.bg} ${fallback.text}`}
      >
        <span>{fallback.icon}</span>
        <span>Local Workspace</span>
      </div>
    );
  }, [activeProvider]);

  return (
    <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-800">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">File Explorer</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Navigate project files</p>
        </div>
        {providerBadge}
      </div>

      <div className="flex flex-col gap-2 border-b border-gray-200 px-3 py-3 dark:border-gray-800">
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search files"
          icon={
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path
                fillRule="evenodd"
                d="M12.9 14.32a8 8 0 111.414-1.414l4.387 4.387a1 1 0 01-1.414 1.414l-4.387-4.387zM14 8a6 6 0 11-12 0 6 6 0 0112 0z"
                clipRule="evenodd"
              />
            </svg>
          }
        />

        {breadcrumbNodes.length > 0 && (
          <nav className="flex flex-wrap items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
            {breadcrumbNodes.map((node, index) => {
              const isLast = index === breadcrumbNodes.length - 1;
              return (
                <div key={node.id} className="flex items-center gap-1">
                  {index > 0 && <span className="text-gray-400">/</span>}
                  <button
                    type="button"
                    onClick={() => handleBreadcrumbClick(node)}
                    className={`rounded px-1 py-0.5 transition-colors ${
                      isLast
                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/60 dark:text-primary-200'
                        : 'hover:bg-gray-200 dark:hover:bg-gray-800'
                    }`}
                  >
                    {node.name}
                  </button>
                </div>
              );
            })}
          </nav>
        )}
      </div>

      <div className="relative flex-1 overflow-hidden">
        <LoadingOverlay isLoading={isLoading}>
          {error && (
            <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-red-500">
              <p>{error}</p>
              <Button size="sm" variant="secondary" onClick={() => dispatch(fetchFileSystem())}>
                Retry
              </Button>
            </div>
          )}

          {!error && !displayRoot && !isLoading && (
            <div className="flex h-full items-center justify-center px-4 py-6">
              <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                {searchTerm ? 'No files matched your search.' : 'No files to display.'}
              </div>
            </div>
          )}

          {!error && displayRoot && (
            <div
              role="tree"
              tabIndex={0}
              onKeyDown={onKeyDown}
              className="h-full overflow-auto px-2 py-2 focus:outline-none"
            >
              {visibleNodes.map(({ node, depth, isExpanded }) => {
                const isActive = effectiveActivePath === node.path;
                const isFocused = resolvedFocusedId === node.id;
                const indent = depth * 12;
                const isDirectory = node.type === 'directory';

                return (
                  <div
                    key={node.id}
                    role="treeitem"
                    aria-expanded={isDirectory ? isExpanded : undefined}
                    aria-selected={isActive}
                    ref={(element) => {
                      itemRefs.current[node.id] = element;
                    }}
                    tabIndex={-1}
                    onClick={(event) => handleSelectNode(node, event)}
                    onDoubleClick={(event) => handleSelectNode(node, event)}
                    onContextMenu={(event) => handleContextMenu(event, node)}
                    className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors ${
                      isActive
                        ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/60 dark:text-primary-100'
                        : isFocused
                          ? 'bg-gray-100 text-gray-900 dark:bg-gray-800/80 dark:text-gray-100'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
                    }`}
                    style={{ marginLeft: `${indent}px` }}
                  >
                    {isDirectory ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleToggleDirectory(node);
                        }}
                        className="flex h-5 w-5 items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                        aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
                      >
                        <ChevronIcon expanded={isExpanded} />
                      </button>
                    ) : (
                      <span className="h-5 w-5" />
                    )}

                    <span>{isDirectory ? <FolderIcon open={isExpanded} /> : <FileIcon />}</span>
                    <span className="flex-1 truncate" title={node.name}>
                      {node.name}
                    </span>

                    <div className="ml-auto flex shrink-0 items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                      <span className="whitespace-nowrap">{formatFileSize(node.size)}</span>
                      <span className="whitespace-nowrap">{formatDate(node.lastModified)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </LoadingOverlay>
      </div>

      {!isLoading && !displayRoot && !error && (
        <div className="border-t border-gray-200 px-3 py-3 text-center text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
          Connect a storage provider to browse files.
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.node && (
        <ContextMenu
          visible={contextMenu.visible}
          position={contextMenu.position}
          node={contextMenu.node}
          onClose={closeContextMenu}
          onAction={handleContextMenuAction}
        />
      )}

      {/* Rename Modal */}
      {renameModal.node && (
        <ConfirmModal
          isOpen={renameModal.visible}
          onClose={() => setRenameModal({ visible: false, node: null })}
          onConfirm={handleRenameConfirm}
          title="Rename File/Folder"
          message="Enter a new name for this file or folder."
          confirmText="Rename"
          type="rename"
          node={renameModal.node}
        />
      )}

      {/* Delete Modal */}
      {deleteModal.node && (
        <ConfirmModal
          isOpen={deleteModal.visible}
          onClose={() => setDeleteModal({ visible: false, node: null })}
          onConfirm={handleDeleteConfirm}
          title="Delete File/Folder"
          message={`Are you sure you want to delete this ${deleteModal.node.type}?`}
          confirmText="Delete"
          type="delete"
          node={deleteModal.node}
        />
      )}
    </div>
  );
};

export default FileTree;
