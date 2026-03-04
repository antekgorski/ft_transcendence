/**
 * API Utility Configuration
 * 
 * Centralized API configuration with automatic CSRF token and credentials handling.
 */

import axios from 'axios';
import { getCsrfToken } from './csrf';
import API_BASE_URL from '../config';

/**
 * Configured axios instance with CSRF and credentials support
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Always send cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor to add CSRF token to all state-changing requests
 */
api.interceptors.request.use(
  (config) => {
    // Add CSRF token to POST, PUT, PATCH, DELETE requests
    const method = (config.method || 'get').toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor for handling common errors
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized or 403 Forbidden globally
    const status = error.response?.status;

    if (status === 401 || status === 403) {
      // determine if this request was the login endpoint; we don't want to
      // treat bad credentials as a global auth error.
      const url = error.config?.url || '';
      const isLoginEndpoint = url.endsWith('/auth/login') || url.endsWith('/auth/login/');

      const detail = error.response?.data?.detail || '';
      const isCsrfError = detail.toLowerCase().includes('csrf');

      if (!isLoginEndpoint) {
        // dispatch event for everything except login attempts
        if (!(status === 403 && isCsrfError)) {
          window.dispatchEvent(new Event('auth_error'));
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
