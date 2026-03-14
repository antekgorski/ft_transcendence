# Security Implementation Guide

This document reflects the **current implementation** in backend/frontend config.

## Authentication & Session Security (Implemented)

Backend (`backend/project_config/settings.py`):

- `SESSION_ENGINE = 'django.contrib.sessions.backends.cache'`
- `SESSION_COOKIE_NAME = 'sessionid'`
- `SESSION_COOKIE_AGE = 86400` (24h)
- `SESSION_COOKIE_HTTPONLY = True`
- `SESSION_COOKIE_SAMESITE = 'Lax'`
- `SESSION_COOKIE_SECURE = env_bool('SESSION_COOKIE_SECURE', False)`

Backend auth class (`authentication.authentication.SessionAuthentication`):

- authenticates from `request.session['user_id']`
- rejects missing user / inactive user

## CSRF Protection (Implemented)

Backend settings:

- `CSRF_COOKIE_NAME = 'csrftoken'`
- `CSRF_COOKIE_HTTPONLY = False` (frontend reads token)
- `CSRF_COOKIE_SAMESITE = 'Lax'`
- `CSRF_COOKIE_SECURE = env_bool('CSRF_COOKIE_SECURE', False)`
- `CSRF_USE_SESSIONS = False`

Frontend (`frontend/src/utils/api.js` + `frontend/src/utils/csrf.js`):

- `withCredentials: true` on axios instance
- `X-CSRFToken` header injected for `POST/PUT/PATCH/DELETE`
- CSRF cookie initialized by `GET /api/auth/csrf/`

## Global Auth Error Handling (Implemented)

Axios response interceptor:

- on `401` or non-CSRF `403`, dispatches `auth_error`
- `AuthContext` listens for `auth_error` and resets user/socket state

## WebSocket Security (Current State)

### Implemented

- `ws/games/` uses session-backed `scope.user` via `SessionUserAuthMiddlewareStack`
- users can only join games where they are player_1/player_2

### Not Fully Implemented

- `ws/notifications/` auth path is placeholder (`_get_user_from_token_notification` returns `None`), so connection closes with `4401`
- no JWT-based WS auth (commented as future work)

## Transport / Proxy Security

### Development config (`nginx/nginx.conf`)

- TLS enabled with local cert
- strong TLS protocols/ciphers configured
- security headers present (HSTS, X-Frame-Options, etc.)
- proxies `/api/`, `/media/`, `/ws/games/`, `/ws/notifications/`

### Production config (`nginx/nginx.prod.conf`)

- currently listens on `80` and proxies traffic
- does **not** include TLS termination itself
- HTTPS must be provided externally (LB/ingress/reverse proxy) if required

## Implemented Security Controls Summary

1. Session cookies are HttpOnly and same-site constrained
2. CSRF protection for state-changing HTTP requests
3. Server-side session auth (no client-stored access token)
4. Session-based WS user resolution for game channel
5. Basic account status checks (`is_active`) during auth

## Known Gaps / Not Implemented Yet

1. Built-in rate limiting on auth/social/game endpoints
2. Account lockout after repeated failed logins
3. CSP header policy in Django/Nginx layer
4. Fully functional notification websocket auth channel
5. Explicit security audit/event logging pipeline
