# Security Implementation Guide

## Overview
This document describes the security measures implemented in the Battleship application, including httpOnly cookies, session-based authentication, CSRF protection, and secure communication over HTTPS.

## Security Features Implemented

### 1. ✅ HttpOnly Cookies (Session-Based Authentication)

**Backend Configuration** ([settings.py](../backend/project_config/settings.py)):
```python
SESSION_COOKIE_HTTPONLY = True  # Prevents JavaScript access to session cookie
SESSION_COOKIE_SAMESITE = 'Lax'  # CSRF protection
SESSION_COOKIE_SECURE = not DEBUG  # True in production (HTTPS only)
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'  # Redis-backed sessions
```

**Benefits:**
- Session cookies cannot be accessed by JavaScript (XSS protection)
- Cookies are only sent over HTTPS in production
- SameSite='Lax' prevents CSRF attacks from external sites
- Redis-backed sessions for scalability and performance

**How it works:**
1. User logs in → Backend creates session → Session ID stored in httpOnly cookie
2. Frontend makes requests with `credentials: 'include'` → Cookie sent automatically
3. Backend validates session → User authenticated

### 2. ✅ CSRF Token Protection

**Backend Configuration** ([settings.py](../backend/project_config/settings.py)):
```python
CSRF_COOKIE_HTTPONLY = False  # JavaScript needs to read the token
CSRF_COOKIE_SECURE = not DEBUG  # True in production (HTTPS only)
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_USE_SESSIONS = False  # Use cookie-based CSRF tokens
```

**Frontend Implementation:**

1. **CSRF Utility** ([utils/csrf.js](../frontend/src/utils/csrf.js)):
   - `getCsrfToken()` - Reads CSRF token from cookie
   - `fetchCsrfToken()` - Fetches CSRF cookie from backend on app initialization

2. **Centralized API Client** ([utils/api.js](../frontend/src/utils/api.js)):
   - Axios instance with automatic CSRF token injection
   - Adds `X-CSRFToken` header to all POST/PUT/PATCH/DELETE requests
   - Automatic `withCredentials: true` for all requests
   - Global error handling for 401/403 responses

**How it works:**
1. App initialization → `fetchCsrfToken()` called → CSRF cookie set by backend
2. User makes POST request → Axios interceptor reads CSRF token from cookie
3. Request sent with `X-CSRFToken` header → Backend validates token
4. If token missing/invalid → 403 Forbidden

### 3. ✅ Secure HTTPS Configuration

**Nginx SSL/TLS Configuration** ([nginx.conf](../nginx/nginx.conf)):
```nginx
# SSL/TLS security
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:...';
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_stapling on;

# Security headers
Strict-Transport-Security: max-age=31536000
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
```

**HTTP to HTTPS Redirect:**
```nginx
server {
    listen 80;
    return 301 https://$host:8080$request_uri;
}
```

### 4. ✅ Automatic Credential Handling

All API requests now use the centralized `api` utility from [utils/api.js](../frontend/src/utils/api.js):

**Updated Files:**
- [AuthContext.js](../frontend/src/contexts/AuthContext.js) - CSRF initialization
- [WelcomePage.js](../frontend/src/pages/WelcomePage.js) - Login with CSRF
- [RegisterPage.js](../frontend/src/pages/RegisterPage.js) - Registration with CSRF
- [ProfilePage.js](../frontend/src/pages/ProfilePage.js) - Profile updates with CSRF
- [Components.js](../frontend/src/pages/Components.js) - Logout with CSRF

**Example Usage:**
```javascript
import api from '../utils/api';

// All requests automatically include:
// - withCredentials: true (sends cookies)
// - X-CSRFToken header (for POST/PUT/PATCH/DELETE)
// - Proper error handling

// Login
await api.post('/auth/login/', { identifier, password });

// Update profile
await api.post('/auth/profile/update/', { display_name });

// Fetch data
const response = await api.get('/auth/me/');
```

## Security Best Practices Followed

### ✅ Defense in Depth
1. **Network Layer**: HTTPS with strong TLS configuration
2. **Application Layer**: CSRF tokens, httpOnly cookies, SameSite
3. **Session Layer**: Redis-backed sessions with expiration
4. **Client Layer**: Centralized API client with automatic security headers

### ✅ Secure Cookie Configuration
- `httpOnly=True` → Prevents XSS cookie theft
- `secure=True` (production) → HTTPS only
- `sameSite=Lax` → CSRF protection
- Session expiration: 24 hours

### ✅ CSRF Protection Strategy
- Double-submit cookie pattern
- Token required for all state-changing operations
- Automatic token management via axios interceptors
- CSRF_TRUSTED_ORIGINS whitelist

### ✅ Production vs Development
```python
DEBUG = os.environ.get('DEBUG', 'False') == 'True'
SESSION_COOKIE_SECURE = not DEBUG  # Auto-enabled in production
CSRF_COOKIE_SECURE = not DEBUG     # Auto-enabled in production
```

## Security Checklist

- ✅ httpOnly cookies for session management
- ✅ CSRF token protection on all state-changing requests
- ✅ Secure cookies enabled in production (HTTPS only)
- ✅ SameSite cookie policy (Lax)
- ✅ HTTPS with TLS 1.2+ and strong ciphers
- ✅ HTTP to HTTPS redirect
- ✅ Security headers (HSTS, X-Frame-Options, etc.)
- ✅ Automatic credential handling (withCredentials)
- ✅ Centralized API client with interceptors
- ✅ Session expiration (24 hours)
- ✅ Redis-backed session storage

## Testing Security

### Test CSRF Protection:
```bash
# Should fail without CSRF token
curl -X POST https://localhost:8080/api/auth/logout/ \
  -H "Content-Type: application/json" \
  --cookie "sessionid=..." \
  --insecure

# Should succeed with CSRF token
curl -X POST https://localhost:8080/api/auth/logout/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: ..." \
  --cookie "sessionid=...; csrftoken=..." \
  --insecure
```

### Test httpOnly Cookies:
```javascript
// In browser console - should return undefined
document.cookie.split(';').find(c => c.includes('sessionid'))
// Session cookie is httpOnly, so JavaScript cannot access it ✅
```

### Test HTTPS Redirect:
```bash
# Should redirect to HTTPS
curl -I http://localhost:8080/
# HTTP/1.1 301 Moved Permanently
# Location: https://localhost:8080/
```

## Troubleshooting

### CSRF Token Issues:
1. **Error: "CSRF token missing"**
   - Ensure `fetchCsrfToken()` is called on app initialization
   - Check that CSRF cookie is set in browser DevTools
   - Verify `withCredentials: true` is set

2. **Error: "CSRF token invalid"**
   - Clear cookies and refresh page
   - Check CSRF_TRUSTED_ORIGINS includes your frontend URL
   - Verify cookie domain settings

### Cookie Issues:
1. **Cookies not being sent:**
   - Verify `withCredentials: true` on all requests
   - Check CORS_ALLOW_CREDENTIALS = True
   - Ensure frontend and backend domains match CORS settings

2. **Session expires immediately:**
   - Check Redis is running
   - Verify SESSION_ENGINE points to Redis
   - Check SESSION_COOKIE_AGE setting

## Additional Security Recommendations

### Future Enhancements:
1. **Rate Limiting**: Add rate limiting to login/register endpoints
2. **Password Policy**: Implement stronger password requirements
3. **2FA**: Add two-factor authentication support
4. **Account Lockout**: Lock accounts after X failed login attempts
5. **Security Logging**: Log authentication events for audit trail
6. **Content Security Policy**: Add CSP headers
7. **Subresource Integrity**: Add SRI for external scripts

### Monitoring:
- Monitor failed authentication attempts
- Track CSRF validation failures
- Alert on suspicious session patterns
- Regular security audits

## References

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Django Security Guide](https://docs.djangoproject.com/en/stable/topics/security/)
- [Mozilla Web Security Guidelines](https://infosec.mozilla.org/guidelines/web_security)
