# ChatInput Component

## Overview

The `ChatInput` component is a user input component designed for chat messages. It provides a clean, accessible interface for users to compose and send messages with support for multi-line input.

## Features

- ✅ **Multi-line textarea input** - Auto-resizes as users type
- ✅ **Submit button** - With loading state support
- ✅ **Clear button** - Quickly empty the input field
- ✅ **Character counter** - Display-only character count (no limit enforcement)
- ✅ **Keyboard shortcuts**:
  - `Enter` - Submit message
  - `Shift+Enter` - Add newline
- ✅ **Disabled state** - Support for loading and disabled states
- ✅ **Dark mode support** - Follows Tailwind dark mode conventions
- ✅ **Accessibility** - Proper ARIA labels and keyboard navigation

## Usage

### Basic Example

```tsx
import ChatInput from './components/chat/ChatInput';

function MyComponent() {
  const handleSubmit = (message: string) => {
    console.log('Message submitted:', message);
    // Handle message submission
  };

  return <ChatInput onSubmit={handleSubmit} />;
}
```

### With Loading State

```tsx
import { useState } from 'react';
import ChatInput from './components/chat/ChatInput';

function MyComponent() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (message: string) => {
    setIsLoading(true);
    try {
      // Send message to API
      await sendMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  return <ChatInput onSubmit={handleSubmit} isLoading={isLoading} />;
}
```

### With Disabled State

```tsx
import ChatInput from './components/chat/ChatInput';

function MyComponent() {
  const isDisabled = !isConnected; // Example condition

  return <ChatInput onSubmit={handleSubmit} disabled={isDisabled} />;
}
```

## Props

| Prop        | Type                        | Default  | Description                                          |
| ----------- | --------------------------- | -------- | ---------------------------------------------------- |
| `onSubmit`  | `(message: string) => void` | Required | Callback function called when user submits a message |
| `isLoading` | `boolean`                   | `false`  | When true, shows loading state and disables input    |
| `disabled`  | `boolean`                   | `false`  | When true, disables the input and buttons            |

## Behavior

### Input Handling

- The component maintains its own internal state for the input value
- Text is trimmed before being passed to the `onSubmit` callback
- Empty or whitespace-only messages cannot be submitted
- Input is automatically cleared after successful submission

### Auto-resize

- The textarea automatically grows in height as the user types
- Maximum height is set to 200px, after which scrolling is enabled
- Height resets when input is cleared or submitted

### Button States

- **Send Button**:
  - Disabled when input is empty or contains only whitespace
  - Disabled during loading state
  - Shows loading spinner when `isLoading` is true
- **Clear Button**:
  - Disabled when input is empty
  - Disabled during loading state
  - Clears input and returns focus to textarea

## Styling

The component uses Tailwind CSS for styling and supports:

- Light and dark modes
- Responsive design
- Focus states for accessibility
- Hover states for interactive elements

### Customization

The component uses standard Tailwind classes. To customize styling, you can:

1. Override the Tailwind configuration
2. Use custom CSS classes
3. Modify the component's className props directly

## Testing

The component includes comprehensive test coverage:

```bash
npm test -- ChatInput.test.tsx
```

Test cases cover:

- ✅ Rendering input field and buttons
- ✅ Character counting
- ✅ Submit functionality
- ✅ Clear functionality
- ✅ Keyboard shortcuts (Enter, Shift+Enter)
- ✅ Loading state
- ✅ Disabled state
- ✅ Empty/whitespace validation
- ✅ Input clearing after submission

## Accessibility

- All interactive elements have proper ARIA labels
- Keyboard navigation is fully supported
- Focus management is handled correctly
- Placeholder text provides clear instructions

## Browser Support

Compatible with all modern browsers that support:

- ES6+ JavaScript
- CSS Grid and Flexbox
- React 18+

## Demo

A demo page is available at `/chat-input-demo` (when authenticated) to test all component features and states interactively.
