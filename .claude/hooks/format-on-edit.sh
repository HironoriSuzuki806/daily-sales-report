#!/bin/sh
# PostToolUse (Write|Edit) — run Prettier then ESLint --fix on the edited file.
FILE=$(jq -r '.tool_input.file_path // empty')
[ -z "$FILE" ] || [ ! -f "$FILE" ] && exit 0

npx prettier --write --ignore-unknown "$FILE" 2>/dev/null

case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx)
    npx eslint --fix "$FILE" 2>/dev/null
    ;;
esac
