# CLAUDE.md - Guide for Agentic Coding Assistants

## Project Structure
- This is a Bun monorepo - use `bun` for all package management and script running
- Use `bun install` for dependencies, not npm or yarn
- Key packages: web-sdk-rs (Rust/WASM), web-core, web-sdk

## Build Commands
- Root: `bun run build` or `./scripts/build.sh` (builds all packages)
- Individual packages:
  - web-sdk-rs: `bun run build-dev` or `bun run build-release` then `bun run bundle`
  - web-core: `bun run build`
  - web-sdk: `bun run build`
- Watch changes: `bun run watch` (in web-sdk)

## Testing
- Run tests: `bun run test` (in package directory)
- Run specific test: `bun run test -- --testNamePattern="test name"`
- Run specific file: `bun run test -- path/to/file.test.ts`

## Lint & Format
- Lint: `bun run lint` (in package directory)
- Format (web-sdk-rs): `bun run fmt`
- Clean: `bun run clean` (either in root or package directory)

## Documentation
- Run docs dev server: `bun run docs:dev`
- Build docs: `bun run docs:build`
- Generate API docs: `bun run docs:generate-api`

## Code Style
- TypeScript with strict typing and comprehensive interfaces
- Follow existing naming conventions (camelCase for variables/functions, PascalCase for components/classes)
- Error handling: use try/catch blocks with descriptive error messages
- Keep code modular with clean separation of concerns
- Imports ordering: external libraries first, then internal modules
- Functional components for React with hooks
- Use JSDoc comments for public APIs
- Avoid excessive comments - code should be self-documenting