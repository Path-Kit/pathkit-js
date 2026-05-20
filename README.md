# @path-kit/js

PathKit JS SDK — deferred deep links and mobile attribution. Works in browsers and Node.

PathKit is the Branch.io replacement that lets you sign up with a credit card and ship today — no sales call. Start at $29/mo.

## Install

```bash
npm install @path-kit/js
```

## Quickstart

```js
import { PathKit } from '@path-kit/js';

const pk = new PathKit({ apiKey: process.env.PATHKIT_KEY });

// Create a link
const { url, code } = await pk.createLink({
  dest_ios: 'https://apps.apple.com/.../id123',
  dest_android: 'https://play.google.com/store/apps/details?id=...',
  dest_web: 'https://example.com/landing',
  og: { title: 'Pizza recipe', description: 'Joe shared a recipe' },
  data: { recipe_id: 'r42' }
});
console.log(url); // https://go.pathkit.dev/abc123

// Resolve a deferred deep link on first launch
const match = await pk.match();
if (match.found) {
  console.log('matched link', match.code, 'data:', match.data);
}

// Track an event
await pk.track('purchase', { value: 99 });

// Share content (Branch Universal Object equivalent)
const out = await pk.share({
  title: 'Pizza recipe',
  description: 'Joe shared a recipe',
  image: 'https://example.com/pizza.jpg',
  canonical_url: 'https://example.com/recipe/42',
  data: { recipe_id: 'r42' }
});
if (typeof navigator !== 'undefined' && navigator.share) {
  await navigator.share(out.share);
}
```

## API

See `src/index.d.ts` for the full TypeScript surface.

| Method | Purpose |
|---|---|
| `new PathKit({ apiKey, baseUrl?, appId?, fetch?, timeoutMs? })` | construct a client |
| `createLink(opts)` | create a short link with deep-link destinations + payload |
| `getLink(code)` | read a link's metadata + today's resolve count |
| `updateLink(code, opts)` | patch destinations, OG metadata, expiry, etc. |
| `deleteLink(code)` | revoke a link |
| `match(extra?)` | deferred deep-link lookup by IP (call once on first launch) |
| `resolve({ code, source, ... })` | confirm in-app delivery (idempotent within the minute) |
| `track(name, props?)` | custom event tracking |
| `share(opts)` | create a link + native-share-sheet payload |

## License

MIT
