# CLAUDE.md - Guide for Agentic Coding Assistants

## Build Commands
- Root: `bun run build` or `./scripts/build.sh` (builds all packages)
- Web SDK packages:
  - web-sdk-rs: `bun run build-dev` or `bun run build-release` then `bun run bundle`
  - web-core: `bun run build`
  - web-sdk: `bun run build`

## Testing
- Run tests: `bun run test` (in package directory)
- Example: `cd packages/web-sdk && bun run test`

## Lint & Format
- Lint: `bun run lint` (in package directory)
- Format (web-sdk-rs): `bun run fmt`
- Clean: `bun run clean` (either in root or package directory)

## Code Style
- TypeScript with strict typing
- Use functional components for React
- Follow existing naming conventions (camelCase for variables/functions, PascalCase for components/classes)
- Error handling: use try/catch blocks with descriptive error messages
- Keep code modular with clean separation of concerns
- Follow existing import order: external libraries first, then internal modules
- Inline documentation for complex logic