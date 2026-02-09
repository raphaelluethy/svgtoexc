# svgtoexc

`svgtoexc` is an OpenTUI app that converts SVG to Excalidraw clipboard JSON.

It supports:
- pasted SVG markup (`<svg ...>`)
- dropped SVG file paths from Finder
- auto-copy to macOS clipboard (`pbcopy`)

## Requirements

- Bun (latest stable)
- macOS (for clipboard copy integration)

## Setup

```bash
bun install
```

## Run (Local)

```bash
bun run dev
```

Or one-shot run:

```bash
bun run start
```

## Install Global Binary

After installing globally, run the command `svgtoexc` from anywhere.

### Option 1: package.json script

```bash
bun run install:global
```

Uninstall:

```bash
bun run uninstall:global
```

### Option 2: justfile

```bash
just global-install
```

Uninstall:

```bash
just global-uninstall
```

### Option 3: Makefile

```bash
make global-install
```

Uninstall:

```bash
make global-uninstall
```

If `svgtoexc` is not found after install, ensure Bun global bin is on your `PATH`:

```bash
export PATH="$HOME/.bun/bin:$PATH"
command -v svgtoexc
```

Persist it in your shell config (for zsh):

```bash
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.zshrc
```

## Usage

1. Start the app (`svgtoexc`, `bun run dev`, or `bun run start`).
2. Paste SVG markup or drag-drop an `.svg` path into the terminal.
3. Press `enter` to convert.
4. Paste directly into Excalidraw.

## Keyboard Shortcuts

- `enter`: convert current input
- `c`: copy last generated JSON again
- `r`: reset app state
- `q` or `Ctrl+C`: quit

## Development Commands

- `bun test` - run test suite
- `bun run dev` - run in watch mode
- `bunx tsc --noEmit` - type-check

## Notes

- Converter behavior is tuned against [excalidraw/svg-to-excalidraw](https://github.com/excalidraw/svg-to-excalidraw) and extended for text and marker arrows.
- Clipboard errors are shown in the UI if `pbcopy` is unavailable.
