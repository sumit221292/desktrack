const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { query } = require('../config/db');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const login = async (req, res) => {
  const { email, password } = req.body;
  const tenantId = req.tenantId;

  try {
    const userResult = await query(
      'SELECT * FROM users WHERE email = $1 AND company_id = $2',
      [email, tenantId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role, 
        companyId: user.company_id 
      },
      process.env.JWT_SECRET || 'desktrack_secret',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.company_id
      }
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
};

const googleLogin = async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: 'Google credential is required.' });
  }

  try {
    // 1. Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    if (!email) {
      return res.status(400).json({ error: 'Unable to retrieve email from Google account.' });
    }

    // 2. Extract domain from email
    const emailDomain = email.split('@')[1];

    // 3. Check if the domain is in the allowed_domains list
    const domainResult = await query(
      'SELECT * FROM allowed_domains WHERE domain = $1',
      [emailDomain]
    );

    if (domainResult.rows.length === 0) {
      return res.status(403).json({ 
        error: 'Domain not authorized',
        message: `The domain "${emailDomain}" is not authorized to access DeskTrack. Please contact your administrator.`
      });
    }

    const allowedDomain = domainResult.rows[0];
    const companyId = allowedDomain.company_id;

    // 4. Find or create the user
    let userResult = await query(
      'SELECT * FROM users WHERE email = $1 AND company_id = $2',
      [email, companyId]
    );

    let user;
    if (userResult.rows.length === 0) {
      // Check if employee already exists by email
      const existingEmpResult = await query(
        'SELECT id, role FROM employees WHERE email = $1 AND company_id = $2',
        [email, companyId]
      );

      let initialRole = 'EMPLOYEE';
      let employeeId = null;

      if (existingEmpResult.rows.length > 0) {
        employeeId = existingEmpResult.rows[0].id;
        initialRole = existingEmpResult.rows[0].role || 'EMPLOYEE';
        console.log('Linking Google login to existing employee ID:', employeeId);
      } else {
        // Check if this is the first user for this company
        const allUsersResult = await query(
          'SELECT id FROM users WHERE company_id = $1',
          [companyId]
        );
        const isFirstUser = allUsersResult.rows.length === 0;
        initialRole = isFirstUser ? 'SUPER_ADMIN' : 'EMPLOYEE';
      }

      // Auto-create user on first Google login
      const insertResult = await query(
        'INSERT INTO users (email, password_hash, role, company_id) VALUES ($1, $2, $3, $4) RETURNING id',
        [email, 'GOOGLE_AUTH_' + googleId, initialRole, companyId]
      );

      const userId = insertResult.rows[0].id;

      // If no employee record existed, create one now
      if (!employeeId) {
        const nameParts = (name || email.split('@')[0]).split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const employeeCode = 'EMP-' + String(userId).padStart(3, '0');

        try {
          await query(
            `INSERT INTO employees (company_id, first_name, last_name, employee_code, email, role, status, joining_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [companyId, firstName, lastName, employeeCode, email, initialRole, 'ACTIVE', new Date().toISOString().split('T')[0]]
          );
          console.log('Auto-created employee record for:', email);
        } catch (empErr) {
          console.error('Failed to auto-create employee (non-fatal):', empErr.message);
        }
      }

      user = {
        id: userId,
        email,
        role: initialRole,
        company_id: companyId,
        name: name || email.split('@')[0],
        picture
      };
    } else {
      user = userResult.rows[0];
      user.name = name || user.email.split('@')[0];
      user.picture = picture;

      // Sync role from employees table (source of truth for role assignments)
      const empRoleResult = await query(
        'SELECT role FROM employees WHERE email = $1 AND company_id = $2',
        [email, companyId]
      );
      if (empRoleResult.rows.length > 0 && empRoleResult.rows[0].role) {
        user.role = empRoleResult.rows[0].role;
      }
    }

    // 5. Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        companyId: companyId
      },
      process.env.JWT_SECRET || 'desktrack_secret',
      { expiresIn: '24h' }
    );

    // 6. Derive tenant slug from domain
    const tenantSlug = emailDomain.split('.')[0];

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role,
        tenantId: companyId
      },
      tenantSlug
    });
  } catch (err) {
    console.error('Google Login Error Details:', {
      message: err.message,
      stack: err.stack,
      response: err.response && err.response.data
    });
    
    // Handle specific Google verification errors
    if (err.message && (
      err.message.includes('Token used too late') || 
      err.message.includes('Wrong recipient') ||
      err.message.includes('Invalid token')
    )) {
      return res.status(401).json({ error: 'Google authentication failed. Please try again.' });
    }
    
    res.status(500).json({ error: 'Server error during Google login.' });
  }
};

const register = async (req, res) => {
  const { email, password, role } = req.body;
  const tenantId = req.tenantId;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (email, password_hash, role, company_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [email, hashedPassword, role, tenantId]
    );

    res.status(201).json({ message: 'User registered successfully.', id: result.rows[0].id });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
};

module.exports = { login, googleLogin, register };

