// ============================================================================
// middleware/ipWhitelist.js — Campus IP Restriction Middleware
// ============================================================================
// Only applied to secure attendance endpoints:
//   POST /api/sessions/start      (teacher starts session)
//   POST /api/attendance/check-in (student QR check-in)
//
// All other routes skip this middleware entirely.
//
// Reads allowed CIDR ranges from process.env.WHITELIST_IPS.
// Supports IPv4 addresses and IPv4-mapped IPv6 (::ffff:x.x.x.x).
// If Express is behind a reverse proxy, app.set('trust proxy', 1) must be set.
// ============================================================================

require('dotenv').config();

// ── Parse CIDR into { network (32-bit int), mask (32-bit int) } ──
function parseCIDR(cidr) {
    const parts = cidr.trim().split('/');
    const ipParts = parts[0].split('.').map(Number);
    const prefix  = parseInt(parts[1], 10);

    // Convert IP to 32-bit integer
    const ipInt = ((ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3]) >>> 0;

    // Create subnet mask from prefix length
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;

    return { network: (ipInt & mask) >>> 0, mask };
}

// ── Check if an IPv4 address string falls inside a CIDR range ──
function isIpInCIDR(ip, cidr) {
    const ipParts = ip.split('.').map(Number);
    const ipInt   = ((ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3]) >>> 0;

    const { network, mask } = parseCIDR(cidr);
    return (ipInt & mask) >>> 0 === network;
}

// ── Build the allowed ranges array once at startup ──
const allowedRanges = (process.env.WHITELIST_IPS || '127.0.0.1/32')
    .split(',')
    .map(r => r.trim())
    .filter(Boolean);

// ── Middleware function ──
const ipWhitelist = (req, res, next) => {
    // Extract client IP — respect x-forwarded-for when behind proxy
    let clientIp = req.headers['x-forwarded-for']
        ? req.headers['x-forwarded-for'].split(',')[0].trim()
        : req.socket.remoteAddress;

    // Normalize IPv4-mapped IPv6 → pure IPv4
    if (clientIp && clientIp.startsWith('::ffff:')) {
        clientIp = clientIp.replace('::ffff:', '');
    }

    // Handle IPv6 loopback
    if (clientIp === '::1') {
        clientIp = '127.0.0.1';
    }

    // Check against every allowed CIDR range
    const allowed = allowedRanges.some(range => isIpInCIDR(clientIp, range));

    if (allowed) {
        return next();
    }

    return res.status(403).json({
        success: false,
        message: 'Access denied. This action is only allowed from the college Wi-Fi or VPN network.',
        yourIp:  clientIp  // helpful for debugging during development
    });
};

module.exports = ipWhitelist;
