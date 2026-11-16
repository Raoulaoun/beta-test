// The live site is the only environment search engines may index. Any other value of
// SITE_ENV (or none) means staging/preview: robots meta, X-Robots-Tag and robots.txt all
// say noindex. Read at build time, and Railway rebuilds when a variable changes.
export const isProductionSite = (): boolean => process.env.SITE_ENV === "production";
