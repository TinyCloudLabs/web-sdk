#!/bin/bash

# Script to switch between GitHub Packages and npm Registry

if [ "$1" == "github" ]; then
  if [ -z "$GITHUB_PACKAGE_TOKEN" ]; then
    echo "Error: GITHUB_PACKAGE_TOKEN is not set. Please set it in your .bashrc."
    exit 1
  fi

  echo "@tinycloudlabs:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=$GITHUB_PACKAGE_TOKEN" > .npmrc
  echo "Switched to GitHub Packages for @tinycloudlabs"
elif [ "$1" == "npm" ]; then
  echo "registry=https://registry.npmjs.org/" > .npmrc
  echo "Switched to npm Registry"
else
  echo "Usage: $0 [github|npm]"
  echo "  github - Switch to GitHub Packages registry for @tinycloudlabs"
  echo "  npm    - Switch to public npm registry"
fi