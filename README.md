# Estimo

Free, real-time planning poker for agile teams. Bring your backlog, vote in private, flip the cards together and keep a record of every estimate.

## Features

- **Instant rooms, no sign-up.** Pick a name and colour, then share a link or QR code. Team-named rooms (`/r/team-falcon`) keep the same link every sprint.
- **Decks.** Modified Fibonacci, Fibonacci, T-shirt sizes, powers of 2, hours, or a custom deck. Every deck has `?` and `☕`.
- **Story queue.** Paste a list of stories (one per line, links picked up automatically), reorder, skip and come back.
- **Honest voting.** Cards stay face down until reveal. You always see your own pick. Optional auto-reveal once every online voter has voted.
- **Useful results.** Average, median, vote spread, a consensus badge and the lowest and highest voters called out. One click saves the final estimate (suggested from the votes) and moves to the next story.
- **Timer.** A shared countdown for each round or discussion.
- **Roles and host controls.** Voters and spectators. The host can lock controls to host-only, hand over hosting or remove people. If the host leaves, anyone can take over.
- **History and CSV export.** Every saved estimate keeps all its rounds. Export the session as CSV for Jira or a spreadsheet.
- **Nice to use.** Mobile-first, light and dark themes, emoji reactions, reconnects automatically, and refreshing keeps your seat and vote.

## How it works

| Part | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Backend | A Cloudflare Worker with one Durable Object per room, holding room state and WebSockets (hibernation API, so idle rooms cost nothing) |
| Storage | The Durable Object's built-in storage. Rooms untouched for 90 days are deleted. |
| Shared code | `shared/` holds the message types and all room rules as plain functions, used by the server and unit tested |

```
shared/   decks, stats, protocol types and the room reducer (all game rules)
worker/   Worker entry point and the Room Durable Object
src/      React app (pages and components)
test/     unit tests for room rules and stats (Vitest)
e2e/      multi-browser voting test (Playwright)
```

## Two sites from one codebase

| Site | Build | Worker | Branding |
|---|---|---|---|
| Free (personal) | `npm run build` / `npm run deploy` | `estimo` | Vedant's Estimo, with the footer quote (`.env`) |
| Paid | `npm run build:pro` / `npm run deploy:pro` | `agilesizing` | AgileSizing brand, no personal references (`.env.pro`) |

`npm run dev:pro` runs the paid site locally. The two sites have separate rooms because each Worker has its own Durable Objects.

## Develop

```sh
npm install
npm run dev        # app + worker + Durable Objects locally at http://localhost:5173
npm test           # unit tests
npm run typecheck
npm run e2e        # with `npm run dev` running in another terminal
```

## Deploy (free)

Cloudflare's free plan covers Workers and SQLite-backed Durable Objects, which is plenty for a few teams.

```sh
npx wrangler login
npm run deploy     # builds and deploys to https://estimo.<your-subdomain>.workers.dev
```

To use your own domain, add it under the Worker's **Settings → Domains & Routes** in the Cloudflare dashboard. You can also connect the GitHub repo in **Workers & Pages → Create → Import a repository** so every push to `main` deploys automatically (build command `npm run build`, deploy command `npx wrangler deploy`).
