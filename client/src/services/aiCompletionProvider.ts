import * as monaco from 'monaco-editor';
import { AICodeSuggestion, AICompletionContext } from '../types';

export interface AICompletionProviderOptions {
  requestSuggestions: (context: AICompletionContext) => Promise<AICodeSuggestion[]>;
  trackSuggestion: (
    suggestionId: string,
    action: 'accepted' | 'rejected' | 'dismissed' | 'shown'
  ) => void;
  language?: string;
}

export class AICompletionProvider implements monaco.languages.CompletionItemProvider {
  private requestSuggestions: (context: AICompletionContext) => Promise<AICodeSuggestion[]>;
  private trackSuggestion: (
    suggestionId: string,
    action: 'accepted' | 'rejected' | 'dismissed' | 'shown'
  ) => void;
  private language: string;
  private lastRequestTime = 0;
  private minRequestInterval = 500;

  public triggerCharacters = ['.', ' ', '(', '{', '[', '\n'];

  constructor(options: AICompletionProviderOptions) {
    this.requestSuggestions = options.requestSuggestions;
    this.trackSuggestion = options.trackSuggestion;
    this.language = options.language || 'javascript';
  }

  async provideCompletionItems(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    context: monaco.languages.CompletionContext,
    token: monaco.CancellationToken
  ): Promise<monaco.languages.CompletionList | null> {
    const now = Date.now();
    if (now - this.lastRequestTime < this.minRequestInterval) {
      return null;
    }
    this.lastRequestTime = now;

    if (token.isCancellationRequested) {
      return null;
    }

    try {
      const lineContent = model.getLineContent(position.lineNumber);
      const offset = model.getOffsetAt(position);
      const fullContent = model.getValue();

      const prefixStart = Math.max(0, offset - 500);
      const suffixEnd = Math.min(fullContent.length, offset + 500);
      const prefix = fullContent.substring(prefixStart, offset);
      const suffix = fullContent.substring(offset, suffixEnd);

      const completionContext: AICompletionContext = {
        language: this.language,
        fileContent: fullContent,
        cursorPosition: offset,
        prefix,
        suffix,
        currentLine: lineContent,
      };

      const suggestions = await this.requestSuggestions(completionContext);

      if (token.isCancellationRequested) {
        return null;
      }

      const completionItems: monaco.languages.CompletionItem[] = suggestions.map((suggestion) => {
        const confidence = Math.round(suggestion.confidence * 100);
        const confidenceLabel = this.getConfidenceLabel(suggestion.confidence);

        return {
          label: {
            label: suggestion.content.split('\n')[0].substring(0, 50),
            description: `${confidenceLabel} (${confidence}%)`,
          },
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: suggestion.content,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: suggestion.description || 'AI Suggestion',
          documentation: {
            value: `**AI-generated suggestion** (${confidence}% confidence)\n\n\`\`\`${this.language}\n${suggestion.content}\n\`\`\``,
            isTrusted: true,
          },
          range: suggestion.range
            ? new monaco.Range(
                suggestion.range.startLine + 1,
                suggestion.range.startColumn + 1,
                suggestion.range.endLine + 1,
                suggestion.range.endColumn + 1
              )
            : new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column
              ),
          sortText: `00${100 - confidence}`,
          filterText: suggestion.content,
          preselect: confidence > 80,
          command: {
            id: 'ai-suggestion-accepted',
            title: 'Track Suggestion Accepted',
            arguments: [suggestion.id],
          },
        };
      });

      return {
        suggestions: completionItems,
        incomplete: false,
      };
    } catch (error) {
      console.error('AI completion provider error:', error);
      return null;
    }
  }

  private getConfidenceLabel(confidence: number): string {
    if (confidence >= 0.9) return '⭐⭐⭐';
    if (confidence >= 0.7) return '⭐⭐';
    if (confidence >= 0.5) return '⭐';
    return '○';
  }
}

export const registerAICompletionProvider = (
  monaco: typeof import('monaco-editor'),
  language: string,
  provider: AICompletionProvider
): monaco.IDisposable => {
  return monaco.languages.registerCompletionItemProvider(language, provider);
};
