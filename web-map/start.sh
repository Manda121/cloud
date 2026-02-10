#!/bin/sh
set -e

# If node_modules is missing or concurrently not installed, install deps
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/concurrently" ]; then
  echo "Installing dependencies (this may take a while)..."
  npm install --legacy-peer-deps
fi

# Prevent CRA from trying to open the browser
export BROWSER=${BROWSER:-none}

echo "Starting web-map (NODE_ENV=$NODE_ENV)..."

# Exec so signals are forwarded properly
exec npm start
