# food.devinringel.com

A small static site for tracking restaurants around town: filter by
cuisine/day-open/food-or-alcohol, and hit **Pick For Me** to get a random
pick from whatever's currently filtered. No backend, no build step.

## How it works

- `index.html` / `style.css` / `app.js` are the whole site.
- Restaurant data comes from either:
  1. A Google Sheet published to the web as CSV (lets you edit the list
     from your phone without redeploying), or
  2. The local `restaurants.json` file, used automatically if no Sheet
     URL is configured or the Sheet fetch fails.

## Setting up the Google Sheet (optional)

1. Create a Google Sheet with a header row and these columns (any order):

   ```
   name, cuisine, sun, mon, tue, wed, thu, fri, sat, food, alcohol, out_of_town, address, notes
   ```

   - `sun`...`sat`: `TRUE`/`FALSE` (or `yes`/`no`, `1`/`0`) for whether the
     place is open that day. This is per-day on purpose, since a lot of
     local spots close on random days rather than a normal Mon–Fri week.
   - `food` / `alcohol`: `TRUE`/`FALSE` for whether they serve each. A
     place with both checked shows as "Food & Alcohol"; only `alcohol`
     checked shows as "Alcohol only", etc.
   - `out_of_town`: `TRUE`/`FALSE` for whether it's outside your usual
     area. Leave blank/`FALSE` for local spots. Filterable via the
     Location dropdown, and tagged on the card and on a random pick.
   - `address` / `notes`: optional free text.

2. In Google Sheets: **File → Share → Publish to web**. Choose the
   relevant sheet/tab, set the format to **Comma-separated values (.csv)**,
   and publish. Copy the URL it gives you.

   ⚠️ **Heads up:** "Publish to web" makes that sheet's data
   readable by anyone with the link — it's not indexed or searchable,
   but it isn't private either. Fine for a restaurant list, but don't put
   anything sensitive in that sheet.

3. Paste the URL into `app.js` as the value of `SHEET_CSV_URL` near the
   top of the file.

If you skip all of this, the site just uses `restaurants.json` — edit
that file directly (same column names, just as JSON) and redeploy.

## Deploying with GitHub Pages

1. Push this repo to `main` (or whichever branch Pages is configured to
   serve from).
2. In the GitHub repo settings → **Pages**, set the source to that
   branch, root folder.
3. The `CNAME` file in this repo is already set to `food.devinringel.com`,
   which is what makes GitHub Pages serve the custom domain instead of
   the default `*.github.io` URL.
4. At your DNS provider, add a `CNAME` record for the `food` subdomain
   pointing at `<your-github-username>.github.io`.
5. Wait for DNS to propagate, then check "Enforce HTTPS" in the Pages
   settings once GitHub has issued a certificate for the domain.

## Local development

No build step — just open `index.html` in a browser, or serve the
folder with any static file server, e.g.:

```
python3 -m http.server 8000
```
