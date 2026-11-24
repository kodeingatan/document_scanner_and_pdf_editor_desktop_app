/** Strips characters that are illegal in Windows file names and caps the length. */
export function sanitizeFileName(input: string): string {
  const cleaned = input
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  return (cleaned || 'dokumen').slice(0, 120);
}

export function uniqueSuffix(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
