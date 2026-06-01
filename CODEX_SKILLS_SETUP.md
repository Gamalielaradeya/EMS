# Codex Skills Setup — EMS Thermal LSTM

This file is optional. Use it if the development environment supports Codex-compatible skills.

## Recommended Skills

### 1. Caveman

Purpose: compact progress reports and code review comments.

Use for:

- Progress summaries.
- Diff review.
- Bug notes.
- Command result summaries.

Do not use for:

- Source code text.
- User-facing UI text.
- Thesis documentation.
- README content.

### 2. Hallmark

Purpose: stronger frontend/UI design discipline.

Use for:

- Dashboard layout.
- Sensor cards.
- Prediction & LSTM page.
- Layout page.
- Events & Logs page.
- Settings page.

Do not use Hallmark to make the project look like a landing page. The UI must remain a professional EMS dashboard.

## Install Examples

Verify the package/source before installing third-party skills.

```bash
# Hallmark
npx skills add nutlope/hallmark

# Caveman source varies by skill registry.
# If available in your toolchain, install the Codex-compatible caveman skill.
```

## AGENTS.md Integration

`AGENTS.md` already includes fallback behavior:

- Compact reporting even without Caveman.
- Hallmark-style UI quality rules even without Hallmark.

Skills improve consistency, but they do not replace the project documentation in `Dokumentasi/`.
