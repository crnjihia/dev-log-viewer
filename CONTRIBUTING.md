# Contributing to Dev Log Viewer

Habari! Welcome to the Dev Log Viewer project, developed by Chris Njihia in Nairobi, Kenya. We welcome contributions that maintain the high-performance, bounded-memory, and honesty standards of this project.

## Development Workflow

1. **Prerequisites**:
   - Rust stable (1.90+)
   - Node.js (20+ LTS) and `pnpm` (or `npm`)
   - Tauri prerequisites for your OS (see [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/))

2. **Branching & Commits**:
   - Branch from `main`.
   - Use [Conventional Commits](https://www.conventionalcommits.org/) format (`feat(scope): ...`, `fix(scope): ...`, `docs(scope): ...`).

3. **Code Quality Rules**:
   - Rust code must pass `cargo fmt --check` and `cargo clippy --workspace -- -D warnings`.
   - TypeScript must pass strict typechecking: `pnpm run lint`.
   - Tests must pass cleanly: `cargo test --workspace` and `pnpm test`.
   - Never commit fabricated benchmark numbers. Use the provided benchmark templates with `___` placeholders until verified by a human operator.

4. **Security & Privacy**:
   - All sample and test logs must use synthetic data.
   - Do not commit real phone numbers, real API keys, or real M-Pesa receipts.

