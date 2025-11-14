import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInput from './ChatInput';

describe('ChatInput', () => {
  it('should render input field and buttons', () => {
    const mockSubmit = vi.fn();
    render(<ChatInput onSubmit={mockSubmit} />);

    expect(screen.getByPlaceholderText(/Type your message/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Send/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Clear/i })).toBeTruthy();
  });

  it('should display character count', () => {
    const mockSubmit = vi.fn();
    render(<ChatInput onSubmit={mockSubmit} />);

    expect(screen.getByText('0 characters')).toBeTruthy();
  });

  it('should update character count when typing', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.fn();
    render(<ChatInput onSubmit={mockSubmit} />);

    const textarea = screen.getByPlaceholderText(/Type your message/i);
    await user.type(textarea, 'Hello');

    expect(screen.getByText('5 characters')).toBeTruthy();
  });

  it('should call onSubmit when Send button is clicked', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.fn();
    render(<ChatInput onSubmit={mockSubmit} />);

    const textarea = screen.getByPlaceholderText(/Type your message/i);
    await user.type(textarea, 'Test message');

    const sendButton = screen.getByRole('button', { name: /Send/i });
    await user.click(sendButton);

    expect(mockSubmit).toHaveBeenCalledWith('Test message');
  });

  it('should clear input when Clear button is clicked', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.fn();
    render(<ChatInput onSubmit={mockSubmit} />);

    const textarea = screen.getByPlaceholderText(/Type your message/i);
    await user.type(textarea, 'Test message');

    const clearButton = screen.getByRole('button', { name: /Clear/i });
    await user.click(clearButton);

    expect(textarea).toHaveValue('');
    expect(screen.getByText('0 characters')).toBeTruthy();
  });

  it('should clear input after submitting', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.fn();
    render(<ChatInput onSubmit={mockSubmit} />);

    const textarea = screen.getByPlaceholderText(/Type your message/i);
    await user.type(textarea, 'Test message');

    const sendButton = screen.getByRole('button', { name: /Send/i });
    await user.click(sendButton);

    expect(textarea).toHaveValue('');
  });

  it('should submit on Enter key press', async () => {
    const mockSubmit = vi.fn();
    render(<ChatInput onSubmit={mockSubmit} />);

    const textarea = screen.getByPlaceholderText(/Type your message/i);
    await userEvent.type(textarea, 'Test message{Enter}');

    expect(mockSubmit).toHaveBeenCalledWith('Test message');
  });

  it('should add newline on Shift+Enter', async () => {
    const mockSubmit = vi.fn();
    render(<ChatInput onSubmit={mockSubmit} />);

    const textarea = screen.getByPlaceholderText(/Type your message/i);
    await userEvent.type(textarea, 'Line 1{Shift>}{Enter}{/Shift}Line 2');

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('Line 1\nLine 2');
  });

  it('should disable input when isLoading is true', () => {
    const mockSubmit = vi.fn();
    render(<ChatInput onSubmit={mockSubmit} isLoading={true} />);

    const textarea = screen.getByPlaceholderText(/Type your message/i);
    expect(textarea).toBeDisabled();

    const clearButton = screen.getByRole('button', { name: /Clear/i });
    expect(clearButton).toBeDisabled();
  });

  it('should disable input when disabled prop is true', () => {
    const mockSubmit = vi.fn();
    render(<ChatInput onSubmit={mockSubmit} disabled={true} />);

    const textarea = screen.getByPlaceholderText(/Type your message/i);
    expect(textarea).toBeDisabled();
  });

  it('should not submit empty message', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.fn();
    render(<ChatInput onSubmit={mockSubmit} />);

    const sendButton = screen.getByRole('button', { name: /Send/i });
    await user.click(sendButton);

    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('should not submit whitespace-only message', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.fn();
    render(<ChatInput onSubmit={mockSubmit} />);

    const textarea = screen.getByPlaceholderText(/Type your message/i);
    await user.type(textarea, '   ');

    const sendButton = screen.getByRole('button', { name: /Send/i });
    await user.click(sendButton);

    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('should show loading state on Send button', () => {
    const mockSubmit = vi.fn();
    render(<ChatInput onSubmit={mockSubmit} isLoading={true} />);

    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('should disable Send button when input is empty', () => {
    const mockSubmit = vi.fn();
    render(<ChatInput onSubmit={mockSubmit} />);

    const sendButton = screen.getByRole('button', { name: /Send/i });
    expect(sendButton).toBeDisabled();
  });

  it('should disable Clear button when input is empty', () => {
    const mockSubmit = vi.fn();
    render(<ChatInput onSubmit={mockSubmit} />);

    const clearButton = screen.getByRole('button', { name: /Clear/i });
    expect(clearButton).toBeDisabled();
  });
});
