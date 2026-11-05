#!/usr/bin/env bash
# Keep each application check independent and preserve its failure status.
set -euo pipefail
check="$1"
if node -e 'process.exit(require("./package.json").scripts?.[process.argv[1]] ? 0 : 1)' "$check"; then
  if pnpm "$check"; then
    echo 'result=Passed' >> "$GITHUB_OUTPUT"
  else
    status=$?
    echo 'result=Failed' >> "$GITHUB_OUTPUT"
    exit "$status"
  fi
else
  echo 'result=Skipped (script absent)' >> "$GITHUB_OUTPUT"
  if [[ "$check" == test ]]; then
    echo '::notice title=Tests not configured::No test script is configured; no tests were run.'
    {
      echo '## Tests not configured'
      echo "No \`test\` script is configured in \`package.json\`; no tests were run."
    } >> "$GITHUB_STEP_SUMMARY"
  else
    echo "::notice title=Frontend check not configured::No $check script is configured; check skipped."
  fi
fi
