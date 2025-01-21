# web-sdk-wasm

WebAssembly library written in Rust for @tinycloud/web-sdk.

This package uses `rollup` in order to encode the `.wasm` as a base64-encoded string,
meaning there is no configuration needed downstream to support WebAssembly
(other than a compatible browser).

## Building

### Requirements:
* [rust](https://www.rust-lang.org/tools/install)
* [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)
* [yarn](https://yarnpkg.com/getting-started/install)
* [nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

### Setup

Install node and dependencies:
```bash
nvm use
yarn install
```

### Building
For development builds run:
```bash
yarn dev
```

For optimised release builds run:
```bash
yarn release
```

On build completion the package will be at `./`.
