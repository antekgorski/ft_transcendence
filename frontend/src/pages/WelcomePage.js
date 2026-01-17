import React, { useState } from 'react';
import API_BASE_URL from '../config';
import '../styles/WelcomePage.css';

function WelcomePage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
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
    // Clear errors when user types
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isLogin) {
      // Registration validation
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
        const response = await fetch(`${API_BASE_URL}/auth/register/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: formData.username,
            email: formData.email,
            password: formData.password,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          setSuccess('Registration successful! You can now login.');
          setIsLogin(true);
          setFormData({
            username: '',
            email: '',
            password: '',
            passwordConfirm: ''
          });
        } else {
          setError(data.error || 'Registration failed');
        }
      } catch (err) {
        setError('Network error. Please try again.');
        console.error('Registration error:', err);
      } finally {
        setLoading(false);
      }
    } else {
      // Login logic (to be implemented later)
      console.log('Login submitted:', formData);
      if (onLogin) {
        onLogin();
      }
    }
  };

  const toggleForm = () => {
    setIsLogin(!isLogin);
    setFormData({
      username: '',
      email: '',
      password: '',
      passwordConfirm: ''
    });
    setError('');
    setSuccess('');
  };

  return (
    <div className="welcome-container">
      <div className="welcome-content">
        <div className="game-header">
          <h1 className="game-title">⚓ BATTLESHIP</h1>
          <p className="game-subtitle">3D Tactical Multiplayer Game</p>
        </div>

        <div className="auth-form-container">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          
          {isLogin ? (
            <form onSubmit={handleSubmit} className="auth-form">
              <h2>Login</h2>
              
              <div className="form-group">
                <input
                  type="text"
                  name="username"
                  placeholder="Username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'LOGGING IN...' : 'LOGIN'}
              </button>

              <p className="toggle-text">
                Don't have an account?{' '}
                <button type="button" onClick={toggleForm} className="toggle-btn" disabled={loading}>
                  Sign Up
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form">
              <h2>Register</h2>

              <div className="form-group">
                <input
                  type="text"
                  name="username"
                  placeholder="Username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <input
                  type="password"
                  name="password"
                  placeholder="Password (min 8 characters)"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                  minLength={8}
                />
              </div>

              <div className="form-group">
                <input
                  type="password"
                  name="passwordConfirm"
                  placeholder="Confirm Password"
                  value={formData.passwordConfirm}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'REGISTERING...' : 'REGISTER'}
              </button>

              <p className="toggle-text">
                Already have an account?{' '}
                <button type="button" onClick={toggleForm} className="toggle-btn" disabled={loading}>
                  Login
                </button>
              </p>
            </form>
          )}
        </div>

        <div className="footer-text">
          <p>ft_transcendence - 42 School Project</p>
        </div>
      </div>
    </div>
  );
}

export default WelcomePage;
