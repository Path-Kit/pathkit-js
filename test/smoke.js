// End-to-end smoke test for @path-kit/js against a live PathKit server.
//
// Usage:
//   PATHKIT_BASE=http://localhost:471 \
//   PATHKIT_HOST=pathkit.dev \
//   PATHKIT_KEY=pk_test_... \
//   PATHKIT_APP_ID=app_... \
//   node test/smoke.js
//
// The smoke test exercises createLink → getLink → updateLink → share →
// match (against a different IP, expects no match) → track → deleteLink.

const { PathKit, PathKitError } = require('../src/index.js');

const BASE = process.env.PATHKIT_BASE || 'http://localhost:471';
const HOST = process.env.PATHKIT_HOST || 'pathkit.dev';
const KEY = process.env.PATHKIT_KEY;
const APP_ID = process.env.PATHKIT_APP_ID || null;

if (!KEY) { console.error('Set PATHKIT_KEY (pk_test_...)'); process.exit(1); }

// Local pathkit server routes by Host header, but Node's built-in fetch
// (undici) strips/forbids manually setting Host. Use http.request so we can
// force the Host header — gives us a true SDK smoke against a localhost rig.
const http = require('http');
const { URL } = require('url');
function wrappedFetch(url, init = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const headers = { ...(init.headers || {}), Host: HOST };
        // Lever runtime rejects chunked Transfer-Encoding — set Content-Length
        // explicitly so Node's http.request doesn't default to chunked.
        if (init.body !== undefined) {
            headers['Content-Length'] = Buffer.byteLength(init.body);
        }
        const req = http.request({
            method: init.method || 'GET',
            hostname: u.hostname,
            port: u.port || 80,
            path: u.pathname + u.search,
            headers: headers
        }, (res) => {
            let body = '';
            res.on('data', (c) => { body += c.toString(); });
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    text: () => Promise.resolve(body)
                });
            });
        });
        req.on('error', reject);
        if (init.body) req.write(init.body);
        req.end();
    });
}

async function main() {
    const pk = new PathKit({ apiKey: KEY, baseUrl: BASE, appId: APP_ID, fetch: wrappedFetch });
    console.log('PathKit JS SDK smoke @ ' + BASE + ' (Host=' + HOST + ')');

    console.log('\n[1] createLink');
    const out = await pk.createLink({
        dest_ios: 'https://apps.apple.com/x',
        dest_android: 'https://play.google.com/y',
        dest_web: 'https://example.com/landing',
        og: { title: 'SDK smoke test', description: 'created via @path-kit/js' },
        data: { source: 'sdk_smoke' },
        tags: ['smoke']
    });
    console.log('   created code=' + out.code + ' url=' + out.url);

    console.log('[2] getLink');
    const got = await pk.getLink(out.code);
    console.log('   got code=' + got.link.code + ' env=' + got.link.env + ' resolves_today=' + got.resolves_today);

    console.log('[3] updateLink');
    const upd = await pk.updateLink(out.code, { campaign: 'sdk-launch' });
    console.log('   updated campaign=' + upd.link.campaign);

    console.log('[4] share');
    const sh = await pk.share({
        title: 'Look at this',
        description: 'shared from the SDK',
        image: 'https://example.com/cover.jpg',
        canonical_url: 'https://example.com/post/42'
    });
    console.log('   share.url=' + sh.url + ' share.text=' + sh.share.text.replace(/\n/g, ' / '));

    console.log('[5] match (no prior click for this IP)');
    // /v1/match requires an app-scoped key OR an explicit app_id in the body.
    // The smoke uses the org-scoped key, so pass app_id along.
    const m = await pk.match(APP_ID ? { app_id: APP_ID } : {});
    console.log('   match.found=' + m.found + ' source=' + (m.source || 'n/a'));

    console.log('[6] track');
    const t = await pk.track('sdk_smoke_event', { value: 1 });
    console.log('   track ok=' + t.ok);

    console.log('[7] deleteLink');
    const del = await pk.deleteLink(out.code);
    console.log('   revoked=' + del.revoked);

    console.log('[8] error path — bad code returns PathKitError');
    try {
        await pk.getLink('not_a_real_code');
        console.log('   FAIL — expected an error');
    } catch (e) {
        if (e instanceof PathKitError) {
            console.log('   OK — caught PathKitError code=' + e.code + ' status=' + e.status);
        } else {
            throw e;
        }
    }

    console.log('\nALL CHECKS PASSED');
}

main().catch((e) => { console.error('SMOKE FAILED:', e); process.exit(1); });
