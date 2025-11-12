import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { addToast } from '../../store/slices/toastSlice';
import Button from '../ui/Button';

interface Upload {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

interface DragDropUploadProps {
  currentDirectoryPath?: string;
  onUploadComplete?: () => void;
}

const ALLOWED_FILE_TYPES = [
  'text/plain',
  'application/json',
  'text/markdown',
  'text/javascript',
  'application/typescript',
  'text/typescript',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'text/css',
  'text/html',
  'application/xml',
  'text/xml',
  'application/x-yaml',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const DragDropUpload: React.FC<DragDropUploadProps> = ({
  currentDirectoryPath = '/',
  onUploadComplete,
}) => {
  const dispatch = useAppDispatch();
  const { isLoading } = useAppSelector((state) => state.files);

  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [showUploadArea, setShowUploadArea] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const isAllowedExtension = useCallback((filename: string): boolean => {
    const allowedExtensions = [
      'txt',
      'json',
      'md',
      'js',
      'ts',
      'tsx',
      'jsx',
      'py',
      'java',
      'cpp',
      'c',
      'h',
      'css',
      'scss',
      'html',
      'xml',
      'yaml',
      'yml',
      'toml',
      'sh',
      'bash',
      'png',
      'jpg',
      'jpeg',
      'gif',
      'webp',
      'svg',
    ];
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return allowedExtensions.includes(ext);
  }, []);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!ALLOWED_FILE_TYPES.includes(file.type) && !isAllowedExtension(file.name)) {
        return `File type '${file.type || 'unknown'}' is not allowed`;
      }

      if (file.size > MAX_FILE_SIZE) {
        return `File size exceeds 50MB limit`;
      }

      return null;
    },
    [isAllowedExtension]
  );

  const uploadFile = useCallback(
    async (file: File, uploadId: string) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploadPath', currentDirectoryPath);

      try {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            setUploads((prev) =>
              prev.map((u) => (u.id === uploadId ? { ...u, progress: percentComplete } : u))
            );
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploads((prev) =>
              prev.map((u) =>
                u.id === uploadId ? { ...u, status: 'completed', progress: 100 } : u
              )
            );
            dispatch(
              addToast({
                message: `File '${file.name}' uploaded successfully`,
                type: 'success',
              })
            );

            if (onUploadComplete) {
              onUploadComplete();
            }
          } else {
            const error = xhr.responseText;
            setUploads((prev) =>
              prev.map((u) =>
                u.id === uploadId
                  ? {
                      ...u,
                      status: 'error',
                      error: error || 'Upload failed',
                    }
                  : u
              )
            );
            dispatch(
              addToast({
                message: `Failed to upload '${file.name}'`,
                type: 'error',
              })
            );
          }
        });

        xhr.addEventListener('error', () => {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === uploadId
                ? {
                    ...u,
                    status: 'error',
                    error: 'Network error',
                  }
                : u
            )
          );
          dispatch(
            addToast({
              message: `Error uploading '${file.name}'`,
              type: 'error',
            })
          );
        });

        xhr.open('POST', '/api/v1/files/upload');
        xhr.send(formData);
      } catch (error) {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === uploadId
              ? {
                  ...u,
                  status: 'error',
                  error: error instanceof Error ? error.message : 'Unknown error',
                }
              : u
          )
        );
        dispatch(
          addToast({
            message: `Error uploading '${file.name}'`,
            type: 'error',
          })
        );
      }
    },
    [currentDirectoryPath, dispatch, onUploadComplete]
  );

  const handleFiles = useCallback(
    (files: File[]) => {
      const validFiles: File[] = [];

      for (const file of files) {
        const error = validateFile(file);
        if (error) {
          dispatch(addToast({ message: `${file.name}: ${error}`, type: 'error' }));
        } else {
          validFiles.push(file);
        }
      }

      if (validFiles.length === 0) {
        return;
      }

      const newUploads = validFiles.map((file) => ({
        id: `${Date.now()}-${Math.random()}`,
        file,
        progress: 0,
        status: 'uploading' as const,
      }));

      setUploads((prev) => [...prev, ...newUploads]);

      newUploads.forEach((upload) => {
        uploadFile(upload.file, upload.id);
      });
    },
    [dispatch, validateFile, uploadFile]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    setIsDragging(true);
    setShowUploadArea(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      handleFiles(files);
    },
    [handleFiles]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      handleFiles(files);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleFiles]
  );

  const handleRetryUpload = useCallback(
    (uploadId: string) => {
      const upload = uploads.find((u) => u.id === uploadId);
      if (upload) {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === uploadId ? { ...u, status: 'uploading', progress: 0, error: undefined } : u
          )
        );
        uploadFile(upload.file, uploadId);
      }
    },
    [uploads, uploadFile]
  );

  const handleClearUpload = useCallback((uploadId: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== uploadId));
  }, []);

  const handleClearAll = useCallback(() => {
    setUploads((prev) => prev.filter((u) => u.status === 'uploading'));
  }, []);

  // Clear completed uploads after 5 seconds
  useEffect(() => {
    if (uploads.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      const hasIncomplete = uploads.some((u) => u.status === 'uploading' || u.status === 'error');
      if (!hasIncomplete && uploads.length > 0) {
        setUploads((prev) => prev.filter((u) => u.status === 'uploading' || u.status === 'error'));
        if (uploads.every((u) => u.status === 'completed')) {
          setShowUploadArea(false);
        }
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [uploads]);

  return (
    <>
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="relative"
      >
        {isDragging && (
          <div className="absolute inset-0 bg-primary-500/10 border-2 border-dashed border-primary-500 rounded pointer-events-none z-40 flex items-center justify-center">
            <div className="text-center">
              <p className="text-primary-700 dark:text-primary-300 font-medium">
                Drop files here to upload
              </p>
            </div>
          </div>
        )}

        {showUploadArea && (
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 mb-4">
            <div className="space-y-2">
              {uploads.length > 0 && (
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Uploads ({uploads.length})
                  </h3>
                  {uploads.some((u) => u.status === 'completed' || u.status === 'error') && (
                    <button
                      onClick={handleClearAll}
                      className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}

              {uploads.map((upload) => (
                <div
                  key={upload.id}
                  className="bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {upload.file.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {(upload.file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>

                    {upload.status === 'uploading' && (
                      <span className="text-xs text-primary-600 dark:text-primary-400 whitespace-nowrap">
                        {Math.round(upload.progress)}%
                      </span>
                    )}

                    {upload.status === 'completed' && (
                      <span className="text-xs text-green-600 dark:text-green-400 whitespace-nowrap">
                        ✓ Done
                      </span>
                    )}

                    {upload.status === 'error' && (
                      <span className="text-xs text-red-600 dark:text-red-400 whitespace-nowrap">
                        ✕ Error
                      </span>
                    )}
                  </div>

                  {upload.status === 'uploading' && (
                    <div className="mt-2 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 transition-all duration-300"
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                  )}

                  {upload.error && (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-red-600 dark:text-red-400">{upload.error}</p>
                      <button
                        onClick={() => handleRetryUpload(upload.id)}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {(upload.status === 'error' || upload.status === 'completed') && (
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => handleClearUpload(upload.id)}
                        className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
        accept={ALLOWED_FILE_TYPES.join(',')}
      />

      <Button
        variant="secondary"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
      >
        Upload Files
      </Button>
    </>
  );
};

export default DragDropUpload;
