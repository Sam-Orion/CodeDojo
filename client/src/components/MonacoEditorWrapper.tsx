import { useRef, useEffect, useCallback, useState } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  setDocumentContent,
  addPendingOperation,
  pushUndoOperation,
} from '../store/slices/collaborationSlice';
import { Operation, AICompletionContext, AICodeSuggestion } from '../types';
import { useAICodeSuggestions } from '../hooks/useAICodeSuggestions';
import {
  AICompletionProvider,
  registerAICompletionProvider,
} from '../services/aiCompletionProvider';
import { AIEditorActions } from '../services/aiEditorActions';

const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
};

interface MonacoEditorWrapperProps {
  onOperationChange?: (operation: Operation) => void;
  onCursorChange?: (cursor: { line: number; column: number }) => void;
  readOnly?: boolean;
  language?: string;
  theme?: 'vs' | 'vs-dark' | 'hc-black';
  enableAICompletion?: boolean;
  onAIContextRequest?: (code: string, language: string, prompt: string) => void;
}

const MonacoEditorWrapper = ({
  onOperationChange,
  onCursorChange,
  readOnly = false,
  language = 'javascript',
  theme = 'vs-dark',
  enableAICompletion = true,
  onAIContextRequest,
}: MonacoEditorWrapperProps) => {
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);
  const [localVersion, setLocalVersion] = useState(0);
  const dispatch = useAppDispatch();
  const { documentContent, participants } = useAppSelector((state) => state.collaboration);
  const userId = useAppSelector((state) => state.auth.user?.id);

  const completionProviderRef = useRef<any>(null);
  const aiActionsRef = useRef<AIEditorActions | null>(null);

  const { requestSuggestions, trackSuggestion } = useAICodeSuggestions({
    maxSuggestions: 5,
    temperature: 0.3,
    minConfidence: 0.5,
  });

  useEffect(() => {
    if (monaco) {
      monaco.editor.defineTheme('custom-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#1e1e1e',
        },
      });
    }
  }, [monaco]);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value === undefined || value === documentContent) return;

      const oldContent = documentContent;
      const newContent = value;

      let operation: Operation | null = null;

      if (newContent.length > oldContent.length) {
        const diff = newContent.slice(oldContent.length);
        const position = oldContent.length - diff.length;
        operation = {
          id: generateId(),
          type: 'insert',
          position,
          content: diff,
          clientId: userId || '',
          timestamp: Date.now(),
          version: localVersion,
        };
      } else if (newContent.length < oldContent.length) {
        const deleted = oldContent.slice(newContent.length);
        operation = {
          id: generateId(),
          type: 'delete',
          position: newContent.length,
          content: deleted,
          clientId: userId || '',
          timestamp: Date.now(),
          version: localVersion,
        };
      }

      if (operation) {
        dispatch(setDocumentContent(newContent));
        dispatch(addPendingOperation(operation));
        dispatch(pushUndoOperation(operation));
        setLocalVersion(localVersion + 1);
        if (onOperationChange) {
          onOperationChange(operation);
        }
      }
    },
    [documentContent, localVersion, dispatch, onOperationChange, userId]
  );

  const handleCursorPositionChange = useCallback(() => {
    if (!editorRef.current) return;

    const position = editorRef.current.getPosition();
    if (position && onCursorChange) {
      onCursorChange({
        line: position.lineNumber - 1,
        column: position.column - 1,
      });
    }
  }, [onCursorChange]);

  useEffect(() => {
    if (editorRef.current) {
      const editor = editorRef.current;
      editor.onDidChangeCursorPosition?.(handleCursorPositionChange);
    }
  }, [handleCursorPositionChange]);

  const renderCursors = useCallback(() => {
    if (!editorRef.current || !monaco) return;

    const decorations: any[] = [];
    participants.forEach((participant) => {
      if (participant.cursor && participant.id !== userId) {
        decorations.push({
          range: new monaco.Range(
            participant.cursor.line + 1,
            participant.cursor.column + 1,
            participant.cursor.line + 1,
            participant.cursor.column + 2
          ),
          options: {
            isWholeLine: false,
            className: `cursor-${participant.id}`,
            glyphMarginClassName: 'cursor-glyph',
            glyphMarginHoverMessage: { value: participant.username },
            backgroundColor: participant.color,
            borderColor: participant.color,
            borderStyle: 'solid',
            borderWidth: '2px',
          },
        });
      }
    });

    editorRef.current.deltaDecorations([], decorations);
  }, [participants, monaco, userId]);

  useEffect(() => {
    renderCursors();
  }, [participants, renderCursors]);

  const wrapRequestSuggestions = useCallback(
    async (context: AICompletionContext): Promise<AICodeSuggestion[]> => {
      try {
        const suggestions = await requestSuggestions(context);
        return suggestions;
      } catch (error) {
        console.error('AI suggestion request failed:', error);
        return [];
      }
    },
    [requestSuggestions]
  );

  useEffect(() => {
    if (monaco && enableAICompletion && !readOnly && !completionProviderRef.current) {
      const provider = new AICompletionProvider({
        requestSuggestions: wrapRequestSuggestions,
        trackSuggestion,
        language,
      });

      completionProviderRef.current = registerAICompletionProvider(monaco, language, provider);
    }

    return () => {
      if (completionProviderRef.current) {
        completionProviderRef.current.dispose();
        completionProviderRef.current = null;
      }
    };
  }, [monaco, enableAICompletion, readOnly, language, wrapRequestSuggestions, trackSuggestion]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && !readOnly && onAIContextRequest) {
      if (aiActionsRef.current) {
        aiActionsRef.current.dispose();
      }

      aiActionsRef.current = new AIEditorActions(editor, {
        onExplainCode: (code: string, lang: string) => {
          onAIContextRequest(
            code,
            lang,
            `Explain the following ${lang} code:\n\n\`\`\`${lang}\n${code}\n\`\`\``
          );
        },
        onRefactorCode: (code: string, lang: string) => {
          onAIContextRequest(
            code,
            lang,
            `Refactor and improve the following ${lang} code:\n\n\`\`\`${lang}\n${code}\n\`\`\``
          );
        },
        onDebugCode: (code: string, lang: string) => {
          onAIContextRequest(
            code,
            lang,
            `Help me debug this ${lang} code. Identify potential issues:\n\n\`\`\`${lang}\n${code}\n\`\`\``
          );
        },
        onAskAI: (code: string, lang: string, prompt: string) => {
          onAIContextRequest(code, lang, `${prompt}\n\n\`\`\`${lang}\n${code}\n\`\`\``);
        },
      });
    }

    return () => {
      if (aiActionsRef.current) {
        aiActionsRef.current.dispose();
        aiActionsRef.current = null;
      }
    };
  }, [readOnly, onAIContextRequest]);

  return (
    <div className="flex flex-col h-full w-full">
      <Editor
        height="100%"
        defaultLanguage={language}
        language={language}
        theme={theme}
        value={documentContent}
        onChange={handleEditorChange}
        onMount={(editor) => {
          editorRef.current = editor;
          editor.focus();
        }}
        options={{
          readOnly,
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          formatOnPaste: true,
          formatOnType: true,
          mouseWheelZoom: true,
          bracketPairColorization: {
            enabled: true,
          } as any,
          fontLigatures: true,
          fontSize: 14,
          lineHeight: 1.6,
          wordWrap: 'on',
          wrappingIndent: 'indent',
          quickSuggestions: enableAICompletion
            ? {
                other: true,
                comments: false,
                strings: false,
              }
            : false,
          suggest: {
            showMethods: true,
            showFunctions: true,
            showConstructors: true,
            showFields: true,
            showVariables: true,
            showClasses: true,
            showStructs: true,
            showInterfaces: true,
            showModules: true,
            showProperties: true,
            showEvents: true,
            showOperators: true,
            showUnits: true,
            showValues: true,
            showConstants: true,
            showEnums: true,
            showEnumMembers: true,
            showKeywords: true,
            showWords: true,
            showColors: true,
            showFiles: true,
            showReferences: true,
            showFolders: true,
            showTypeParameters: true,
            showSnippets: true,
            preview: true,
            previewMode: 'subwordSmart',
          },
        }}
      />
    </div>
  );
};

export default MonacoEditorWrapper;
