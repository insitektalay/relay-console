# GitHub Repository Contents

Repository contents endpoints are powerful because they can read or write files directly.

Read rules:

- Prefer read-only contents access by default.
- Read files to understand current configuration, docs, or workflow state.
- For large changes, prefer branch-based code editing plus PR flow rather than direct writes to sensitive branches.

Write rules:

- Contents write must be explicitly enabled for this install.
- Writing workflow files, Actions configuration, or security-sensitive files should be treated as high risk.
- Deleting a file is a repository state change and needs approval at minimum; some workspace policies should block it entirely.
- Never write secrets into tracked files.
