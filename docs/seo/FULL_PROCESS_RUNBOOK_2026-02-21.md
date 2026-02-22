# Full SEO Process Runbook (February 21, 2026)

## One-Time Setup
1. Verify domain + submit sitemap in Google Search Console.
2. Ensure production robots/sitemap are reachable.
3. Confirm all SEO hubs and detail routes render correctly.

## Weekly Operations
1. Run: `npm run seo:ops`
2. Open audit report: `reports/seo/audit-latest.md`
3. Execute indexing batches from: `reports/seo/indexing-queue-latest.csv`
4. Execute outreach plan from: `reports/seo/backlink-plan-latest.md`
5. Publish new cluster pages and interlink them.

## Monthly Operations
1. Review Search Console cluster performance.
2. Refresh titles/meta for low CTR pages with high impressions.
3. Expand internal links between high-performing and low-performing clusters.
4. Add new pages for rising query themes.

## Commands
- Generate sitemap: `npm run sitemap:generate`
- SEO audit: `npm run seo:audit`
- Indexing queue: `npm run seo:indexing-queue`
- Backlink plan: `npm run seo:backlink-plan`
- Internal link graph check: `node scripts/check-link-graph.mjs`
- Full SEO ops: `npm run seo:ops`

## Success Criteria
- Indexed URLs trend upward each month.
- Non-brand organic clicks grow in at least 3 core clusters.
- Referring domains grow with topical relevance.
- Organic trial starts and signup rate improve.
