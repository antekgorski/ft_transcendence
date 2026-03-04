import API_BASE_URL from '../config';

/**
 * CSRF Token Utility
 * 
 * Provides functions to retrieve and manage CSRF tokens for secure API requests.
 */

/**
 * Get CSRF token from cookie
 * @returns {string|null} CSRF token value or null if not found
 */
export function getCsrfToken() {
  const name = 'csrftoken';
  let cookieValue = null;

  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }

  return cookieValue;
}



/**
 * Fetch CSRF token from backend endpoint
 * This should be called once on app initialization to ensure CSRF cookie is set
 * @returns {Promise<void>}
 */
export async function fetchCsrfToken() {

  try {
    await fetch(`${API_BASE_URL}/auth/csrf/`, {
      method: 'GET',
      credentials: 'include',
    });
  } catch (error) {
    // fallback to public endpoint; failure can safely be ignored as token will
    // be retrieved on the first real request.
    try {
      await fetch(`${API_BASE_URL}/csrf/`, {
        method: 'GET',
        credentials: 'include',
      });
    } catch (_) {
      /* ignore */
    }
  }
}
