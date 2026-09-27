/** URL-safe slug: lowercase `[a-z0-9-]`, 3–40 chars. Falls back to `'group'`. */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  return slug.length < 3 ? 'group' : slug
}
