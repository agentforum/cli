export function copyToClipboard(text: string): void {
  const osc52 = `\x1b]52;c;${Buffer.from(text).toString("base64")}\x07`;
  process.stdout.write(osc52);
}
