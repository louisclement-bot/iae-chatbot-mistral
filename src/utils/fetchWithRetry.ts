/**
 * @file Fetch utility with retry, backoff, and timeout handling
 * 
 * This utility wraps the native fetch API with retry logic, exponential backoff,
 * timeout handling, and proper error types. It is used by all services to make
 * API calls with resilience.
 */

import { FetchWithRetryOptions, Result } from '@types/index';

/**
 * Error types for fetch operations
 */
export enum FetchErrorType {
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  SERVER = 'server',
  CLIENT = 'client',
  RATE_LIMIT = 'rate_limit',
  PARSE = 'parse',
  ABORT = 'abort',
  UNKNOWN = 'unknown',
}

/**
 * Extended Error class for fetch operations
 */
export class FetchError extends Error {
  public readonly type: FetchErrorType;
  public readonly status?: number;
  public readonly retryAfter?: number;
  public readonly response?: Response;
  public readonly url: string;
  public readonly attempt: number;

  constructor(
    message: string,
    type: FetchErrorType,
    url: string,
    attempt: number,
    options: {
      status?: number;
      retryAfter?: number;
      response?: Response;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'FetchError';
    this.type = type;
    this.status = options.status;
    this.retryAfter = options.retryAfter;
    this.response = options.response;
    this.url = url;
    this.attempt = attempt;
    this.cause = options.cause;
  }

  /**
   * Check if the error should be retried based on its type and status
   */
  public shouldRetry(maxRetries: number = 3): boolean {
    // Don't retry if we've already tried too many times
    if (this.attempt >= maxRetries) {
      return false;
    }

    // Retry network errors
    if (this.type === FetchErrorType.NETWORK) {
      return true;
    }

    // Retry server errors (except 413 - payload too large)
    if (this.type === FetchErrorType.SERVER && this.status !== 413) {
      return true;
    }

    // Retry rate limit errors
    if (this.type === FetchErrorType.RATE_LIMIT) {
      return true;
    }

    // Don't retry other errors
    return false;
  }

  /**
   * Get the retry delay in milliseconds
   */
  public getRetryDelay(baseDelay: number = 500, maxDelay: number = 30000): number {
    // If we have a Retry-After header, use that
    if (this.retryAfter && this.retryAfter > 0) {
      // Convert to milliseconds and ensure it's not too large
      return Math.min(this.retryAfter * 1000, maxDelay);
    }

    // Otherwise use exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, this.attempt - 1);
    const jitter = Math.random() * 0.3 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, maxDelay);
  }
}

/**
 * Default options for fetchWithRetry
 */
const defaultOptions: Required<Pick<FetchWithRetryOptions, 'retries' | 'backoff' | 'maxBackoff' | 'timeout'>> = {
  retries: 3,
  backoff: 500, // 500ms initial backoff
  maxBackoff: 30000, // 30 seconds maximum backoff
  timeout: 20000, // 20 seconds timeout
};

/**
 * Parse the Retry-After header to get the retry delay in seconds
 */
function parseRetryAfter(response: Response): number | undefined {
  const retryAfter = response.headers.get('Retry-After');
  if (!retryAfter) {
    return undefined;
  }

  // Retry-After can be a date or a number of seconds
  if (/^\d+$/.test(retryAfter)) {
    return parseInt(retryAfter, 10);
  } else {
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
      return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000));
    }
  }

  return undefined;
}

/**
 * Determine the error type based on the response status
 */
function getErrorTypeFromStatus(status: number): FetchErrorType {
  if (status >= 500) {
    return FetchErrorType.SERVER;
  } else if (status === 429) {
    return FetchErrorType.RATE_LIMIT;
  } else if (status >= 400) {
    return FetchErrorType.CLIENT;
  }
  return FetchErrorType.UNKNOWN;
}

/**
 * Create an appropriate error object from a fetch response
 */
async function createErrorFromResponse(
  response: Response,
  url: string,
  attempt: number
): Promise<FetchError> {
  const status = response.status;
  const type = getErrorTypeFromStatus(status);
  const retryAfter = parseRetryAfter(response);

  let message = `HTTP error ${status}`;
  try {
    // Try to get more details from the response body
    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (data.error || data.message) {
        message = `HTTP error ${status}: ${data.error || data.message}`;
      }
    } else {
      const text = await response.text();
      if (text.length < 100) {
        // Only include short text responses in the error message
        message = `HTTP error ${status}: ${text}`;
      }
    }
  } catch (e) {
    // Ignore parsing errors
  }

  return new FetchError(message, type, url, attempt, {
    status,
    retryAfter,
    response: response.clone(),
  });
}

/**
 * Fetch with retry, backoff, and timeout
 * 
 * @param url - URL to fetch
 * @param options - Fetch options with retry configuration
 * @returns Promise resolving to the fetch response
 * @throws FetchError if all retries fail
 */
export async function fetchWithRetry<T>(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Result<T, FetchError>> {
  const {
    retries = defaultOptions.retries,
    backoff = defaultOptions.backoff,
    maxBackoff = defaultOptions.maxBackoff,
    timeout = defaultOptions.timeout,
    ...fetchOptions
  } = options;

  let attempt = 1;

  while (true) {
    // Create a new AbortController for this attempt
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Add the signal to the fetch options
      const signal = controller.signal;
      const response = await fetch(url, { ...fetchOptions, signal });

      // Clear the timeout
      clearTimeout(timeoutId);

      // Handle successful responses
      if (response.ok) {
        let data: T;
        try {
          // Handle different response types
          const contentType = response.headers.get('Content-Type') || '';
          if (contentType.includes('application/json')) {
            data = await response.json();
          } else if (contentType.includes('text/event-stream')) {
            // For SSE streams, return the response directly
            return { success: true, data: response as unknown as T };
          } else if (contentType.includes('text/')) {
            // For text responses, return the text
            data = await response.text() as unknown as T;
          } else {
            // For binary responses, return the blob
            data = await response.blob() as unknown as T;
          }
          return { success: true, data };
        } catch (error) {
          // Handle JSON parsing errors
          const parseError = new FetchError(
            `Failed to parse response: ${(error as Error).message}`,
            FetchErrorType.PARSE,
            url,
            attempt,
            { cause: error as Error }
          );
          return { success: false, error: parseError };
        }
      }

      // Handle error responses based on status code
      const error = await createErrorFromResponse(response, url, attempt);

      // Check if we should retry
      if (error.shouldRetry(retries)) {
        // Calculate the retry delay
        const delay = error.getRetryDelay(backoff, maxBackoff);
        
        // Log the retry attempt
        console.warn(`Retrying fetch to ${url} after ${delay}ms (attempt ${attempt}/${retries}): ${error.message}`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Increment the attempt counter
        attempt++;
        continue;
      }

      // If we shouldn't retry, return the error
      return { success: false, error };
    } catch (error) {
      // Clear the timeout
      clearTimeout(timeoutId);

      // Handle fetch errors (network errors, aborts, etc.)
      let fetchError: FetchError;
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        fetchError = new FetchError(
          `Request timed out after ${timeout}ms`,
          FetchErrorType.TIMEOUT,
          url,
          attempt,
          { cause: error }
        );
      } else {
        fetchError = new FetchError(
          `Network error: ${(error as Error).message}`,
          FetchErrorType.NETWORK,
          url,
          attempt,
          { cause: error as Error }
        );
      }

      // Check if we should retry
      if (fetchError.shouldRetry(retries)) {
        // Calculate the retry delay
        const delay = fetchError.getRetryDelay(backoff, maxBackoff);
        
        // Log the retry attempt
        console.warn(`Retrying fetch to ${url} after ${delay}ms (attempt ${attempt}/${retries}): ${fetchError.message}`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Increment the attempt counter
        attempt++;
        continue;
      }

      // If we shouldn't retry, return the error
      return { success: false, error: fetchError };
    }
  }
}

/**
 * Special retry handling for rate limits
 * 
 * This follows the API spec requirements:
 * - 408/502/503/504: Retry up to 3 times (0.5s → 1.5s → 3s)
 * - 429: Retry up to 4 times with exponential back-off; respect Retry-After
 * - 4xx (other): Do not retry
 * - stream timeout > 20s: Abort & fallback to non-stream completion
 */
export function shouldRetryRequest(status: number): boolean {
  // Server errors and gateway timeouts
  if (status === 408 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  
  // Rate limiting
  if (status === 429) {
    return true;
  }
  
  // Don't retry other client errors
  if (status >= 400 && status < 500) {
    return false;
  }
  
  // Retry other server errors
  return status >= 500;
}

/**
 * Get the maximum number of retries based on the status code
 */
export function getMaxRetries(status: number): number {
  // Rate limiting gets more retries
  if (status === 429) {
    return 4;
  }
  
  // Server errors get standard retries
  if (status === 408 || status === 502 || status === 503 || status === 504 || status >= 500) {
    return 3;
  }
  
  // Don't retry other errors
  return 0;
}

/**
 * Fetch with streaming support and retry logic
 * 
 * @param url - URL to fetch
 * @param options - Fetch options with retry configuration
 * @returns Promise resolving to a ReadableStream
 * @throws FetchError if all retries fail
 */
export async function fetchStream(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Result<ReadableStream<Uint8Array>, FetchError>> {
  // Set up options for streaming
  const streamOptions: FetchWithRetryOptions = {
    ...options,
    headers: {
      ...options.headers,
      'Accept': 'text/event-stream',
    },
  };
  
  // Use a longer timeout for streaming
  if (!streamOptions.timeout) {
    streamOptions.timeout = 60000; // 1 minute
  }
  
  // Use fetchWithRetry to handle retries
  const result = await fetchWithRetry<Response>(url, streamOptions);
  
  if (!result.success) {
    return { success: false, error: result.error };
  }
  
  // Return the stream
  return { 
    success: true, 
    data: result.data.body as ReadableStream<Uint8Array> 
  };
}

export default fetchWithRetry;
