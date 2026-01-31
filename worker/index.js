const ID_RE = /^[A-Za-z0-9]+$/;
const ID_MIN_LEN = 4;
const ID_MAX_LEN = 32;
const TTL_SECONDS = 30 * 60;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS, HEAD",
    "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(body, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            ...extraHeaders,
        },
    });
}

function statusResponse(status, extraHeaders = {}) {
    return new Response(null, {
        status,
        headers: {
            "Cache-Control": "no-store",
            ...extraHeaders,
        },
    });
}

function withCors(response) {
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

export class MemoRelayDO {
    constructor(state, env) {
        this.state = state;
        this.env = env;
    }

    async fetch(request) {
        const url = new URL(request.url);
        const match = url.pathname.match(/^\/api\/memo\/([A-Za-z0-9]+)$/);
        if (!match) {
            return jsonResponse({ error: "Not Found" }, 404);
        }

        const id = match[1];
        if (!ID_RE.test(id) || id.length < ID_MIN_LEN || id.length > ID_MAX_LEN) {
            return jsonResponse({ error: "Invalid id" }, 400);
        }

        if (request.method === "PUT") {
            let data;
            try {
                data = await request.json();
            } catch {
                return jsonResponse({ error: "Invalid JSON" }, 400);
            }

            if (!data?.ciphertext || !data?.iv || !data?.salt) {
                return jsonResponse({ error: "Missing ciphertext, iv, or salt" }, 400);
            }

            const existing = await this.state.storage.get("memo");
            if (existing) {
                return jsonResponse({ error: "ID collision, try again" }, 409);
            }

            const expiresAt = Date.now() + TTL_SECONDS * 1000;
            await this.state.storage.put("memo", {
                ciphertext: data.ciphertext,
                iv: data.iv,
                salt: data.salt,
                kdf: data.kdf || null,
                createdAt: Date.now(),
                expiresAt,
            });
            await this.state.storage.setAlarm(expiresAt);

            return jsonResponse({ id, success: true }, 200);
        }

        if (request.method === "HEAD") {
            const value = await this.state.storage.get("memo");
            if (!value) {
                return statusResponse(404);
            }

            if (value.expiresAt && Date.now() > value.expiresAt) {
                await this.state.storage.delete("memo");
                return statusResponse(404);
            }

            return statusResponse(204);
        }

        if (request.method === "GET") {
            const value = await this.state.storage.get("memo");
            if (!value) {
                return jsonResponse({ error: "Memo not found or already destroyed" }, 404);
            }

            if (value.expiresAt && Date.now() > value.expiresAt) {
                await this.state.storage.delete("memo");
                return jsonResponse({ error: "Memo expired" }, 404);
            }

            // BURN: Delete immediately after reading
            await this.state.storage.delete("memo");

            return jsonResponse(value, 200);
        }

        return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    async alarm() {
        await this.state.storage.delete("memo");
    }
}

export default {
    async fetch(request, env) {
        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);
        const normalizedPath = url.pathname.replace(/\/+$/, "") || "/";
        if (["/login", "/signin", "/auth"].includes(normalizedPath)) {
            return Response.redirect(new URL("/", url), 302);
        }
        if (url.pathname === "/api/health") {
            return withCors(statusResponse(204));
        }
        const apiMatch = url.pathname.match(/^\/api\/memo\/([A-Za-z0-9]+)$/);
        if (apiMatch) {
            const id = apiMatch[1];
            const stub = env.MEMO_DO.get(env.MEMO_DO.idFromName(id));
            const response = await stub.fetch(request);
            return withCors(response);
        }

        if (env.ASSETS) {
            const assetResponse = await env.ASSETS.fetch(request);
            if (assetResponse.status !== 404) {
                return assetResponse;
            }

            const path = url.pathname;
            if (path !== "/" && !path.includes(".")) {
                const indexRequest = new Request(new URL("/index.html", url), request);
                return env.ASSETS.fetch(indexRequest);
            }

            return assetResponse;
        }

        return new Response("Not Found", { status: 404 });
    }
};
