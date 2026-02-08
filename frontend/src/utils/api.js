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
    // Handle 401 Unauthorized globally
    if (error.response?.status === 401) {
      console.warn('Unauthorized request, user may need to log in');
    }
    
    // Handle 403 CSRF errors
    if (error.response?.status === 403) {
      const detail = error.response?.data?.detail || '';
      if (detail.toLowerCase().includes('csrf')) {
        console.error('CSRF token validation failed. Try refreshing the page.');
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
