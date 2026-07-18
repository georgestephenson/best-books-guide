import type { CatalogueRepository, SitemapSlugs } from '../ports/catalogue-repository.js';

/** Public slugs for sitemap.xml (docs/04) — every URL a crawler should see. */
export class GetSitemap {
  constructor(private readonly catalogue: CatalogueRepository) {}

  execute(): Promise<SitemapSlugs> {
    return this.catalogue.sitemapSlugs();
  }
}
