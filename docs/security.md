# Security Guidance

## Pre-Commit Suggestion
Add a pre-commit hook to run the secret scan:

```bash
#!/usr/bin/env bash
npm run security:check
```

Save as `.git/hooks/pre-commit` and make it executable:

```bash
chmod +x .git/hooks/pre-commit
```

## Notes
- The scan excludes `docs/` and `examples/`.
- Do not commit `.env.local` or other local env files.
