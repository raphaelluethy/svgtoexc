set shell := ["bash", "-cu"]

install:
  bun install

dev:
  bun run dev

test:
  bun test

global-install:
  bun add -g "svgtoexc@file:$PWD"

global-uninstall:
  bun remove -g svgtoexc
