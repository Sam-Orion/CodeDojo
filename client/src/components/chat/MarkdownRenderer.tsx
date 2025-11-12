import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark-dimmed.css';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <ReactMarkdown
      className="prose prose-sm max-w-none text-gray-900 dark:prose-invert dark:text-gray-100"
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
      components={{
        code({ inline, className, children, ...props }) {
          if (inline) {
            return (
              <code
                className="rounded bg-gray-200 px-1 py-0.5 font-mono text-[13px] text-gray-800 dark:bg-gray-800 dark:text-gray-100"
                {...props}
              >
                {children}
              </code>
            );
          }

          const language = className?.replace('language-', '') || 'plaintext';

          return (
            <code className={`language-${language} font-mono text-[13px]`} {...props}>
              {children}
            </code>
          );
        },
        pre({ children, ...props }) {
          return (
            <pre
              className="relative max-h-96 overflow-auto rounded-lg border border-gray-200 bg-gray-900/95 p-4 text-gray-100 shadow-inner dark:border-gray-700 dark:bg-gray-950"
              {...props}
            >
              {children}
            </pre>
          );
        },
        a({ children, ...props }) {
          return (
            <a
              className="text-primary-600 underline transition hover:text-primary-500 dark:text-primary-400"
              {...props}
            >
              {children}
            </a>
          );
        },
        ul({ children, ...props }) {
          return (
            <ul
              className="list-disc space-y-1 pl-5 text-sm text-gray-900 marker:text-gray-500 dark:text-gray-100 dark:marker:text-gray-400"
              {...props}
            >
              {children}
            </ul>
          );
        },
        ol({ children, ...props }) {
          return (
            <ol
              className="list-decimal space-y-1 pl-5 text-sm text-gray-900 marker:text-gray-500 dark:text-gray-100 dark:marker:text-gray-400"
              {...props}
            >
              {children}
            </ol>
          );
        },
        table({ children, ...props }) {
          return (
            <div className="overflow-x-auto">
              <table
                className="w-full border-collapse text-sm text-gray-900 dark:text-gray-100"
                {...props}
              >
                {children}
              </table>
            </div>
          );
        },
        th({ children, ...props }) {
          return (
            <th
              className="border border-gray-200 bg-gray-100 px-3 py-2 text-left font-semibold dark:border-gray-700 dark:bg-gray-800"
              {...props}
            >
              {children}
            </th>
          );
        },
        td({ children, ...props }) {
          return (
            <td
              className="border border-gray-200 px-3 py-2 align-top dark:border-gray-700"
              {...props}
            >
              {children}
            </td>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

export default MarkdownRenderer;
