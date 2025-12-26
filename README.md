# Keysely Platform Backend

Backend services for the Keysely platform, powered by Supabase and Supabase Edge Functions.

## 🚀 Getting Started

### Prerequisites
- Node.js (for tooling)
- Supabase CLI
- Deno (for local function testing)

### Installation
```bash
npm install
```

## 🛠 Development

This project uses a strict set of tools to ensure code quality:

### Linting & Formatting
- **Lint**: `npm run lint` (ESLint + Airbnb)
- **Format**: `npm run format` (Prettier)

### Committing
**Important**: Use Commitizen for all commits to ensure standard commit messages.
```bash
npm run commit
```
*Do not use `git commit` directly unless you are sure of the convention.*

### Git Hooks
- **Pre-commit**: Automatically fixes formatting and linting errors on staged files.
- **Pre-push**: Runs a full project lint to prevent bad code from being pushed.

## 🤖 AI Agents
Refer to [AGENTS.md](./AGENTS.md) for agent-specific instructions.
Project rules are defined in `.agent/rules/project-context.md`.

> **Important**: Both `AGENTS.md` and standard rules MUST be updated whenever there are significant changes to the project architecture or coding standards.

## 📂 Structure
- `/`: Node.js root (Tooling, Scripts)
- `supabase/`: Supabase configuration and Edge Functions
