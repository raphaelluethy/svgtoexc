.PHONY: install dev test global-install global-uninstall

install:
	bun install

dev:
	bun run dev

test:
	bun test

global-install:
	bun add -g "svgtoexc@file:$$PWD"

global-uninstall:
	bun remove -g svgtoexc
