import type { APIRequestContext } from '@playwright/test';

import type {
  ProductsListResponse,
  BrandsListResponse,
  SearchProductsResponse,
} from '../../types/api-schemas';

import type { ApiResponse } from './BaseApiClient';
import { ApiError, BaseApiClient } from './BaseApiClient';


export interface ProductFilters {
  page?: number;
  limit?: number;
}

export interface SearchQuery {
  search_product: string;
}

/**
 * ProductsApiClient
 * 
 * Provides type-safe API client methods for automationexercise.com API
 * Inherits retry logic, error handling, and logging from BaseApiClient
 * 
 * Usage:
 *   const apiClient = new ProductsApiClient(request);
 *   const response = await apiClient.getProductsList({ page: 1, limit: 20 });
 */
export class ProductsApiClient extends BaseApiClient {
  constructor(request: APIRequestContext, baseUrl?: string) {
    super(request, baseUrl);
  }

  /**
   * Get all products with optional filters
   * 
   * @param filters - Optional pagination filters (page, limit)
   * @returns Promise resolving to ApiResponse containing products list
   * @throws ApiError if request fails after retries
   */
  async getProductsList(
    filters?: ProductFilters
  ): Promise<ApiResponse<ProductsListResponse>> {
    // Filter out undefined values to avoid unnecessary query params
    const cleanFilters = filters
      ? Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== undefined)
        )
      : undefined;

    try {
      return await this.get<ProductsListResponse>('/productsList', {
        params: cleanFilters,
      });
    } catch (error) {
      // Re-throw with additional context about the request
      if (this.isApiError(error)) {
        console.error('❌ ProductsList Request Failed', {
          status: error.status,
          message: error.message,
          endpoint: error.endpoint,
          filters: cleanFilters,
        });
      }
      throw error;
    }
  }

  /**
   * Get all available brands
   * 
   * @returns Promise resolving to ApiResponse containing brands list
   * @throws ApiError if request fails after retries
   */
  async getBrandsList(): Promise<ApiResponse<BrandsListResponse>> {
    try {
      return await this.get<BrandsListResponse>('/brandsList');
    } catch (error) {
      if (this.isApiError(error)) {
        console.error('❌ BrandsList Request Failed', {
          status: error.status,
          message: error.message,
          endpoint: error.endpoint,
        });
      }
      throw error;
    }
  }

  /**
   * Search products by search term
   * 
   * @param query - Search query object containing search_product term
   * @returns Promise resolving to ApiResponse containing search results
   * @throws ApiError if request fails after retries or validation fails
   */
  async searchProducts(
    query: SearchQuery
  ): Promise<ApiResponse<SearchProductsResponse>> {
    // Validate input - allow empty search for edge case testing
    if (!query || typeof query.search_product !== 'string') {
      throw new Error('❌ SearchQuery must contain search_product field');
    }

    const sanitizedQuery = {
      search_product: String(query.search_product).trim(),
    };

    try {
      return await this.post<SearchProductsResponse>(
        '/searchProduct',
        sanitizedQuery
      );
    } catch (error) {
      if (this.isApiError(error)) {
        console.error('❌ Search Request Failed', {
          status: error.status,
          message: error.message,
          endpoint: error.endpoint,
          query: sanitizedQuery.search_product,
        });
      }
      throw error;
    }
  }

  /**
   * Health check to verify API endpoint is responsive
   * 
   * Used for setup/teardown validation before running tests
   * Returns true if endpoint responds with status < 500
   * 
   * @returns Promise<boolean> - true if API is healthy, false if unreachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      const status = await this.head('/productsList');
      const isHealthy = status < 500;
      
      console.log(isHealthy ? '✅ API Health Check: OK' : '⚠️ API Health Check: Degraded', {
        status,
        endpoint: '/productsList',
      });
      
      return isHealthy;
    } catch (error) {
      console.warn('⚠️ API Health Check: Failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Type guard to check if error is ApiError
   */
  private isApiError(error: unknown): error is ApiError {
    return (
      error instanceof ApiError ||
      (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        'message' in error &&
        'endpoint' in error &&
        'timestamp' in error
      )
    );
  }
}
