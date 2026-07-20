# Rotas Workspace Rules

- **English Language Requirement**: Regardless of the language used by the user, you (the agent) MUST ALWAYS respond in English.

- **Changelog Requirement**: For each newly finished feature, you (the agent) must always update the `CHANGELOG.md` file, documenting the functionality before completing the task.

- **Versioning Requirement**: Whenever you update `CHANGELOG.md` with a new feature or fix and commit directly to `main`, you must also release a new version via the command `pnpm version <major|minor|patch> -m "..."` respecting Semantic Versioning (SemVer), and then push with tags (`git push origin main --tags`). If the work is bundled in a PR (Pull Request), this changelog update and version bump process must also be part of the PR flow before integrating it.

- **Localization Requirement**: When creating or modifying features with user-visible text, you must always extract and use localized strings (i18n) through the `react-i18next` library. All keys must be registered in the dictionary files in `src/i18n/locales/` (`en-US.json`, `pt-BR.json`, and `es-ES.json`). NEVER use hardcoded strings directly in the components. ALWAYS translate the texts; we cannot send a product to production with broken or half-finished languages.

- **Database Migrations Requirement**: Any and all changes to the database (new tables, columns, functions, etc.) MUST ALWAYS follow the Supabase migrations standard. You must always create a new `.sql` file with a timestamp (format `YYYYMMDDHHMMSS_migration_name.sql`) in the `supabase/migrations/` folder documenting the change, and NEVER alter schemas directly via loose commands or overwriting old files. To apply migrations in production or linked environments, use the `pnpm run db:push` or `pnpm run db:migrate` scripts.

- **Local Troubleshooting Requirement**: When helping to debug stuck queues (pgmq) or permission issues (such as 42501 errors in local tables) during local development with Supabase, recommend and use the command `npx supabase db reset`. This clears defective database states and ensures the clean re-application of permissions and migrations, which usually resolves background execution failures.
