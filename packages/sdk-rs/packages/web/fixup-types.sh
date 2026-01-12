#!/bin/sh
# Fix type declarations for web-sdk-wasm
# The WASM output is at ../../web-sdk-wasm/
cp ../../web-sdk-wasm/tinycloud_web_sdk_rs.d.ts dist/

# Create temp script file for bun compatibility (bun's node wrapper doesn't support stdin)
TEMP_SCRIPT=$(mktemp)
cat > "$TEMP_SCRIPT" << 'SCRIPT_EOF'
var fs = require("fs");
const re = new RegExp("\\.\\./\\.\\./\\.\\./web-sdk-wasm", "g");
const dist = fs.opendirSync("./dist");
while (true) {
  const entry = dist.readSync();
  if (!entry) {
    break;
  }
  if (entry.isFile() && entry.name.endsWith(".d.ts")) {
    let filepath = "./dist/" + entry.name;
    let file = fs.readFileSync(filepath, { encoding: "utf8" });
    let replaced = file.replace(re, ".");
    fs.writeFileSync(filepath, replaced);
  }
}
SCRIPT_EOF

node "$TEMP_SCRIPT"
rm -f "$TEMP_SCRIPT"
