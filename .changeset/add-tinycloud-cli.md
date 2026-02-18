---
"@tinycloud/cli": minor
---

Add @tinycloud/cli package - command-line interface for TinyCloud

New CLI (`tc`) wrapping @tinycloud/node-sdk with full command support:
- `tc init` / `tc auth` - Profile setup and OpenKey browser authentication
- `tc kv get|put|delete|list|head` - Key-value operations with binary/stdin/pipe support
- `tc space list|create|info|switch` - Space management
- `tc delegation create|list|info|revoke` - Capability delegation management
- `tc share create|receive|list|revoke` - Portable sharing with web link generation
- `tc node health|version|status` - Node monitoring
- `tc profile list|create|show|switch|delete` - Named profile management
- `tc completion bash|zsh|fish` - Shell completions

Features: JSON-first output, named profiles (~/.tinycloud/), full pipe support, structured exit codes, TTY-aware spinners.
