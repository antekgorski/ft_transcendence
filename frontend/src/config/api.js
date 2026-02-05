/**
 * API Configuration
 * 
 * Centralna konfiguracja dla wszystkich połączeń z backendem.
 * Zawiera URL-e do REST API i WebSocket oraz helpery do zarządzania tokenem JWT.
 */

// Pobieramy bazowy URL z zmiennej środowiskowej (ustawianej w .env.local lub docker-compose)
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Weryfikujemy czy zmienna środowiskowa jest ustawiona
if (!process.env.REACT_APP_API_URL) {
  console.warn('REACT_APP_API_URL not set, using default:', API_BASE_URL);
}

// Wyznaczamy URL do WebSocket na podstawie API_BASE_URL
// Zamieniamy http:// na ws:// i https:// na wss://
const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws').replace('/api', '');

// Klucz do przechowywania tokena JWT w localStorage
const AUTH_TOKEN_KEY = 'authToken';

// Klucz do przechowywania danych użytkownika w localStorage
const USER_DATA_KEY = 'user';

/**
 * Pobiera token JWT z localStorage.
 * @returns {string|null} Token JWT lub null jeśli nie istnieje.
 */
export const getAuthToken = () => {
  try {
    // Pobieramy token z localStorage
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch (error) {
    // W przypadku błędu (np. localStorage niedostępny) logujemy i zwracamy null
    console.error('Error getting auth token:', error);
    return null;
  }
};

/**
 * Zapisuje token JWT do localStorage.
 * @param {string} token - Token JWT do zapisania.
 */
export const setAuthToken = (token) => {
  try {
    // Zapisujemy token do localStorage
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch (error) {
    // W przypadku błędu logujemy
    console.error('Error setting auth token:', error);
  }
};

/**
 * Usuwa token JWT z localStorage (podczas wylogowania).
 */
export const removeAuthToken = () => {
  try {
    // Usuwamy token z localStorage
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (error) {
    // W przypadku błędu logujemy
    console.error('Error removing auth token:', error);
  }
};

/**
 * Pobiera dane użytkownika z localStorage.
 * @returns {object|null} Obiekt z danymi użytkownika lub null.
 */
export const getUserData = () => {
  try {
    // Pobieramy dane użytkownika z localStorage
    const userData = localStorage.getItem(USER_DATA_KEY);
    // Parsujemy JSON i zwracamy obiekt
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    // W przypadku błędu (np. nieprawidłowy JSON) logujemy i zwracamy null
    console.error('Error getting user data:', error);
    return null;
  }
};

/**
 * Zapisuje dane użytkownika do localStorage.
 * @param {object} userData - Obiekt z danymi użytkownika (id, username, email, etc.)
 */
export const setUserData = (userData) => {
  try {
    // Serializujemy obiekt do JSON i zapisujemy w localStorage
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
  } catch (error) {
    // W przypadku błędu logujemy
    console.error('Error setting user data:', error);
  }
};

/**
 * Usuwa dane użytkownika z localStorage (podczas wylogowania).
 */
export const removeUserData = () => {
  try {
    // Usuwamy dane użytkownika z localStorage
    localStorage.removeItem(USER_DATA_KEY);
  } catch (error) {
    // W przypadku błędu logujemy
    console.error('Error removing user data:', error);
  }
};

/**
 * Tworzy nagłówki HTTP z tokenem JWT (jeśli istnieje).
 * @returns {object} Obiekt z nagłówkami HTTP.
 */
export const getAuthHeaders = () => {
  // Pobieramy token
  const token = getAuthToken();
  
  // Bazowe nagłówki
  const headers = {
    'Content-Type': 'application/json',
  };
  
  // Jeśli token istnieje, dodajemy nagłówek Authorization
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Zwracamy obiekt z nagłówkami
  return headers;
};

/**
 * Sprawdza czy użytkownik jest zalogowany (czy token istnieje).
 * @returns {boolean} True jeśli token istnieje, false w przeciwnym razie.
 */
export const isAuthenticated = () => {
  // Sprawdzamy czy token istnieje w localStorage
  return !!getAuthToken();
};

/**
 * Wylogowuje użytkownika - usuwa token i dane użytkownika.
 */
export const logout = () => {
  // Usuwamy token JWT
  removeAuthToken();
  // Usuwamy dane użytkownika
  removeUserData();
};

// Eksportujemy konfigurację URL-i jako domyślny export
export default {
  API_BASE_URL,
  WS_BASE_URL,
  AUTH_TOKEN_KEY,
  USER_DATA_KEY,
};
