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
    const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://localhost:8080/api';
    await fetch(`${API_BASE_URL}/auth/me/`, {
      method: 'GET',
      credentials: 'include',
    });
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
  }
}
