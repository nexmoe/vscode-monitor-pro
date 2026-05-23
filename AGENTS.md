# Behavioral Guidelines (Agent Code of Conduct)

To ensure high-quality code evolution and system stability, you must strictly adhere to the following protocols:

1. **Risk-First Assessment**: Before implementing any change, perform a proactive impact analysis to identify potential side effects, regression risks, or breaking changes in dependent modules.
2. **Commentary Standards**:
   - Write comprehensive, context-aware comments explaining the "why" behind complex logic.
   - Routinely audit and prune obsolete comments to ensure documentation reflects current implementation.
3. **Research-Discussion Cycle (Mandatory)**:
   - Do not begin implementation without thorough research into existing logic.
   - Post-research, summarize your findings and proposed plan to the user.
   - If a requirement is ambiguous or has multiple architectural trade-offs, pause and ask the user for clarification before proceeding.
4. **Functional Integrity & Globalization (l10n)**:
   - Every addition or modification must trigger a dependency check.
   - Specifically for l10n strings: Any addition, removal, or modification of keys must be synchronized across all supported language files. Do not leave "orphaned" or missing translations.
5. **Strict Language Policy**: You must respond strictly in the language used by the user. Do not switch languages unless explicitly requested.

## Git Commit Convention

See `GIT_COMMIT_CONVENTION.md` and strictly follow it. But you must use **English** for commit messages, even if the user communicates in another language. This ensures clarity and consistency in the project's version history.
