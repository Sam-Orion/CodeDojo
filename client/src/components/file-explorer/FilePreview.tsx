import React, { useMemo } from 'react';
import { FileNode } from '../../types';

interface FilePreviewProps {
  file: FileNode | null;
  content: string | null;
}

interface JSONNode {
  key: string;
  value: any;
  children?: JSONNode[];
}

const FilePreview: React.FC<FilePreviewProps> = ({ file, content }) => {
  const previewType = useMemo(() => {
    if (!file) return 'none';

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const textExtensions = [
      'txt',
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
      'json',
    ];
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
    const markdownExtensions = ['md', 'markdown'];

    if (markdownExtensions.includes(ext)) return 'markdown';
    if (ext === 'json') return 'json';
    if (imageExtensions.includes(ext)) return 'image';
    if (textExtensions.includes(ext)) return 'text';

    return 'unsupported';
  }, [file]);

  const parseJSON = (jsonStr: string): JSONNode | null => {
    try {
      const parsed = JSON.parse(jsonStr);
      return buildJSONTree('root', parsed);
    } catch {
      return null;
    }
  };

  const buildJSONTree = (key: string, value: any): JSONNode => {
    if (Array.isArray(value)) {
      return {
        key,
        value: `Array[${value.length}]`,
        children: value.map((item, i) => buildJSONTree(`[${i}]`, item)),
      };
    } else if (value !== null && typeof value === 'object') {
      return {
        key,
        value: `Object`,
        children: Object.entries(value).map(([k, v]) => buildJSONTree(k, v)),
      };
    }
    return { key, value };
  };

  const renderMarkdown = (text: string) => {
    let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    html = html
      .replace(/^### (.*?)$/gm, '<h3 className="text-lg font-bold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*?)$/gm, '<h2 className="text-xl font-bold mt-6 mb-3">$1</h2>')
      .replace(/^# (.*?)$/gm, '<h1 className="text-2xl font-bold mt-8 mb-4">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong className="font-bold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em className="italic">$1</em>')
      .replace(
        /`(.*?)`/g,
        '<code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded font-mono text-sm">$1</code>'
      )
      .replace(/\n/g, '<br/>');

    return (
      <div className="prose dark:prose-invert prose-sm max-w-none">
        <div
          className="text-sm leading-relaxed text-gray-700 dark:text-gray-300"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  };

  const renderJSONTree = (node: JSONNode | null, depth: number = 0) => {
    if (!node) return null;

    return <JSONTreeNode key={`${node.key}-${depth}`} node={node} depth={depth} />;
  };

  const JSONTreeNode: React.FC<{ node: JSONNode; depth: number }> = ({ node, depth }) => {
    const [expanded, setExpanded] = React.useState(depth < 3);

    const isExpandable = node.children && node.children.length > 0;

    return (
      <div style={{ marginLeft: `${depth * 12}px` }} className="font-mono text-sm">
        <div className="flex items-center gap-1">
          {isExpandable && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-4 h-4 flex items-center justify-center text-primary-600 dark:text-primary-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              {expanded ? '▼' : '▶'}
            </button>
          )}
          {!isExpandable && <span className="w-4" />}
          <span className="text-purple-600 dark:text-purple-400">{node.key}:</span>
          {!isExpandable && (
            <span className="text-green-600 dark:text-green-400 ml-1">
              {typeof node.value === 'string' ? `"${node.value}"` : String(node.value)}
            </span>
          )}
          {isExpandable && !expanded && (
            <span className="text-gray-600 dark:text-gray-400">{node.value}</span>
          )}
        </div>
        {expanded && isExpandable && (
          <div>{node.children?.map((child) => renderJSONTree(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  const renderPlainText = (text: string) => {
    const lines = text.split('\n');

    return (
      <div className="font-mono text-sm bg-gray-50 dark:bg-gray-900 rounded">
        <div className="flex">
          <div className="bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-3 py-2 select-none text-right min-w-fit">
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <pre className="flex-1 px-4 py-2 overflow-x-auto text-gray-800 dark:text-gray-200">
            {text}
          </pre>
        </div>
      </div>
    );
  };

  const renderImage = (imageContent: string) => {
    if (!imageContent) return null;

    const isBase64 = imageContent.startsWith('data:');
    const imageSrc = isBase64
      ? imageContent
      : `data:image/${file?.name.split('.').pop()};base64,${imageContent}`;

    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <img
          src={imageSrc}
          alt={file?.name}
          className="max-w-full max-h-96 rounded border border-gray-300 dark:border-gray-700"
        />
        <p className="text-sm text-gray-600 dark:text-gray-400">{file?.name}</p>
      </div>
    );
  };

  if (!file) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <p className="text-lg font-medium">No file selected</p>
          <p className="text-sm">Select a file from the explorer to view its contents</p>
        </div>
      </div>
    );
  }

  if (previewType === 'unsupported') {
    const ext = file.name.split('.').pop();
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <p className="text-lg font-medium">Preview not available</p>
          <p className="text-sm">{`File type '.${ext}' is not supported for preview`}</p>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <p className="text-lg font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      {previewType === 'markdown' && renderMarkdown(content)}
      {previewType === 'json' && renderJSONTree(parseJSON(content))}
      {previewType === 'image' && renderImage(content)}
      {previewType === 'text' && renderPlainText(content)}
    </div>
  );
};

export default FilePreview;
