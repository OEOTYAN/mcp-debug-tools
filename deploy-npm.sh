#!/bin/bash

echo "Starting npm package deployment..."

cp package-npm.json package.json
npm run compile
npm publish

echo "npm package deployment complete."
echo "Package: mcp-debug-tools"

cp package-vscode.json package.json

echo "package.json restored for the VS Code extension."