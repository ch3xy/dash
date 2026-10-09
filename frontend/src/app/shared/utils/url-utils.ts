/** Turns a user-entered website ("acme.com") into an absolute link target. */
export function websiteHref(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}
