#!/bin/bash

echo "Starting VS Code extension deployment..."

cp package-vscode.json package.json
npm run compile
npx @vscode/vsce publish

echo "VS Code extension packaging complete."
echo ".vsix file generated."
echo "Upload it to the Marketplace: https://marketplace.visualstudio.com/manage"

cp package-npm.json package.json

echo "package.json restored for the npm package."