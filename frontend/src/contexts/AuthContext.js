import { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      // Verify authentication via backend - this validates the session cookie
      const res = await axios.get(`${API_BASE_URL}/auth/me/`, { 
        withCredentials: true 
      });
      setUser(res.data);
    } catch (err) {
      // Not authenticated or session invalid
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth(); // Check auth on app mount
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, checkAuth }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
