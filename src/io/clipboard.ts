export async function copyToClipboard(text: string): Promise<void> {
  if (process.platform !== "darwin") {
    throw new Error("Clipboard integration currently supports macOS only (pbcopy).");
  }

  const processResult = Bun.spawn(["pbcopy"], {
    stdin: "pipe",
    stdout: "ignore",
    stderr: "pipe",
  });

  processResult.stdin.write(text);
  processResult.stdin.end();

  const exitCode = await processResult.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(processResult.stderr).text();
    const errorOutput = stderr.trim();
    throw new Error(
      errorOutput
        ? `pbcopy failed: ${errorOutput}`
        : "pbcopy failed with a non-zero exit code.",
    );
  }
}
