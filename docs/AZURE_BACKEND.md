# Cherokee Cup — Shared Cloud Backend (Azure)

This app is **local-first**: every phone stores its own data in the browser (IndexedDB)
and works fully offline. An optional **shared cloud backend** makes all phones see the
same live data (rosters, matches, scores) in real time.

The backend is **fully built and deployed** — it just needs a database the Static Web App
can actually reach. See "Current blocker" below.

---

## Architecture

```
 React PWA (local-first, Dexie/IndexedDB)
        │  src/services/cloudSync.ts  (per-record sync, 4s poll, offline outbox)
        ▼
 /api  (Azure Static Web Apps managed Functions, Node 18, api/src/index.js)
        │  GET  /api/sync            -> all records (incl. tombstones)
        │  POST /api/record          -> upsert one record
        │  DELETE /api/record?store=&id=  -> tombstone (so deletes propagate)
        ▼
 Azure Cosmos DB (serverless) — database "cherokeecup", container "records" (/store)
        doc shape: { id, store, doc:<record>, deleted:bool, updatedAt }
```

- **Per-record** sync (not whole-blob) so multiple people scoring different matches at the
  same time never clobber each other.
- **Deletes** are tombstoned server-side so they reach every device.
- **Offline-tolerant**: local writes queue in an outbox and retry; the UI never blocks on
  the network (sync runs in the background and updates reactively via `useLiveQuery`).

### Azure resources (already created)
| Thing | Value |
|---|---|
| Resource group | `rg-cherokee-cup` (eastus2) |
| Static Web App | `cherokee-cup` — https://proud-sky-0b875c50f.7.azurestaticapps.net |
| Cosmos account | `cherokee-cup-golfdb` (serverless) |
| Cosmos database / container | `cherokeecup` / `records` (partition key `/store`) |
| SWA app setting | `COSMOS_CONNECTION_STRING` (server-side) |

`GET /api/ping` returns `200 {ok, node, hasConn}` — confirms the Functions + connection
string are wired correctly.

---

## Current blocker

The subscription `ME-D365DemoTSCE50264251` (a D365 demo tenant) enforces a **security
baseline on all data services**:

- `publicNetworkAccess = Disabled` (verified: it reverts if you try to enable it)
- key / shared-key / connection-string auth **disabled** (`disableLocalAuth = true`) — Entra-only

Verified on **both** Cosmos DB and a test Storage account, so it is subscription-wide.
Static Web Apps **Free** managed functions have **no VNet integration**, so they cannot
reach a private-only data store — and key auth is off anyway. Result: `/api/sync` can't
connect to Cosmos and returns `500`; the app safely falls back to local-first.

---

## How to finish (pick one)

### Option A — Allow it on this subscription (admin action)
Ask whoever administers the tenant to either:
- Grant a **policy exemption** on `rg-cherokee-cup`, or
- Allow **public network access** + **local auth** on the `cherokee-cup-golfdb` account.

Then apply (once policy allows it to stick):
```powershell
az cosmosdb update -n cherokee-cup-golfdb -g rg-cherokee-cup --public-network-access Enabled
# re-enable key auth (if the policy allows):
$id = az cosmosdb show -n cherokee-cup-golfdb -g rg-cherokee-cup --query id -o tsv
az resource update --ids $id --set properties.disableLocalAuth=false
```
No code or redeploy needed — the app auto-connects on next load.

### Option B — Use a different (unrestricted) Azure subscription
On a personal Pay-As-You-Go or non-locked subscription:
```powershell
az account set --subscription <UNRESTRICTED_SUB_ID>
az cosmosdb create -n <newname> -g <rg> --capabilities EnableServerless `
  --locations regionName=eastus2 --default-consistency-level Session
az cosmosdb sql database create -a <newname> -g <rg> -n cherokeecup
az cosmosdb sql container create -a <newname> -g <rg> -d cherokeecup -n records --partition-key-path "/store"
# get its connection string and set it on the SWA (which can stay in this sub):
$cs = az cosmosdb keys list -n <newname> -g <rg> --type connection-strings `
      --query "connectionStrings[0].connectionString" -o tsv
az staticwebapp appsettings set -n cherokee-cup -g rg-cherokee-cup `
  --setting-names "COSMOS_CONNECTION_STRING=$cs"
```
No app rebuild needed.

---

## Activate the shared data (one time)

Once `/api/sync` returns `200` with a JSON body (e.g. `[]`):

1. Open the app on the **admin device that already has the Cherokee Cup data** (Trey's device).
2. In the browser console run:
   ```js
   await window.__seedCloud()
   ```
   This uploads every local record to Cosmos. It returns the number of records pushed.
3. Every other phone that opens the app now pulls that data and stays in sync (~4s).

## Verify
```powershell
Invoke-WebRequest "https://proud-sky-0b875c50f.7.azurestaticapps.net/api/sync" -UseBasicParsing
# expect StatusCode 200 and Content-Type application/json
```
Or open the site in two browsers, enter a score in one, and watch it appear in the other.

---

## Deploying updates

GitHub Actions is blocked on this repo, so deploys are done directly with the SWA CLI:
```powershell
npm run build
$tok = az staticwebapp secrets list -n cherokee-cup -g rg-cherokee-cup --query "properties.apiKey" -o tsv
npx @azure/static-web-apps-cli deploy ./dist --api-location ./api `
  --api-language node --api-version 18 --deployment-token $tok --env production
```

## Security note
`/api` is **anonymous/open** (no auth) — appropriate for a small, trusted, private trip.
If you ever want it locked down, put the endpoints behind SWA authentication or a shared
secret header before sharing the URL widely.
