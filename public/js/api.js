// ============================================================================
// public/js/api.js — JWT-Authenticated Fetch Wrapper
// ============================================================================
// All API calls go through this helper so JWT headers and error handling
// are centralized in one place.
// ============================================================================

const API = {
    // Base URL — empty string means same origin
    baseUrl: '',

    // ── Get stored JWT token ──
    getToken() {
        return localStorage.getItem('token');
    },

    // ── Build Authorization headers ──
    authHeaders() {
        const token = this.getToken();
        return {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };
    },

    // ── Generic fetch wrapper ──
    async request(method, endpoint, body = null) {
        const options = {
            method,
            headers: this.authHeaders()
        };

        if (body && method !== 'GET') {
            options.body = JSON.stringify(body);
        }

        const res = await fetch(`${this.baseUrl}${endpoint}`, options);

        // If 401/403 on a protected route, redirect to login
        if (res.status === 401 || res.status === 403) {
            const data = await res.json().catch(() => ({}));
            // Only redirect if it's a token issue, not a role issue
            if (res.status === 401 || data.message?.includes('token')) {
                localStorage.clear();
                window.location.href = '/login.html';
                return;
            }
            throw new Error(data.message || 'Access denied.');
        }

        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Request failed.');
        }

        return data;
    },

    // ── Convenience methods ──
    get(endpoint)       { return this.request('GET', endpoint); },
    post(endpoint, body){ return this.request('POST', endpoint, body); },

    // ── Auth check ──
    isLoggedIn() {
        return !!this.getToken();
    },

    getRole() {
        return localStorage.getItem('role');
    },

    getUserName() {
        return localStorage.getItem('userName') || 'User';
    },

    logout() {
        // Fire logout endpoint (best-effort), then clear storage
        this.post('/api/auth/logout').catch(() => {});
        localStorage.clear();
        window.location.href = '/login.html';
    }
};
