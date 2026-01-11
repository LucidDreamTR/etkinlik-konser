export function normalizeSlug(input: string) {
  return decodeURIComponent(input)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .normalize("NFC");
}
