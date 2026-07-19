#!/bin/zsh
set -u

PROJECT_ROOT=${0:A:h}
cd "$PROJECT_ROOT"

echo "=== Python version ==="
python3 --version

echo "=== Port 5001 status ==="
if command -v lsof >/dev/null 2>&1 && lsof -ti :5001 >/dev/null; then
  echo "Port 5001 IN USE"
else
  echo "Port 5001 free"
fi

echo "=== Syntax check ==="
if python3 -m py_compile app.py; then
  echo "app.py OK"
else
  echo "app.py SYNTAX ERROR"
fi

echo "=== Import check ==="
python3 -c "import flask, sympy, numpy; print('imports OK')" 2>&1 || true

echo "=== Missing packages ==="
python3 -m pip check 2>&1 | head -20 || true

echo "=== Frontend toolchain ==="
node --version
npm --version
if [[ -d frontend/node_modules ]]; then
  npm --prefix frontend run lint
else
  echo "frontend/node_modules missing"
fi
