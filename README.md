# Study Resource Organizer — Cloudflare Pages + D1

A small responsive study library with create, list, update, delete, search, and filters. It uses Cloudflare Pages static assets, a Pages Function API, and D1 (SQLite).

## Repository layout

```text
public/
  index.html
  assets/style.css
  assets/app.js
functions/api/[[path]].js
schema.sql
wrangler.jsonc
package.json
README.md
```

## Deploy using the Cloudflare dashboard

1. Push the project files to your GitHub repository's `main` branch.
2. In Cloudflare, open **Workers & Pages → Create application → Pages → Connect to Git**.
3. Choose the repository that contains these files.
4. Set production branch to `main`.
5. Set **Root directory** to `/` (repository root) if these files are at the root. If uploaded inside a subfolder, set the root directory to that subfolder.
6. Set framework preset to **None**, build command to `exit 0`, and build output directory to `public`.
7. Create a D1 database named `study-resource-organizer-db` (or choose a different name and update `wrangler.jsonc` if using the CLI).
8. In the Pages project, open **Settings → Functions → D1 database bindings** (the exact label may vary) and add a binding named `DB` pointing to the database you created.
9. Open the D1 database's Console and execute all of `schema.sql`.
10. Redeploy the Pages project, then test the `*.pages.dev` URL.

## Verify deployment

- Open `/api/health`; expected JSON: `{"ok":true,"database":"connected"}`.
- Open `/api/resources`; expected JSON with `resources` array.
- Add, edit, and delete a resource through the interface, then reload to verify persistence.

## CLI option

```bash
npm install
# Update the D1 database_id in wrangler.jsonc with your actual database ID.
npx wrangler pages dev public
npx wrangler d1 execute study-resource-organizer-db --remote --file=./schema.sql
npx wrangler pages deploy public
```

For the CLI route, authenticate using `npx wrangler login` in your own terminal and ensure the configured D1 database ID is correct.

## Important security note

This is a starter/demo app with no authentication or per-user authorization. The API allows anyone who can reach the public site to create, modify, or delete shared resources. Add access control before using it for private or sensitive institutional data.
## Automated CLI deployment (Windows PowerShell)

1. Extract this ZIP.
2. Open PowerShell in the extracted `AI_Project_Cloudflare` folder.
3. Run:

   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   .\deploy-cloudflare.ps1
   ```

4. Sign in in the browser if Wrangler requests it. When prompted, paste the existing D1 database ID or press Enter to create a new database.
5. The script updates `wrangler.jsonc`, applies `schema.sql` to the remote D1 database, creates/reuses the Pages project, deploys, and attempts to test `/api/health` and `/api/resources`.

This direct CLI deployment does not connect GitHub automatically. It requires Node.js/npm and Cloudflare account access. It does not use TinyFish. Review the selected D1 database before applying the schema.



## Troubleshooting resource saving

If the page opens but saving fails, check these in order:

1. Open `/api/health`. It should return `{"ok":true,"database":"connected"}`.
2. Open `/api/resources`. It should return JSON with a `resources` array.
3. In the Cloudflare Pages project serving this site, verify the D1 binding is named exactly `DB` and points to the intended database.
4. Run the complete `schema.sql` against that same database, then redeploy.
5. In the browser, open Developer Tools → Network, try saving a test resource, and inspect the `POST /api/resources` response. The API returns a useful error message when it rejects the request.
6. Verify by refreshing `/api/resources` and the page to confirm the row persists.

Important: this package can correct the project files, but it cannot change a live Cloudflare deployment unless you deploy these files to the Cloudflare project that serves your current URL. A `workers.dev` URL may belong to a Worker separate from a Pages project.
