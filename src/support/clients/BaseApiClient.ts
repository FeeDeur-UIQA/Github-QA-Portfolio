import type { APIRequestContext } from '@playwright/test';

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string | string[]>;
  duration: number;
}

export class ApiError extends Error {
  status: number;
  endpoint: string;
  timestamp: string;

  constructor(status: number, message: string, endpoint: string, timestamp: string = new Date().toISOString()) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
    this.timestamp = timestamp;
  }
}

export class BaseApiClient {
  protected baseUrl: string;
  protected maxRetries = 3;
  protected retryDelay = 500; // ms

  constructor(
    protected request: APIRequestContext,
    baseUrl: string = process.env.API_BASE_URL || 'https://automationexercise.com/api'
  ) {
    this.baseUrl = baseUrl;
  }

  /**
   * GET request with retry logic
   */
  async get<T>(
    endpoint: string,
    options?: { params?: Record<string, string | number>; timeout?: number }
  ): Promise<ApiResponse<T>> {
    return this.executeWithRetry<T>(() =>
      this.performGet<T>(endpoint, options)
    );
  }

  /**
   * POST request with retry logic
   */
  async post<T>(
    endpoint: string,
    data?: Record<string, any>,
    options?: { timeout?: number }
  ): Promise<ApiResponse<T>> {
    return this.executeWithRetry<T>(() =>
      this.performPost<T>(endpoint, data, options)
    );
  }

  /**
   * HEAD request to check endpoint availability
   */
  async head(endpoint: string): Promise<number> {
    const startTime = performance.now();
    try {
      const response = await this.request.head(this.resolveUrl(endpoint));
      const duration = performance.now() - startTime;
      console.log('API HEAD Request', {
        endpoint,
        status: response.status(),
        duration: `${duration.toFixed(2)}ms`,
      });
      return response.status();
    } catch (error) {
      const apiError = this.translateError(error, 'HEAD', endpoint);
      console.error('API HEAD Request Failed', {
        endpoint,
        error: apiError.message,
      });
      throw apiError;
    }
  }

  /**
   * Private: Execute GET
   */
  private async performGet<T>(
    endpoint: string,
    options?: { params?: Record<string, string | number>; timeout?: number }
  ): Promise<ApiResponse<T>> {
    const startTime = performance.now();
    const url = new URL(this.resolveUrl(endpoint));

    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    try {
      const response = await this.request.get(url.toString(), {
        timeout: options?.timeout || 10000,
        headers: {
          'Accept': 'application/json',
        },
      });
      const duration = performance.now() - startTime;
      const data = await response.json();

      console.log('API GET Success', {
        endpoint,
        status: response.status(),
        duration: `${duration.toFixed(2)}ms`,
        contentType: response.headers()['content-type'],
        dataPreview: JSON.stringify(data).substring(0, 200),
      });

      return {
        data: data as T,
        status: response.status(),
        headers: response.headers(),
        duration,
      };
    } catch (error) {
      const apiError = this.translateError(error, 'GET', endpoint);
      console.error('API GET Failed', {
        endpoint,
        error: apiError.message,
        status: apiError.status,
      });
      throw apiError;
    }
  }

  /**
   * Private: Execute POST
   */
  private async performPost<T>(
    endpoint: string,
    data?: Record<string, any>,
    options?: { timeout?: number; contentType?: 'json' | 'form' }
  ): Promise<ApiResponse<T>> {
    const startTime = performance.now();

    try {
      // For search endpoints, use form-urlencoded; otherwise use JSON
      const useFormEncoding = endpoint.includes('search') || options?.contentType === 'form';
      
      const postOptions: any = {
        timeout: options?.timeout || 10000,
      };

      if (useFormEncoding) {
        // Convert to form-urlencoded format
        const formData = new URLSearchParams();
        if (data) {
          Object.entries(data).forEach(([key, value]) => {
            formData.append(key, String(value));
          });
        }
        postOptions.data = formData.toString();
        postOptions.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      } else {
        postOptions.data = data || {};
      }

      const response = await this.request.post(this.resolveUrl(endpoint), postOptions as Parameters<typeof this.request.post>[1]);
      const duration = performance.now() - startTime;
      const responseData = await response.json();

      console.log('API POST Success', {
        endpoint,
        status: response.status(),
        duration: `${duration.toFixed(2)}ms`,
        payloadSize: JSON.stringify(data).length,
        contentType: useFormEncoding ? 'form-urlencoded' : 'json',
      });

      return {
        data: responseData as T,
        status: response.status(),
        headers: response.headers(),
        duration,
      };
    } catch (error) {
      const apiError = this.translateError(error, 'POST', endpoint);
      console.error('API POST Failed', {
        endpoint,
        error: apiError.message,
        status: apiError.status,
      });
      throw apiError;
    }
  }

  /**
   * Retry logic with exponential backoff
   */
  private async executeWithRetry<T>(
    operation: () => Promise<ApiResponse<T>>,
    attempt = 1
  ): Promise<ApiResponse<T>> {
    try {
      return await operation();
    } catch (error) {
      if (attempt < this.maxRetries && this.isRetryableError(error)) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        console.log('API Retry', {
          attempt,
          nextRetryIn: `${delay}ms`,
        });
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeWithRetry<T>(operation, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Determine if error should trigger retry
   */
  private isRetryableError(error: any): boolean {
    // Network errors, 429 (throttle), 5xx should retry
    // 4xx client errors should NOT retry
    if (error.status) {
      return error.status === 429 || error.status >= 500;
    }
    // Network errors are retryable
    return Boolean(error.message?.includes('ECONNRESET') ||
           error.message?.includes('ETIMEDOUT') ||
           error.message?.includes('ENOTFOUND'));
  }

  /**
   * Translate errors to structured format
   */
  private translateError(error: any, method: string, endpoint: string): ApiError {
    const apiError = new ApiError(
      typeof error?.status === 'number' ? error.status : 0,
      error?.message ?? 'Unknown error',
      endpoint,
      new Date().toISOString()
    );

    const errorMessage = `[${method}] ${endpoint} failed: ${apiError.message} (Status: ${apiError.status})`;
    apiError.message = errorMessage;

    console.error('API Error Translation', {
      method,
      status: apiError.status,
      message: apiError.message,
      endpoint: apiError.endpoint,
      timestamp: apiError.timestamp,
    });

    return apiError;
  }

  /**
   * Resolve full URL
   */
  protected resolveUrl(endpoint: string): string {
    const fullUrl = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    console.log(`🔗 Resolving URL: ${endpoint} -> ${fullUrl}`);
    return fullUrl;
  }
}
