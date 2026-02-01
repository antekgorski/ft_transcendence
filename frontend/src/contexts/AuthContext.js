import { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      // Zapytanie do endpointu, który sprawdza sesję (np. /api/auth/me)
      const res = await axios.get(`${API_BASE_URL}/api/auth/me/`, { withCredentials: true });
      setUser(res.data); // Ustawiamy dane użytkownika (np. {id: 1, username: 'Jan'})
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth(); // Sprawdź przy starcie aplikacji
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, checkAuth }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
