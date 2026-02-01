const API_BASE_URL = process.env.REACT_APP_API_URL;

if (!API_BASE_URL) {
  throw new Error('REACT_APP_API_URL environment variable is not set');
}

console.log('API_BASE_URL:', API_BASE_URL);

export default API_BASE_URL;
