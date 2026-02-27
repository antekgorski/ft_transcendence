import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API_BASE_URL from '../config';
import api from '../utils/api';
import { AuthContext } from '../contexts/AuthContext';

function RegisterPage() {
  const navigate = useNavigate();
  const { checkAuth } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    passwordConfirm: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.password !== formData.passwordConfirm) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/register/', {
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });

      if (response.status === 201) {
        setSuccess('Registration successful! Logging you in...');
        // checkAuth will be called in useEffect when success is set
        await checkAuth();
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error ||
        err.response?.data?.error_pl ||
        'Registration failed';
      setError(errorMsg);
      console.error('Registration error:', err);
      setLoading(false);
    }
  };

  // Cleanup timeout on unmount and redirect after successful registration
  useEffect(() => {
    if (!success) return;

    const timer = setTimeout(() => {
      navigate('/');
    }, 1000);

    return () => clearTimeout(timer);
  }, [success, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-blue-900 p-5">
      <div className="flex flex-col items-center gap-10 max-w-md w-full">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white tracking-wide drop-shadow-lg">
            ⚓ BATTLESHIPS
          </h1>
          <p className="text-lg text-emerald-400 mt-2 tracking-wide">
            Create Your Account
          </p>
        </div>

        {/* Register Form */}
        <div className="w-full bg-white/95 rounded-xl shadow-2xl p-10 backdrop-blur-sm">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-center">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md text-center">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">
              Register
            </h2>

            <input
              type="text"
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleInputChange}
              required
              disabled={loading}
              autoComplete="username"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-md text-base 
                         focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
                         disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
            />

            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleInputChange}
              required
              disabled={loading}
              autoComplete="email"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-md text-base 
                         focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
                         disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
            />

            <input
              type="password"
              name="password"
              placeholder="Password (min 8 characters)"
              value={formData.password}
              onChange={handleInputChange}
              required
              disabled={loading}
              minLength={8}
              autoComplete="new-password"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-md text-base 
                         focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
                         disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
            />

            <input
              type="password"
              name="passwordConfirm"
              placeholder="Confirm Password"
              value={formData.passwordConfirm}
              onChange={handleInputChange}
              required
              disabled={loading}
              autoComplete="new-password"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-md text-base 
                         focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
                         disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-2 bg-gradient-to-r from-emerald-500 to-emerald-600 
                         text-white font-bold uppercase tracking-wider rounded-md
                         hover:from-emerald-600 hover:to-emerald-700 hover:shadow-lg
                         disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'REGISTERING...' : 'REGISTER'}
            </button>

            <button
              type="button"
              onClick={() => window.location.href = `${API_BASE_URL}/auth/oauth/42/start/`}
              className="w-full py-3 bg-blue-600 text-white font-bold uppercase rounded-md
                         hover:bg-blue-700 transition-all"
            >
              Sign up with 42
            </button>

            <p className="text-center text-gray-600 mt-2">
              Already have an account?{' '}
              <Link
                to="/"
                className="text-emerald-600 font-semibold hover:text-emerald-700"
              >
                Login
              </Link>
            </p>
          </form>
        </div>

        {/* Footer */}
        <p className="text-gray-400 text-sm">
          ft_transcendence - 42 School Project
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
