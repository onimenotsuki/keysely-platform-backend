# AGENTS.md

## Project Overview
Keysely Platform Backend: A Supabase-based backend with Node.js tooling.

## Setup Commands
- Install dependencies: `npm install`
- Start Typesense: `docker-compose --env-file .env.local up -d`
- Start Supabase: `supabase start`
- Lint code: `npm run lint`
- Format code: `npm run format`

## Development Workflow
- **Commit changes**: `npm run commit` (Interactive CLI)
- **Check status**: `npm run lint`

## Code Style
- **TypeScript**: Strict mode.
- **Linter**: ESLint (Airbnb Base).
- **Formatter**: Prettier (Single quotes, trailing commas).

## Architecture
- **Root**: Node.js environment for tooling/scripts.
- **`supabase/functions`**: Deno environment for backend logic (Edge Functions).

## Key Files
- `package.json`: Scripts and dev dependencies.
- `.eslintrc.json`: Linting rules (ignores `supabase/functions`).
- `supabase/config.toml`: Supabase project configuration.

## Maintenance
> **CRITICAL**: Update this file and `.agent/rules/project-context.md` whenever significant changes are made to the project architecture, tech stack, or coding standards.
