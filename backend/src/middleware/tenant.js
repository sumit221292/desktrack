const { query } = require('../config/db');

/**
 * Middleware to handle multi-tenancy
 * Extracts tenant from:
 * 1. x-tenant-id or x-tenant-slug header
 * 2. Subdomain (e.g., company1.desktrack.com)
 * 3. URL params (optional handled in routes)
 */
const tenantMiddleware = async (req, res, next) => {
  try {
    // Skip tenant check for Google auth (tenant is resolved from email domain)
    if (req.path === '/api/auth/google' || req.path === '/auth/google') {
      req.tenant = { id: null, name: 'Pending', slug: 'pending', is_active: true };
      req.tenantId = null;
      return next();
    }

    const slug = req.headers['x-tenant-slug'] || req.headers['x-tenant-id'];
    
    // Fallback: Check subdomain if host is available
    let subdomainMatch = null;
    if (!slug && req.headers.host) {
      const parts = req.headers.host.split('.');
      if (parts.length > 2) {
        subdomainMatch = parts[0];
      }
    }

    const tenantIdentifier = slug || subdomainMatch;

    if (!tenantIdentifier) {
      return res.status(400).json({ 
        error: 'Tenant identification missing. Use x-tenant-slug header or subdomain.' 
      });
    }

    // Direct lookup in DB
    const tenantResult = await query(
      'SELECT id, name, slug, is_active FROM companies WHERE slug = $1 OR id::text = $1',
      [tenantIdentifier]
    );

    if (tenantResult.rows.length === 0) {
      // Mock tenant for demo/testing when DB is not available
      console.log('Tenant not found in DB, using mock default for demo.');
      req.tenant = { id: 1, name: 'DeskTrack Demo', slug: 'demo', is_active: true };
      req.tenantId = 1;
      return next();
    }

    const tenant = tenantResult.rows[0];

    if (!tenant.is_active) {
      return res.status(403).json({ error: 'Tenant account is inactive.' });
    }

    // Inject tenant info into request
    req.tenant = tenant;
    req.tenantId = tenant.id;

    next();
  } catch (err) {
    console.error('Tenant Middleware Error:', err);
    res.status(500).json({ error: 'Internal server error during tenant identification.' });
  }
};

module.exports = tenantMiddleware;
