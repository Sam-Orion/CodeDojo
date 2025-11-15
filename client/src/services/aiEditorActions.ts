import * as monaco from 'monaco-editor';

export interface AIEditorActionsOptions {
  onExplainCode: (code: string, language: string) => void;
  onRefactorCode: (code: string, language: string) => void;
  onDebugCode: (code: string, language: string) => void;
  onAskAI: (code: string, language: string, prompt: string) => void;
}

export class AIEditorActions {
  private editor: monaco.editor.IStandaloneCodeEditor;
  private options: AIEditorActionsOptions;
  private disposables: monaco.IDisposable[] = [];

  constructor(editor: monaco.editor.IStandaloneCodeEditor, options: AIEditorActionsOptions) {
    this.editor = editor;
    this.options = options;
    this.registerActions();
  }

  private registerActions() {
    this.disposables.push(
      this.editor.addAction({
        id: 'ai-explain-code',
        label: 'AI: Explain This Code',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE],
        contextMenuGroupId: 'ai',
        contextMenuOrder: 1,
        precondition: 'editorHasSelection',
        run: (ed) => {
          const selection = ed.getSelection();
          if (!selection) return;

          const code = ed.getModel()?.getValueInRange(selection) || '';
          const language = ed.getModel()?.getLanguageId() || 'javascript';

          if (code.trim()) {
            this.options.onExplainCode(code, language);
          }
        },
      })
    );

    this.disposables.push(
      this.editor.addAction({
        id: 'ai-refactor-code',
        label: 'AI: Refactor This Code',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyR],
        contextMenuGroupId: 'ai',
        contextMenuOrder: 2,
        precondition: 'editorHasSelection',
        run: (ed) => {
          const selection = ed.getSelection();
          if (!selection) return;

          const code = ed.getModel()?.getValueInRange(selection) || '';
          const language = ed.getModel()?.getLanguageId() || 'javascript';

          if (code.trim()) {
            this.options.onRefactorCode(code, language);
          }
        },
      })
    );

    this.disposables.push(
      this.editor.addAction({
        id: 'ai-debug-code',
        label: 'AI: Debug This Code',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyD],
        contextMenuGroupId: 'ai',
        contextMenuOrder: 3,
        precondition: 'editorHasSelection',
        run: (ed) => {
          const selection = ed.getSelection();
          if (!selection) return;

          const code = ed.getModel()?.getValueInRange(selection) || '';
          const language = ed.getModel()?.getLanguageId() || 'javascript';

          if (code.trim()) {
            this.options.onDebugCode(code, language);
          }
        },
      })
    );

    this.disposables.push(
      this.editor.addAction({
        id: 'ai-improve-code',
        label: 'AI: Improve This Code',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyI],
        contextMenuGroupId: 'ai',
        contextMenuOrder: 4,
        precondition: 'editorHasSelection',
        run: (ed) => {
          const selection = ed.getSelection();
          if (!selection) return;

          const code = ed.getModel()?.getValueInRange(selection) || '';
          const language = ed.getModel()?.getLanguageId() || 'javascript';

          if (code.trim()) {
            this.options.onAskAI(code, language, 'Improve this code');
          }
        },
      })
    );

    this.disposables.push(
      this.editor.addAction({
        id: 'ai-add-comments',
        label: 'AI: Add Comments to Code',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyC],
        contextMenuGroupId: 'ai',
        contextMenuOrder: 5,
        precondition: 'editorHasSelection',
        run: (ed) => {
          const selection = ed.getSelection();
          if (!selection) return;

          const code = ed.getModel()?.getValueInRange(selection) || '';
          const language = ed.getModel()?.getLanguageId() || 'javascript';

          if (code.trim()) {
            this.options.onAskAI(code, language, 'Add detailed comments to this code');
          }
        },
      })
    );

    this.disposables.push(
      this.editor.addAction({
        id: 'ai-generate-tests',
        label: 'AI: Generate Tests',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyT],
        contextMenuGroupId: 'ai',
        contextMenuOrder: 6,
        precondition: 'editorHasSelection',
        run: (ed) => {
          const selection = ed.getSelection();
          if (!selection) return;

          const code = ed.getModel()?.getValueInRange(selection) || '';
          const language = ed.getModel()?.getLanguageId() || 'javascript';

          if (code.trim()) {
            this.options.onAskAI(code, language, 'Generate unit tests for this code');
          }
        },
      })
    );

    this.disposables.push(
      this.editor.addAction({
        id: 'ai-optimize-performance',
        label: 'AI: Optimize Performance',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyO],
        contextMenuGroupId: 'ai',
        contextMenuOrder: 7,
        precondition: 'editorHasSelection',
        run: (ed) => {
          const selection = ed.getSelection();
          if (!selection) return;

          const code = ed.getModel()?.getValueInRange(selection) || '';
          const language = ed.getModel()?.getLanguageId() || 'javascript';

          if (code.trim()) {
            this.options.onAskAI(
              code,
              language,
              'Analyze and optimize the performance of this code'
            );
          }
        },
      })
    );

    this.disposables.push(
      this.editor.addAction({
        id: 'ai-ask-question',
        label: 'AI: Ask Question About Code',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyA],
        contextMenuGroupId: 'ai',
        contextMenuOrder: 8,
        precondition: 'editorHasSelection',
        run: (ed) => {
          const selection = ed.getSelection();
          if (!selection) return;

          const code = ed.getModel()?.getValueInRange(selection) || '';
          const language = ed.getModel()?.getLanguageId() || 'javascript';

          if (code.trim()) {
            const question = prompt('What would you like to know about this code?');
            if (question) {
              this.options.onAskAI(code, language, question);
            }
          }
        },
      })
    );
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
