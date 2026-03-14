import { CONFIG } from '../config/index.js';

/**
 * Authentication middleware
 *
 * Note: Currently a placeholder for future authentication.
 * In development mode with ENABLE_AUTH=false, this allows all requests.
 * Set ENABLE_AUTH=true in production to require authentication.
 */

/**
 * Check if authentication is required
 */
export function requireAuth(req, res, next) {
  // Skip auth check if disabled (development mode)
  if (!CONFIG.ENABLE_AUTH) {
    // Set a default user session for development
    if (!req.session.userId) {
      req.session.userId = 'dev-user';
    }
    return next();
  }

  // Check if user is authenticated
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Please log in to access this resource'
    });
  }

  next();
}

/**
 * Optional auth - sets user if authenticated but doesn't require it
 */
export function optionalAuth(req, res, next) {
  if (CONFIG.ENABLE_AUTH && req.session && req.session.userId) {
    req.userId = req.session.userId;
  } else if (!CONFIG.ENABLE_AUTH) {
    req.userId = 'dev-user';
  }
  next();
}

/**
 * Login handler (placeholder for future implementation)
 */
export async function login(req, res) {
  // TODO: Implement actual authentication
  // This is a placeholder for future user authentication

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password required'
    });
  }

  // Placeholder: Accept any credentials in development
  if (CONFIG.isDevelopment) {
    req.session.userId = username;
    return res.json({
      success: true,
      user: { username }
    });
  }

  // Production: Reject until proper auth is implemented
  return res.status(501).json({
    success: false,
    error: 'Authentication not yet implemented'
  });
}

/**
 * Logout handler
 */
export async function logout(req, res) {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'Failed to logout'
      });
    }

    res.clearCookie('connect.sid');
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });
}

/**
 * Get current user
 */
export function getCurrentUser(req, res) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated'
    });
  }

  res.json({
    success: true,
    user: {
      userId: req.session.userId
    }
  });
}

export default {
  requireAuth,
  optionalAuth,
  login,
  logout,
  getCurrentUser
};
