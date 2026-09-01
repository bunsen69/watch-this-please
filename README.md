# eBay Listing SEO Optimizer

A lightweight desktop app (Electron) with two views, switched via the nav at
top right — **Load Test** (the default view on launch) and **SEO Optimizer**,
which helps you improve the SEO of your eBay listings before you publish them:
title scoring, keyword gap suggestions, and description quality checks, all
evaluated against eBay search (Cassini) best practices.

It is a native desktop window, not a website — nothing is uploaded to a
server, and all analysis runs locally on your machine. The window itself uses
a custom titlebar (no native OS chrome) styled to match the app's retro
synthwave theme, with its own minimize/maximize/close controls.

## Getting your listing data in

Three ways to load a listing, no eBay Developer API keys required:

1. **Paste a link** — paste a public `ebay.com/itm/...` URL and click Fetch.
   The app does a best-effort scrape of the public listing page (title,
   description, item specifics). eBay's page markup changes often and can
   block automated requests, so treat this as a shortcut, not a guarantee —
   if it fails or looks wrong, fall back to Manual Entry. If the fetch fails
   to connect, try the **"Try a few real browser header sets"** checkbox —
   it retries the fetch (up to 3 attempts) with a different complete,
   internally-consistent browser header profile each time (matching
   User-Agent, Accept, Client Hints, etc. — a mismatched combination is
   itself a bot signal, so each profile is a real, coherent set rather than
   independently-randomized fields) instead of the app's single fixed
   default. It's still a handful of ordinary sequential page fetches to the
   one URL you pasted, so this won't help if the block is IP-based rather
   than header-based.
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

You can set custom headers and a cookie applied to every request (e.g. an
`Authorization` header, or a session cookie), and optionally check
**Randomize headers** and/or **Randomize cookies** to have each request use a
different User-Agent/Accept-Language and a fresh session-style cookie. This
is for checking whether a rate limiter or WAF is actually keying off
something robust like IP, or can be fooled by superficial per-request
diversity — a standard test to run against your own defenses. It does not
randomize or spoof IP-indicating headers (`X-Forwarded-For` and similar) —
that specifically targets bypassing IP-based rate limiting on infrastructure
that trusts proxy headers, a different and more sensitive technique than
this tool is meant for.

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
renderer/titlebar.js        Custom titlebar controls (minimize/maximize/close via IPC)
renderer/particles.js       Ambient background particle animation (skips under prefers-reduced-motion)
```
