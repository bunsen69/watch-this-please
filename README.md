# eBay Listing SEO Optimizer

A lightweight desktop app (Electron) that helps you improve the SEO of your
eBay listings before you publish them — title scoring, keyword gap
suggestions, and description quality checks, all evaluated against eBay
search (Cassini) best practices.

It is a native desktop window, not a website — nothing is uploaded to a
server, and all analysis runs locally on your machine.

## Getting your listing data in

Three ways to load a listing, no eBay Developer API keys required:

1. **Paste a link** — paste a public `ebay.com/itm/...` URL and click Fetch.
   The app does a best-effort scrape of the public listing page (title,
   description, item specifics). eBay's page markup changes often and can
   block automated requests, so treat this as a shortcut, not a guarantee —
   if it fails or looks wrong, fall back to Manual Entry.
2. **Manual entry** — paste or type the title, description, and item
   specifics yourself. Always works.
3. **Import CSV** — import a CSV exported from eBay Seller Hub (or your own).
   It needs a `Title` column (an optional `Description` column); any other
   columns are treated as item specifics (e.g. `Brand`, `Size`, `Color`).

## What it checks

- **Title**: character-limit usage (eBay's 80-char cap), ALL CAPS, spammy
  filler phrases (e.g. "L@@K", "must see"), keyword stuffing, special
  characters, and missing item-specific values that aren't reflected in the
  title.
- **Keyword suggestions**: heuristic gap analysis — item specifics missing
  from the title, missing condition terms, common buyer synonyms, and
  thin/low-keyword titles. This is not live search-volume data, just
  eBay SEO best practices encoded as rules.
- **Description**: length, policy-risk content (off-eBay links, emails,
  phone numbers — these can get a listing suppressed or removed), wall-of-text
  formatting, ALL CAPS, and how well title keywords are echoed in the body.

## Load test

A second view (switch via the nav at the top) for testing infrastructure *you
own or are explicitly authorized to test* — e.g. checking whether your rate
limiter, load balancer, or WAF actually holds up under a burst of requests.
It has nothing to do with eBay listings: `ebay.com` targets are refused
outright.

Starting a run requires typing the target's hostname into a confirmation
field (not just checking a box) so a run can't be started by accident. It
sends up to 3,333 GET requests (concurrency and per-request timeout are
configurable, capped at 200 concurrent) and reports how the target responded
— successes, 4xx/5xx, connection refusals/resets, and timeouts — since those
are the signals that actually indicate whether something is throttling or
blocking the traffic. Every run is logged (target, parameters, and result
counts) to `runs.log` in the app's user-data directory as a local audit
trail.

## Running it

```bash
npm install
npm start
```

## Project structure

```
main.js                     Electron main process (window, IPC handlers)
preload.js                  Secure IPC bridge exposed to the renderer
src/ebay/fetchListing.js    Best-effort scraper for a pasted eBay listing URL
src/csv/parseCsv.js         Minimal CSV parser for Seller Hub-style exports
renderer/                   UI (HTML/CSS/JS) and the local SEO analysis engine
renderer/analysis/          Title, keyword, and description scoring logic
src/loadtest/runner.js      Concurrency-controlled HTTP load tester (ebay.com blocked)
src/loadtest/logRun.js      Appends each load-test run to a local audit log
renderer/loadtest.js        Load-test view wiring, view-switcher, and confirmation gate
```
