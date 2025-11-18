// API base URL configuration
// Uses VITE_API_URL environment variable in production, falls back to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default API_BASE_URL;
