# CodeDojo Client

Real-time collaborative IDE frontend built with Vite, React, TypeScript, and Redux Toolkit.

## Features

- **Modern React 18** with TypeScript support
- **Redux Toolkit** for state management with DevTools integration
- **Vite** for fast development and optimized builds
- **Path aliases** for clean imports (@components, @hooks, @utils, etc.)
- **Responsive design** with mobile support
- **Type-safe** development with strict TypeScript configuration

## Development

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0

### Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start development server:

   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint with TypeScript support
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## Project Structure

```
src/
├── components/     # Reusable React components
├── hooks/         # Custom React hooks
├── pages/         # Page components
├── store/         # Redux store configuration
│   └── slices/    # Redux Toolkit slices
├── styles/        # CSS and styling
├── types/         # TypeScript type definitions
├── utils/         # Utility functions
└── vite-env.d.ts  # Vite environment types
```

## Redux Store

The application uses Redux Toolkit with the following slices:

- **auth** - User authentication and session management
- **collaboration** - Real-time collaboration features
- **files** - File system and file operations
- **terminal** - Terminal session management
- **ai** - AI assistant features

## API Integration

- Axios-based API client with automatic token handling
- WebSocket manager for real-time features
- Error handling and retry logic
- Type-safe API responses

## Environment Variables

See `.env.example` for available environment variables:

- `VITE_API_BASE_URL` - Backend API URL
- `VITE_WS_URL` - WebSocket URL
- `VITE_ENABLE_*` - Feature flags

## Build Configuration

- **TypeScript** with strict mode enabled
- **ESLint** with React and TypeScript rules
- **Prettier** for consistent code formatting
- **Path aliases** configured for clean imports
- **Proxy** setup for API requests during development

## Deployment

The build outputs to `dist/` directory and can be deployed to any static hosting service.

## Browser Support

- Chrome >= 87
- Firefox >= 78
- Safari >= 14
- Edge >= 88
