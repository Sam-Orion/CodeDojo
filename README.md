# CodeDojo

A real-time collaborative IDE powered by Express, WebSockets, and Monaco Editor. Multiple users can join a room and edit code together with live synchronization and cursor preservation.

## 📋 Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Workspace Commands](#workspace-commands)
- [Development Workflow](#development-workflow)
- [Configuration](#configuration)
- [Contributing](#contributing)

## 🎯 Overview

CodeDojo provides a lightweight, real-time collaborative coding environment. Users can:

- Join collaborative sessions by entering a Room ID
- Edit code in real-time with Monaco Editor
- See code updates from other connected users
- Maintain cursor position when receiving remote changes
- Share sessions with multiple collaborators

## 🛠 Technology Stack

### Backend

- **Express 5** - HTTP server framework
- **Node.js 20+** - Runtime
- **ws** - WebSocket library for real-time communication

### Frontend

- **Monaco Editor** - Full-featured code editor (via CDN)
- **Tailwind CSS** - Styling (via CDN)
- **HTML5 WebSocket API** - Real-time client connection

### Development & Tooling

- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Husky** - Git hooks
- **lint-staged** - Run linters on staged files

## 📁 Project Structure

This is an npm workspaces monorepo with the following structure:

```
codedojo/
├── server/                 # Backend package
│   ├── src/
│   │   ├── index.js       # Main server entry point
│   │   └── routes.js      # API routes
│   ├── tests/             # Server tests
│   ├── package.json       # Server dependencies
│   ├── .eslintrc.json     # Server linting config
│   └── README.md          # Server documentation
├── client/                 # Frontend package
│   ├── src/
│   │   ├── public/        # Static assets (HTML, CSS, JS)
│   │   ├── editor.js      # Monaco editor module
│   │   └── websocket.js   # WebSocket client module
│   ├── tests/             # Client tests
│   ├── package.json       # Client dependencies
│   ├── .eslintrc.json     # Client linting config
│   └── README.md          # Client documentation
├── package.json           # Root workspace config
├── .nvmrc                 # Node version specification
├── .env.example           # Example environment variables
├── .editorconfig          # Editor configuration
├── .eslintrc.json         # Root ESLint config
├── .eslintignore          # ESLint ignore patterns
├── .prettierrc             # Prettier configuration
├── .prettierignore        # Prettier ignore patterns
├── .lintstagedrc.json     # Lint-staged configuration
├── .gitignore             # Git ignore patterns
└── README.md              # This file
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20.0.0 or higher
- npm 10.0.0 or higher

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd codedojo
```

2. Check Node version (optional but recommended):

```bash
nvm use
# or manually: node --version
```

3. Install dependencies for all workspaces:

```bash
npm install
```

This installs dependencies for the root, server, and client packages.

### Environment Setup

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Update `.env` with your configuration:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/codedojo
# ... other variables as needed
```

### Running the Application

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## 📦 Workspace Commands

All commands can be run from the root directory:

### Development

```bash
# Start development server
npm run dev

# Format code across all workspaces
npm run format

# Check formatting without changes
npm run format:check

# Lint code across all workspaces
npm run lint

# Run tests across all workspaces
npm run test
```

### Building

```bash
# Build all workspaces
npm run build
```

### Workspace-Specific Commands

To run commands in a specific workspace:

```bash
# Server commands
npm run dev -w server
npm run lint -w server
npm run format -w server

# Client commands
npm run dev -w client
npm run lint -w client
npm run format -w client
```

## 🔄 Development Workflow

### Code Style

This project uses Prettier and ESLint to maintain consistent code style:

- **Prettier** handles formatting (indentation, semicolons, quotes, etc.)
- **ESLint** catches potential bugs and enforces best practices
- **Husky** runs git hooks to check code before commits
- **lint-staged** only lints files that are staged for commit

### Pre-commit Hooks

The following checks run automatically before commit:

1. ESLint validation
2. Prettier formatting

If checks fail, your commit will be blocked. Fix issues and stage changes again:

```bash
npm run lint
npm run format
git add .
git commit -m "Your message"
```

### Adding Dependencies

To add a dependency to a specific workspace:

```bash
# Add to server
npm install package-name -w server

# Add to client
npm install package-name -w client

# Add to root (shared dev dependencies)
npm install package-name --workspace-root --save-dev
```

## ⚙️ Configuration

### Environment Variables

See `.env.example` for available options. Cloud compute and LLM provider keys are optional—add them only when you plan to enable those integrations.

**Server Configuration:**

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment type (development, production)

**Database:**

- `MONGODB_URI` - MongoDB connection string

**OAuth:**

- `OAUTH_CLIENT_ID` - OAuth provider client ID
- `OAUTH_CLIENT_SECRET` - OAuth provider client secret
- `OAUTH_REDIRECT_URI` - OAuth redirect URL

**Cloud & AI Services (optional):**

- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `AWS_REGION` - AWS region
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key

**Client Configuration:**

- `VITE_API_URL` - API base URL
- `VITE_WS_URL` - WebSocket URL

### Editor Configuration

The `.editorconfig` file ensures consistent editor settings across the team:

- UTF-8 encoding
- LF line endings
- 2-space indentation for code files
- Auto-trimming trailing whitespace

## 📝 Contributing

### Code Standards

1. **Format code** before committing:

   ```bash
   npm run format
   ```

2. **Check for linting issues**:

   ```bash
   npm run lint
   ```

3. **Follow existing patterns** in the codebase

4. **Write meaningful commit messages**

### Adding Features

1. Create a feature branch
2. Make your changes
3. Ensure linting and formatting pass
4. Commit with descriptive message
5. Submit a pull request

### Testing

Run tests for all workspaces:

```bash
npm run test
```

Run tests for specific workspace:

```bash
npm run test -w server
npm run test -w client
```

## 📄 License

ISC License - see LICENSE file for details

## 🤝 Support

For issues, questions, or contributions, please open an issue or pull request on the repository.

---

**Happy coding with CodeDojo! 🚀**
