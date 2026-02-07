import { createContext, useState, useEffect } from 'react';
import api from '../utils/api';
import { fetchCsrfToken } from '../utils/csrf';
import { gameSocket } from '../utils/socket';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      // Verify authentication via backend - this validates the session cookie
      const res = await api.get('/auth/me/');
      setUser(res.data);
      // Connect to WebSocket after successful authentication
      gameSocket.preConnect();
    } catch (err) {
      // Not authenticated or session invalid
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch CSRF token and check auth on app mount
    const initialize = async () => {
      await fetchCsrfToken();
      await checkAuth();
    };
    initialize();
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, checkAuth }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
