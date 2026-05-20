// PathKit JS SDK type declarations

export interface PathKitOptions {
    apiKey: string;
    baseUrl?: string;
    appId?: string;
    fetch?: typeof fetch;
    timeoutMs?: number;
}

export interface LinkOG {
    title?: string;
    description?: string;
    image?: string;
}

export interface CreateLinkOptions {
    app_id?: string;
    dest_ios?: string;
    dest_android?: string;
    dest_web?: string;
    data?: Record<string, unknown>;
    og?: LinkOG;
    deep_view_id?: string;
    alias?: string;
    tags?: string[];
    campaign?: string;
    channel?: string;
    feature?: string;
    expires_at?: number;
    geo_rules?: Record<string, unknown>;
}

export interface Link {
    code: string;
    appId: string;
    orgId: string;
    env: 'live' | 'test';
    dest_ios: string | null;
    dest_android: string | null;
    dest_web: string | null;
    data: Record<string, unknown> | null;
    og: LinkOG | null;
    deep_view_id: string | null;
    tags: string[];
    campaign: string | null;
    channel: string | null;
    feature: string | null;
    expires_at: number | null;
    created_at: number;
    updated_at: number;
    revoked_at: number | null;
}

export interface CreateLinkResult {
    id: string;
    code: string;
    url: string;
    short_url: string;
    qr_url: string;
    preview_url: string;
    link: Link;
}

export interface MatchResult {
    found: boolean;
    source?: 'fingerprint' | 'no_match' | 'expired' | 'revoked' | 'link_gone';
    ua_confidence?: 'high' | 'low';
    code?: string;
    data?: Record<string, unknown> | null;
    dest_ios?: string | null;
    dest_android?: string | null;
    dest_web?: string | null;
    og?: LinkOG | null;
    campaign?: string | null;
    channel?: string | null;
    feature?: string | null;
}

export interface ResolveOptions {
    code: string;
    source?: 'direct_deeplink' | 'fingerprint' | 'clipboard' | 'in_app';
    install_id?: string;
    user_id?: string;
    props?: Record<string, unknown>;
}

export interface ShareOptions {
    app_id?: string;
    title?: string;
    description?: string;
    image?: string;
    canonical_url?: string;
    data?: Record<string, unknown>;
    dest_ios?: string;
    dest_android?: string;
    dest_web?: string;
    deep_view_id?: string;
    tags?: string[];
    campaign?: string;
    channel?: string;
    feature?: string;
    expires_at?: number;
}

export interface ShareResult {
    url: string;
    short_url: string;
    code: string;
    share: { title?: string; text: string; url: string };
    link: Link;
}

export class PathKitError extends Error {
    code?: string;
    status?: number;
    body?: unknown;
}

export class PathKit {
    constructor(opts: PathKitOptions);
    createLink(opts?: CreateLinkOptions): Promise<CreateLinkResult>;
    getLink(code: string): Promise<{ link: Link; resolves_today: number }>;
    updateLink(code: string, opts?: Partial<CreateLinkOptions>): Promise<{ link: Link }>;
    deleteLink(code: string): Promise<{ revoked: true; code: string }>;
    match(extra?: Record<string, unknown>): Promise<MatchResult>;
    resolve(opts: ResolveOptions): Promise<{ ok: true; link: { code: string; data: Record<string, unknown> | null } }>;
    track(name: string, props?: Record<string, unknown>, extra?: Record<string, unknown>): Promise<{ ok: true }>;
    share(opts: ShareOptions): Promise<ShareResult>;
}

export default PathKit;
