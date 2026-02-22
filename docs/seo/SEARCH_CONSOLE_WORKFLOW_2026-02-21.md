# Search Console Workflow (February 21, 2026)

## Initial Setup
1. Verify domain property in Google Search Console for `https://homeharmony.app`.
2. Submit sitemap: `https://homeharmony.app/sitemap.xml`.
3. Confirm crawl access via robots tester.

## Indexing Operations (Weekly)
1. Run `npm run seo:ops`.
2. Open `reports/seo/indexing-queue-latest.csv`.
3. Submit or inspect URLs by batch priority:
   - P0 first (home/resources/hubs)
   - P1 second (feature-led pages)
   - P2 third (long-tail pages)
4. Track statuses: indexed, discovered-not-indexed, crawled-not-indexed.

## Query Optimization Loop (Weekly)
1. Export Search Console query data by page group.
2. Identify pages with impressions but low CTR.
3. Update title + meta description to align with top queries.
4. Refresh intro copy and FAQ to mirror user phrasing.

## Coverage Triage Rules
- If “Discovered - currently not indexed”: improve internal links to that URL and resubmit.
- If “Crawled - currently not indexed”: strengthen uniqueness and tighten search intent fit.
- If duplicates appear: normalize canonical strategy and consolidate overlapping pages.

## Monthly Review
- Compare indexed URL count to sitemap URL count.
- Review cluster-level performance and prioritize next content batches by query traction.
