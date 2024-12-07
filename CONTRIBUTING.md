# Contributing to electron-trpc

We welcome contributions from the community. This guide assumes you're familiar with Git, GitHub, and pnpm.

## Quick Start

1. Fork and clone the repository
2. Install dependencies: `pnpm install`
3. Create a new branch for your feature
4. Make changes and commit
5. Run tests: `pnpm test`
6. Create a changeset: `pnpm changeset`
7. Push to your fork and submit a pull request

## Monorepo Structure

This project uses a pnpm monorepo structure. The main directories are:

- `examples/`: Contains examples of various use-cases and serves as the basis for e2e tests
- `packages/`: Houses the main electron-trpc package

## Scripts

These are the most likely scripts you'll want to use during development:

- `pnpm install`: Install dependencies for all packages
- `pnpm test`: Run tests across all packages
- `pnpm test:e2e`: Run end-to-end tests
- `pnpm build`: Build all packages
- `pnpm changeset`: Create a changeset for your changes

## Reporting Issues

Open an issue on GitHub for bugs or suggestions.

## License

By contributing, you agree that your contributions will be licensed under the project's [LICENSE](LICENSE) file.
