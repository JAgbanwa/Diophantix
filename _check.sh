#!/bin/zsh
set -euo pipefail

PROJECT_ROOT=${0:A:h}
cd "$PROJECT_ROOT"

python3 -m py_compile app.py rational_search.py
python3 -m unittest discover -s tests -v

if [[ ! -d frontend/node_modules ]]; then
  echo "frontend/node_modules is missing; run 'cd frontend && npm ci' first." >&2
  exit 1
fi

cd frontend
npm run build
