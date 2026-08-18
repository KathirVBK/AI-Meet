/**
 * API utility for safe fetch calls with proper error handling.
 * Handles network errors, HTML responses, JSON parsing errors, and HTTP status codes.
 */

const API_BASE_URL = 'http://localhost:5000';

/**
 * Check if the response content is likely JSON
 * @param {string} contentType - The Content-Type header value
 * @returns {boolean} True if content type suggests JSON
 */
function isJsonContent(contentType) {
  if (!contentType) return false;
  return contentType.includes('application/json');
}

/**
 * Make a safe API call with proper error handling
 * @param {string} endpoint - The API endpoint (e.g., '/api/meetings/history')
 * @param {Object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise<Object>} Response object with { success, data, error, status }
 */
export async function apiCall(endpoint, options = {}) {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    const contentType = response.headers.get('content-type');
    const status = response.status;

    // Handle non-2xx status codes
    if (!response.ok) {
      let errorMessage = `HTTP ${status}`;
      let errorBody = null;

      try {
        // Try to get error details from response
        if (isJsonContent(contentType)) {
          errorBody = await response.json();
          errorMessage = errorBody.message || errorBody.error || errorMessage;
        } else {
          // If not JSON, try to read as text
          const text = await response.text();
          if (text && !text.startsWith('<!DOCTYPE')) {
            errorMessage = text.substring(0, 200); // Truncate long responses
          }
        }
      } catch (parseError) {
        // If we can't parse the error response, just use the status code
        console.warn('Could not parse error response:', parseError);
      }

      return {
        success: false,
        data: null,
        error: errorMessage,
        status,
        statusCode: status
      };
    }

    // Handle successful response
    if (!isJsonContent(contentType)) {
      // Backend is not running or returned an error page (HTML)
      const text = await response.text();
      if (text.startsWith('<!DOCTYPE') || text.includes('<html')) {
        return {
          success: false,
          data: null,
          error: 'Backend server is not responding properly. Please ensure the server is running.',
          status: 503,
          statusCode: 503
        };
      }
      // If it's not JSON and not HTML, return as-is
      return {
        success: true,
        data: text,
        error: null,
        status,
        statusCode: status
      };
    }

    // Parse JSON response
    try {
      const data = await response.json();
      return {
        success: true,
        data,
        error: null,
        status,
        statusCode: status
      };
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      return {
        success: false,
        data: null,
        error: 'Invalid JSON response from server',
        status,
        statusCode: status,
        parseError: true
      };
    }
  } catch (networkError) {
    // Network errors (no connection, timeout, etc.)
    const errorMessage = networkError.message === 'Failed to fetch'
      ? 'Unable to connect to the server. Is the backend running?'
      : `Network error: ${networkError.message}`;

    return {
      success: false,
      data: null,
      error: errorMessage,
      status: 0,
      statusCode: 0,
      networkError: true
    };
  }
}

/**
 * Get the auth headers for API calls
 * @returns {Object} Headers object with Authorization token if available
 */
export function getAuthHeaders() {
  const token = localStorage.getItem('token');
  if (!token) return {};
  return { 'Authorization': `Bearer ${token}` };
}

/**
 * Make an authenticated API call
 * @param {string} endpoint - The API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Response object with { success, data, error, status }
 */
export async function authApiCall(endpoint, options = {}) {
  return apiCall(endpoint, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers
    }
  });
}
