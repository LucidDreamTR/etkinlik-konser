export function normalizeSlug(input: string) {
  return decodeURIComponent(input)
    .trim()
    .toLowerCase()
    .normalize("NFC");
}
