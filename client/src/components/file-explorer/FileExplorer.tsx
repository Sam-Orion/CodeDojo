import React, { useCallback, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchFileSystem } from '../../store/slices/filesSlice';
import { FileNode } from '../../types';
import FileTree from './FileTree';
import FilePreview from './FilePreview';
import DragDropUpload from './DragDropUpload';

interface FileExplorerProps {
  showPreview?: boolean;
  showUpload?: boolean;
  layout?: 'vertical' | 'horizontal';
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  showPreview = true,
  showUpload = true,
  layout = 'horizontal',
}) => {
  const dispatch = useAppDispatch();
  const { currentFile } = useAppSelector((state) => state.files);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [currentDirectoryPath] = useState<string>('/');

  const handleFileOpen = useCallback((_file: FileNode, content: string) => {
    setFileContent(content);
  }, []);

  const handleUploadComplete = useCallback(() => {
    dispatch(fetchFileSystem());
  }, [dispatch]);

  if (layout === 'vertical') {
    return (
      <div className="flex flex-col h-full gap-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* File Tree */}
        <div className="flex-1 min-h-0 overflow-auto border-b border-gray-200 dark:border-gray-800">
          <FileTree onFileOpen={handleFileOpen} />
        </div>

        {/* File Preview */}
        {showPreview && (
          <div className="flex-1 min-h-0 overflow-auto border-b border-gray-200 dark:border-gray-800">
            <FilePreview file={currentFile} content={fileContent} />
          </div>
        )}

        {/* Upload Area */}
        {showUpload && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-800">
            <DragDropUpload
              currentDirectoryPath={currentDirectoryPath}
              onUploadComplete={handleUploadComplete}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full gap-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Left: File Tree */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-auto">
          <FileTree onFileOpen={handleFileOpen} />
        </div>

        {/* Upload Area */}
        {showUpload && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-800">
            <DragDropUpload
              currentDirectoryPath={currentDirectoryPath}
              onUploadComplete={handleUploadComplete}
            />
          </div>
        )}
      </div>

      {/* Right: File Preview */}
      {showPreview && (
        <div className="flex-1 min-w-0 overflow-auto">
          <FilePreview file={currentFile} content={fileContent} />
        </div>
      )}
    </div>
  );
};

export default FileExplorer;
