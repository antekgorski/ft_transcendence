import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import API_BASE_URL from './config';

function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tables, setTables] = useState([]);

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/tables/`);
      if (response.data.success) {
        setTables(response.data.tables);
      }
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/execute/`, {
        query: query
      });

      if (response.data.success) {
        setResults(response.data);
        
        // Refresh table list if query affects table structure
        const upperQuery = query.trim().toUpperCase();
        if (upperQuery.startsWith('CREATE TABLE') || 
            upperQuery.startsWith('DROP TABLE') || 
            upperQuery.startsWith('ALTER TABLE')) {
          fetchTables();
        }
      }
    } catch (err) {
      if (err.response && err.response.data) {
        setError(err.response.data);
      } else {
        setError({
          error: 'Network error or server is not responding',
          error_type: 'ConnectionError'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults(null);
    setError(null);
  };

  const handleExampleClick = (exampleQuery) => {
    setQuery(exampleQuery);
  };

  const handleTableClick = async (tableName) => {
    setQuery(`SELECT * FROM ${tableName} LIMIT 10;`);
  };

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>🗄️ SQL Query Executor</h1>
          <p>Execute SQL queries on your Neon PostgreSQL database</p>
        </header>

        <div className="main-content">
          <aside className="sidebar">
            <h2>📊 Tables</h2>
            {tables.length > 0 ? (
              <ul className="table-list">
                {tables.map((table) => (
                  <li key={table} onClick={() => handleTableClick(table)}>
                    {table}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: '0.9rem', color: '#666' }}>
                No tables found or loading...
              </p>
            )}
          </aside>

          <main className="query-section">
            <form onSubmit={handleSubmit} className="query-form">
              <div className="form-group">
                <label htmlFor="query">SQL Query:</label>
                <textarea
                  id="query"
                  className="query-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter your SQL query here... (e.g., SELECT * FROM table_name;)"
                  disabled={loading}
                />
              </div>

              <div className="button-group">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || !query.trim()}
                >
                  {loading ? '⏳ Executing...' : '▶️ Execute Query'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleClear}
                  disabled={loading}
                >
                  🗑️ Clear
                </button>
              </div>
            </form>

            <div className="example-queries">
              <h3>💡 Example Queries (click to use):</h3>
              <code onClick={() => handleExampleClick('SELECT current_database();')}>
                SELECT current_database();
              </code>
              <code onClick={() => handleExampleClick('SELECT version();')}>
                SELECT version();
              </code>
              <code onClick={() => handleExampleClick("CREATE TABLE test_table (id SERIAL PRIMARY KEY, name VARCHAR(100), created_at TIMESTAMP DEFAULT NOW());")}>
                CREATE TABLE test_table (...);
              </code>
              <code onClick={() => handleExampleClick("INSERT INTO test_table (name) VALUES ('Test Entry');")}>
                INSERT INTO test_table VALUES (...);
              </code>
            </div>

            {loading && (
              <div className="loading">
                <p>⏳ Executing query...</p>
              </div>
            )}

            {error && (
              <div className="results-section">
                <div className="alert alert-error">
                  <h4>❌ Error: {error.error_type || 'Error'}</h4>
                  <p><strong>Message:</strong> {error.error}</p>
                  {error.query && (
                    <p><strong>Query:</strong> <code>{error.query}</code></p>
                  )}
                  {error.traceback && (
                    <pre>{error.traceback}</pre>
                  )}
                </div>
              </div>
            )}

            {results && (
              <div className="results-section">
                <div className="alert alert-success">
                  <h4>✅ Success!</h4>
                  {results.data ? (
                    <p><strong>Rows returned:</strong> {results.row_count}</p>
                  ) : (
                    <p>{results.message}</p>
                  )}
                </div>

                {results.data && results.data.length > 0 && (
                  <div className="table-container">
                    <table className="results-table">
                      <thead>
                        <tr>
                          {results.columns.map((col) => (
                            <th key={col}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.data.map((row, idx) => (
                          <tr key={idx}>
                            {results.columns.map((col) => (
                              <td key={col}>
                                {row[col] !== null ? String(row[col]) : <em style={{ color: '#999' }}>NULL</em>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
