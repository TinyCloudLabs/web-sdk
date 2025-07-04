#!/usr/bin/env bash
set -e

echo "Starting automated publish process..."

# Function to resolve workspace:* dependencies to concrete versions
resolve_workspace_dependencies() {
  echo "Resolving workspace dependencies..."
  
  node -e "
    const fs = require('fs');
    const path = require('path');
    
    try {
      // Read root package.json to get workspace configuration
      const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const workspaces = rootPkg.workspaces || [];
      
      // Build a map of package names to versions
      const packageVersions = new Map();
      
      // First pass: collect all workspace package versions
      workspaces.forEach(workspace => {
        try {
          const pkgPath = path.join(workspace, 'package.json');
          if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            packageVersions.set(pkg.name, pkg.version);
            console.log(\`Found workspace package: \${pkg.name}@\${pkg.version}\`);
          }
        } catch (e) {
          console.warn(\`Warning: Could not read package.json for workspace: \${workspace}\`);
        }
      });
      
      // Second pass: resolve workspace:* dependencies
      let totalChanges = 0;
      workspaces.forEach(workspace => {
        try {
          const pkgPath = path.join(workspace, 'package.json');
          if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            let hasChanges = false;
            
            console.log(\`Processing \${workspace}...\`);
            
            // Process each dependency type
            ['dependencies', 'devDependencies', 'peerDependencies'].forEach(depType => {
              if (pkg[depType]) {
                Object.keys(pkg[depType]).forEach(depName => {
                  if (pkg[depType][depName] === 'workspace:*') {
                    if (packageVersions.has(depName)) {
                      const version = packageVersions.get(depName);
                      pkg[depType][depName] = '^' + version;
                      console.log(\`  \${depType}.\${depName}: workspace:* -> ^\${version}\`);
                      hasChanges = true;
                      totalChanges++;
                    } else {
                      console.warn(\`  Warning: Could not resolve workspace dependency: \${depName}\`);
                    }
                  }
                });
              }
            });
            
            // Write back if there were changes
            if (hasChanges) {
              fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
              console.log(\`  Updated \${pkgPath}\`);
            }
          }
        } catch (e) {
          console.error(\`Error processing workspace \${workspace}:\`, e.message);
          process.exit(1);
        }
      });
      
      console.log(\`Workspace dependency resolution complete. \${totalChanges} dependencies resolved.\`);
    } catch (e) {
      console.error('Error resolving workspace dependencies:', e.message);
      process.exit(1);
    }
  "
}

# Resolve workspace dependencies to concrete versions
resolve_workspace_dependencies

# Create package-specific tags
echo "Creating tags for each package..."
ROOT_DIR=$(pwd)

cd "$ROOT_DIR/packages/web-core"
CORE_VERSION=$(cat package.json | grep '"version"' | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[[:space:]]')
git tag "web-core-v$CORE_VERSION"

cd "$ROOT_DIR/packages/web-sdk-rs"
SDK_RS_VERSION=$(cat package.json | grep '"version"' | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[[:space:]]')
git tag "web-sdk-rs-v$SDK_RS_VERSION"

cd "$ROOT_DIR/packages/web-sdk"
SDK_VERSION=$(cat package.json | grep '"version"' | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[[:space:]]')
git tag "web-sdk-v$SDK_VERSION"

cd "$ROOT_DIR"

# Push all tags to remote
echo "Pushing tags to remote repository..."
git push origin --tags

# Setup NPM authentication
echo "Setting up NPM authentication..."
if [ -z "$NPM_TOKEN" ]; then
  echo "ERROR: NPM_TOKEN environment variable is not set"
  exit 1
fi
./scripts/npm-auth.sh

# Switch to npm registry
echo "Switching to npm registry..."
bun run npm-pub

# Publish packages with changesets
echo "Publishing packages..."
bun changeset publish --access public

# Create GitHub draft releases for each package
echo "Creating GitHub draft releases..."

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
  echo "GitHub CLI (gh) is not installed. Skipping GitHub release creation."
else
  # Create draft release for web-core
  echo "Creating draft release for web-core v$CORE_VERSION..."
  gh release create "web-core-v$CORE_VERSION" \
    --title "Web Core v$CORE_VERSION" \
    --notes "Release notes for web-core v$CORE_VERSION" \
    --draft
  
  # Create draft release for web-sdk-rs
  echo "Creating draft release for web-sdk-rs v$SDK_RS_VERSION..."
  gh release create "web-sdk-rs-v$SDK_RS_VERSION" \
    --title "Web SDK RS v$SDK_RS_VERSION" \
    --notes "Release notes for web-sdk-rs v$SDK_RS_VERSION" \
    --draft
  
  # Create draft release for web-sdk
  echo "Creating draft release for web-sdk v$SDK_VERSION..."
  gh release create "web-sdk-v$SDK_VERSION" \
    --title "Web SDK v$SDK_VERSION" \
    --notes "Release notes for web-sdk v$SDK_VERSION" \
    --draft
fi

echo "Publish completed successfully!"
echo "The following packages were released:"
echo "- @tinycloudlabs/web-core@$CORE_VERSION"
echo "- @tinycloudlabs/web-sdk-wasm@$SDK_RS_VERSION"
echo "- @tinycloudlabs/web-sdk@$SDK_VERSION"