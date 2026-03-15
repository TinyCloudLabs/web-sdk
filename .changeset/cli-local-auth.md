---
"@tinycloud/cli": patch
---

Add local Ethereum key authentication to `tc auth login`. Users can now choose between OpenKey (browser-based) and local key (Ethereum private key) auth methods. Local key auth generates a `did:pkh` identity and signs in directly without a browser, making it suitable for agents, CI/CD, and headless environments. Use `--method local` to skip the interactive prompt.
