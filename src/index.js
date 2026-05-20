// @path-kit/js — PathKit JS SDK (browser + Node)
//
// Usage:
//   import { PathKit } from '@path-kit/js';
//   const pk = new PathKit({ apiKey: 'pk_live_...' });
//   const link = await pk.createLink({ dest_web: '...', data: { ... } });
//   if (navigator.share) navigator.share((await pk.share({ ... })).share);
//
// The SDK is a thin authenticated wrapper around the PathKit REST API.
// It does not bundle a smart-banner UI — for that, add the loader tag:
//   <script async src="https://go.pathkit.dev/banner.js?app=APP_ID"></script>

const DEFAULT_BASE = 'https://pathkit.dev';

class PathKitError extends Error {
    constructor(message, { code, status, body } = {}) {
        super(message);
        this.name = 'PathKitError';
        this.code = code;
        this.status = status;
        this.body = body;
    }
}

/**
 * @typedef {Object} PathKitOptions
 * @property {string} apiKey      pk_live_... or pk_test_... — required
 * @property {string} [baseUrl]   defaults to https://pathkit.dev
 * @property {string} [appId]     when not using an app-scoped key, supply app_id with each call
 * @property {function} [fetch]   custom fetch implementation (defaults to global fetch)
 * @property {number} [timeoutMs] per-request timeout, default 10000
 */

class PathKit {
    /** @param {PathKitOptions} opts */
    constructor(opts) {
        if (!opts || !opts.apiKey) throw new PathKitError('Missing apiKey');
        if (!/^pk_(live|test)_/.test(opts.apiKey)) {
            throw new PathKitError('apiKey must start with pk_live_ or pk_test_');
        }
        this.apiKey = opts.apiKey;
        this.baseUrl = (opts.baseUrl || DEFAULT_BASE).replace(/\/$/, '');
        this.appId = opts.appId || null;
        this._fetch = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
        this.timeoutMs = opts.timeoutMs || 10000;
        if (!this._fetch) {
            throw new PathKitError('No fetch implementation — pass `fetch` in options for Node <18');
        }
    }

    /**
     * Create a deep link. The returned `url` opens in the customer's app via
     * Universal Links / App Links if installed, otherwise lands on the PathKit
     * resolve page that races a deep link against an App Store / Play Store
     * fallback and stores a deferred-IP match for first-launch attribution.
     *
     * @param {Object} opts
     * @param {string} [opts.app_id]       overrides constructor appId
     * @param {string} [opts.dest_ios]
     * @param {string} [opts.dest_android]
     * @param {string} [opts.dest_web]
     * @param {Object} [opts.data]         arbitrary JSON delivered to the SDK on match
     * @param {Object} [opts.og]           { title, description, image } for link previews
     * @param {string} [opts.deep_view_id] override default Deep View template
     * @param {string} [opts.alias]        vanity slug, must be unique in the org
     * @param {string[]} [opts.tags]
     * @param {string} [opts.campaign]
     * @param {string} [opts.channel]
     * @param {string} [opts.feature]
     * @param {number} [opts.expires_at]   unix ms
     * @returns {Promise<{ id:string, code:string, url:string, short_url:string, qr_url:string, link:object }>}
     */
    async createLink(opts = {}) {
        const body = { ...opts };
        if (!body.app_id && this.appId) body.app_id = this.appId;
        return this._request('POST', '/v1/links', body);
    }

    /** Retrieve a link by code. */
    async getLink(code) {
        return this._request('GET', `/v1/links/${encodeURIComponent(code)}`);
    }

    /** Patch a link (any subset of dest_*, data, og, geo_rules, tags, etc.). */
    async updateLink(code, opts = {}) {
        return this._request('PATCH', `/v1/links/${encodeURIComponent(code)}`, opts);
    }

    /** Revoke a link. */
    async deleteLink(code) {
        return this._request('DELETE', `/v1/links/${encodeURIComponent(code)}`);
    }

    /**
     * Deferred-deep-link match. Called on first app launch / web visit to see
     * if PathKit recorded a click from this IP within the last hour. Returns
     * `{ found: false }` if no match or the match was already consumed.
     *
     * @param {Object} [extra] forwarded to the server (install_id, etc.)
     */
    async match(extra = {}) {
        return this._request('POST', '/v1/match', extra);
    }

    /**
     * Confirm successful in-app delivery of a deep link. SDK wrappers
     * (iOS/Android/RN) call this after applying the link payload so PathKit
     * can attribute the install. Idempotent within the same minute.
     *
     * @param {Object} opts
     * @param {string} opts.code
     * @param {'direct_deeplink'|'fingerprint'|'clipboard'|'in_app'} [opts.source]
     * @param {string} [opts.install_id]
     * @param {string} [opts.user_id]
     * @param {Object} [opts.props]
     */
    async resolve(opts) {
        if (!opts || !opts.code) throw new PathKitError('resolve requires { code }');
        return this._request('POST', '/v1/resolve', opts);
    }

    /**
     * Track a custom event. v1.1 ships funnels + cohort reporting on top of
     * these events; v1 just stores them.
     */
    async track(name, props = {}, extra = {}) {
        if (!name) throw new PathKitError('track requires an event name');
        return this._request('POST', '/v1/events', { name, props, ...extra });
    }

    /**
     * Create a shareable link the way an SDK would. Returns the short URL plus
     * a `share` payload you can hand to `navigator.share()` directly:
     *
     *     const out = await pk.share({ title, description, image, canonical_url, data });
     *     if (navigator.share) await navigator.share(out.share);
     *
     * @param {Object} opts — see createLink, plus { canonical_url } and required app_id
     */
    async share(opts = {}) {
        const body = { ...opts };
        if (!body.app_id && this.appId) body.app_id = this.appId;
        return this._request('POST', '/v1/share', body);
    }

    // ---------------------------------------------------------------- HTTP

    async _request(method, path, body) {
        const url = this.baseUrl + path;
        const init = {
            method,
            headers: {
                'Authorization': 'Bearer ' + this.apiKey,
                'Accept': 'application/json',
                'User-Agent': 'pathkit-js/0.1.0'
            }
        };
        if (body && method !== 'GET') {
            init.headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(body);
        }

        // AbortController-based timeout — supported by every fetch impl since
        // ~Node 18 / all modern browsers. Older runtimes fall through and we
        // rely on the platform's default network timeout.
        let timer = null;
        if (typeof AbortController !== 'undefined') {
            const ctl = new AbortController();
            init.signal = ctl.signal;
            timer = setTimeout(() => ctl.abort(), this.timeoutMs);
        }

        let res;
        try {
            res = await this._fetch(url, init);
        } catch (e) {
            if (timer) clearTimeout(timer);
            throw new PathKitError('Network error: ' + (e && e.message ? e.message : e), { code: 'network' });
        }
        if (timer) clearTimeout(timer);

        const text = typeof res.text === 'function' ? await res.text() : (res.body || '');
        let parsed = null;
        try { parsed = text ? JSON.parse(text) : null; } catch (e) { /* leave parsed null */ }

        if (res.status >= 400) {
            const errMsg = (parsed && parsed.error && parsed.error.message)
                || (parsed && parsed.error && parsed.error.code)
                || ('HTTP ' + res.status);
            throw new PathKitError(errMsg, {
                code: parsed && parsed.error && parsed.error.code,
                status: res.status,
                body: parsed || text
            });
        }
        return parsed;
    }
}

// CommonJS + ESM compat
module.exports = { PathKit, PathKitError };
module.exports.default = PathKit;
module.exports.PathKit = PathKit;
module.exports.PathKitError = PathKitError;
