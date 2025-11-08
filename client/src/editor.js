/**
 * Editor module for Monaco Editor initialization and management
 */

let editor;
let ignoreChangeEvent = false;
let ws;

/**
 * Initialize the Monaco Editor
 * @param {HTMLElement} container - DOM element to mount the editor
 * @returns {void}
 */
export function initializeEditor(container) {
  require.config({
    paths: {
      vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.33.0/min/vs',
    },
  });

  require(['vs/editor/editor.main'], () => {
    editor = monaco.editor.create(container, {
      value: `// Welcome to CodeDojo, your own Collaborative IDE!\n// Enter a Room ID and click "Join Session" to start.`,
      language: 'javascript',
      theme: 'vs-dark',
      automaticLayout: true,
    });
    // eslint-disable-next-line no-console
    console.log('Monaco Editor loaded successfully.');
  });
}

/**
 * Set up editor change listeners
 * @param {WebSocket} websocket - WebSocket connection
 * @param {string} roomId - Current room ID
 * @returns {void}
 */
export function setupEditorListeners(websocket, roomId) {
  ws = websocket;

  editor.onDidChangeModelContent(() => {
    if (ignoreChangeEvent) {
      return;
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      const content = editor.getValue();
      ws.send(
        JSON.stringify({
          type: 'update',
          roomId,
          content,
        })
      );
    }
  });
}

/**
 * Update editor content from remote source
 * @param {string} content - New content
 * @returns {void}
 */
export function updateEditorContent(content) {
  if (!editor) return;

  ignoreChangeEvent = true;
  const currentPosition = editor.getPosition();
  editor.setValue(content);
  editor.setPosition(currentPosition);
  ignoreChangeEvent = false;
}

/**
 * Get current editor content
 * @returns {string} - Editor content
 */
export function getEditorContent() {
  return editor ? editor.getValue() : '';
}

/**
 * Dispose of editor resources
 * @returns {void}
 */
export function disposeEditor() {
  if (editor) {
    editor.dispose();
    editor = null;
  }
}
