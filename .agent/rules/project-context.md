# Project Context

## Local Development Requirements
To run the full backend environment locally, you MUST have both:
1. **Typesense**: Running via Docker (`docker-compose --env-file .env.local up -d`).
2. **Supabase**: Running via CLI (`supabase start`).

## Supabase Local Development
This project relies on the Supabase CLI for local development. 
- The local Supabase stack must be running for features like database access and Edge Functions to work locally.
- Use `supabase start` to initialize the environment.
- The local API URL and keys are typically outputted by `supabase start` and should be configured in `.env` or `.env.local` if not automatically handled by the CLI.
