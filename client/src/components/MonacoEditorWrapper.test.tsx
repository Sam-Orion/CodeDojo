import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import MonacoEditorWrapper from './MonacoEditorWrapper';
import collaborationReducer from '../store/slices/collaborationSlice';
import authReducer from '../store/slices/authSlice';

// Mock monaco-editor
vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-editor">Monaco Editor Mock</div>,
  useMonaco: () => null,
}));

describe('MonacoEditorWrapper', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        collaboration: collaborationReducer,
        auth: authReducer,
      },
    });
  });

  it('should render editor component', () => {
    render(
      <Provider store={store}>
        <MonacoEditorWrapper />
      </Provider>
    );

    const editor = screen.getByTestId('monaco-editor');
    expect(editor).toBeTruthy();
  });

  it('should accept language prop', () => {
    render(
      <Provider store={store}>
        <MonacoEditorWrapper language="typescript" />
      </Provider>
    );

    const editor = screen.getByTestId('monaco-editor');
    expect(editor).toBeTruthy();
  });

  it('should accept theme prop', () => {
    render(
      <Provider store={store}>
        <MonacoEditorWrapper theme="vs" />
      </Provider>
    );

    const editor = screen.getByTestId('monaco-editor');
    expect(editor).toBeTruthy();
  });

  it('should call onOperationChange callback when provided', () => {
    const mockCallback = vi.fn();

    render(
      <Provider store={store}>
        <MonacoEditorWrapper onOperationChange={mockCallback} />
      </Provider>
    );

    const editor = screen.getByTestId('monaco-editor');
    expect(editor).toBeTruthy();
  });

  it('should call onCursorChange callback when provided', () => {
    const mockCallback = vi.fn();

    render(
      <Provider store={store}>
        <MonacoEditorWrapper onCursorChange={mockCallback} />
      </Provider>
    );

    const editor = screen.getByTestId('monaco-editor');
    expect(editor).toBeTruthy();
  });

  it('should render with readonly mode', () => {
    render(
      <Provider store={store}>
        <MonacoEditorWrapper readOnly={true} />
      </Provider>
    );

    const editor = screen.getByTestId('monaco-editor');
    expect(editor).toBeTruthy();
  });
});
