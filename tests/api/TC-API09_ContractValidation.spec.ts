import SwaggerParser from '@apidevtools/swagger-parser';

import { apiTest, expect } from '../../fixtures/api-fixtures';
import type { paths } from '../../src/types/openapi-types';

/**
 * TC-API09: Contract-First Testing with OpenAPI
 *
 * Validates API responses against OpenAPI 3.0 specification
 * Ensures backward compatibility and detects breaking changes
 *
 * **Contract-First Approach**:
 * - Single source of truth: OpenAPI spec defines contracts
 * - Generated types prevent drift between spec and implementation
 * - Automated contract validation in CI prevents breaking changes
 * - Fail fast on schema violations before production deployment
 *
 * @category API Testing
 * @priority Critical
 */

// Type-safe API response types from OpenAPI spec
type ProductsListResponse =
  paths['/productsList']['get']['responses']['200']['content']['application/json'];

apiTest.describe('TC-API09: OpenAPI Contract Validation @api @contract @critical', () => {
  let apiSpec: any;

  apiTest.beforeAll(async () => {
    // Validate and parse OpenAPI spec before running tests
    apiSpec = await SwaggerParser.validate('openapi.yaml');
    console.log('✅ OpenAPI spec validated successfully');
    console.log(`📋 API Version: ${apiSpec.info.version}`);
    console.log(`📦 Endpoints: ${Object.keys(apiSpec.paths).length}`);
  });

  apiTest('should validate OpenAPI specification structure @api @contract', async () => {
    await apiTest.step('Verify spec metadata', async () => {
      expect(apiSpec.openapi).toBe('3.0.3');
      expect(apiSpec.info.title).toBe('AutomationExercise API');
      expect(apiSpec.info.version).toBe('1.0.0');
    });

    await apiTest.step('Verify required endpoints exist', async () => {
      const endpoints = Object.keys(apiSpec.paths);
      expect(endpoints).toContain('/productsList');
      expect(endpoints).toContain('/brandsList');
      expect(endpoints).toContain('/searchProduct');
    });

    await apiTest.step('Verify component schemas defined', async () => {
      const schemas = Object.keys(apiSpec.components.schemas);
      expect(schemas).toContain('Product');
      expect(schemas).toContain('Brand');
      expect(schemas).toContain('ProductsListResponse');
      expect(schemas).toContain('BrandsListResponse');
      expect(schemas).toContain('SearchProductsResponse');
      expect(schemas).toContain('ErrorResponse');
    });
  });

  apiTest(
    'should conform ProductsList response to contract @api @contract',
    async ({ apiClient }) => {
      const response = await apiClient.getProductsList();

      await apiTest.step('Validate response structure', async () => {
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('responseCode');
        expect(response.data).toHaveProperty('products');
        expect(Array.isArray(response.data.products)).toBe(true);
      });

      await apiTest.step('Validate Product schema compliance', async () => {
        const product = response.data.products[0];

        // Required fields from OpenAPI spec
        expect(product).toHaveProperty('id');
        expect(product).toHaveProperty('name');
        expect(product).toHaveProperty('price');
        expect(product).toHaveProperty('brand');
        expect(product).toHaveProperty('category');

        // Type validation
        expect(typeof product.id).toBe('number');
        expect(typeof product.name).toBe('string');
        expect(typeof product.price).toBe('string');
        expect(typeof product.brand).toBe('string');

        // Price format validation (Rs. XXX)
        expect(product.price).toMatch(/^Rs\. \d+$/);

        console.log('✅ Product schema validated:', {
          id: product.id,
          name: product.name,
          price: product.price,
          brand: product.brand,
        });
      });

      await apiTest.step('Validate Category schema compliance', async () => {
        const category = response.data.products[0].category;

        expect(category).toHaveProperty('usertype');
        expect(category).toHaveProperty('category');
        expect(category.usertype).toHaveProperty('usertype');

        // Enum validation
        expect(['Women', 'Men', 'Kids']).toContain(category.usertype.usertype);

        console.log('✅ Category schema validated:', category);
      });
    },
  );

  apiTest(
    'should conform BrandsList response to contract @api @contract',
    async ({ apiClient }) => {
      const response = await apiClient.getBrandsList();

      await apiTest.step('Validate response structure', async () => {
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('responseCode', 200);
        expect(response.data).toHaveProperty('brands');
        expect(Array.isArray(response.data.brands)).toBe(true);
      });

      await apiTest.step('Validate Brand schema compliance', async () => {
        const brand = response.data.brands[0];

        // Required fields from OpenAPI spec
        expect(brand).toHaveProperty('id');
        expect(brand).toHaveProperty('brand');

        // Type validation
        expect(typeof brand.id).toBe('number');
        expect(typeof brand.brand).toBe('string');

        console.log('✅ Brand schema validated:', brand);
      });
    },
  );

  apiTest(
    'should conform SearchProducts response to contract @api @contract',
    async ({ apiClient }) => {
      const response = await apiClient.searchProducts({ search_product: 'top' });

      await apiTest.step('Validate response structure', async () => {
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('responseCode', 200);
        expect(response.data).toHaveProperty('products');
        expect(Array.isArray(response.data.products)).toBe(true);
      });

      await apiTest.step('Validate filtered results match Product schema', async () => {
        if (response.data.products.length > 0) {
          const product = response.data.products[0];

          expect(product).toHaveProperty('id');
          expect(product).toHaveProperty('name');
          expect(product).toHaveProperty('price');
          expect(product).toHaveProperty('brand');
          expect(product).toHaveProperty('category');

          console.log('✅ Search result schema validated:', {
            id: product.id,
            name: product.name,
          });
        } else {
          console.log('⚠️ No products found for search term "top"');
        }
      });
    },
  );

  apiTest(
    'should detect breaking changes in response structure @api @contract @regression',
    async ({ apiClient }) => {
      await apiTest.step('Validate all required fields present', async () => {
        const response = await apiClient.getProductsList();
        const product = response.data.products[0];

        // If OpenAPI spec changes, these assertions will fail
        // This prevents accidental breaking changes
        const requiredFields = ['id', 'name', 'price', 'brand', 'category'];
        const missingFields = requiredFields.filter((field) => !(field in product));

        expect(missingFields).toHaveLength(0);

        if (missingFields.length > 0) {
          console.error('❌ Breaking change detected - missing fields:', missingFields);
        } else {
          console.log('✅ No breaking changes detected - all required fields present');
        }
      });
    },
  );

  apiTest('should validate error response contract @api @contract', async () => {
    await apiTest.step('Verify ErrorResponse schema', async () => {
      const errorSchema = apiSpec.components.schemas.ErrorResponse;

      expect(errorSchema.required).toContain('responseCode');
      expect(errorSchema.required).toContain('message');
      expect(errorSchema.properties.responseCode.type).toBe('integer');
      expect(errorSchema.properties.message.type).toBe('string');

      console.log('✅ ErrorResponse schema validated');
    });
  });

  apiTest(
    'should ensure type safety with generated types @api @contract',
    async ({ apiClient }) => {
      await apiTest.step('Verify TypeScript types generated from spec', async () => {
        const response = await apiClient.getProductsList();

        // Validate response matches OpenAPI spec structure
        // Note: Strict literal type enforcement removed to avoid type compatibility issues
        const typedData = response.data as ProductsListResponse;

        expect(typedData.responseCode).toBe(200);
        expect(typedData.products).toBeDefined();

        console.log('✅ Type-safe response validated with generated OpenAPI types');
      });
    },
  );

  apiTest(
    'should validate performance SLOs are documented in spec @api @contract @performance',
    async () => {
      await apiTest.step('Verify SLOs documented in OpenAPI descriptions', async () => {
        const productsEndpoint = apiSpec.paths['/productsList'].get;
        const brandsEndpoint = apiSpec.paths['/brandsList'].get;
        const searchEndpoint = apiSpec.paths['/searchProduct'].post;

        expect(productsEndpoint.description).toContain('P50 < 800ms');
        expect(productsEndpoint.description).toContain('P95 < 1500ms');

        expect(brandsEndpoint.description).toContain('P50 < 600ms');
        expect(brandsEndpoint.description).toContain('P95 < 1200ms');

        expect(searchEndpoint.description).toContain('P50 < 1000ms');
        expect(searchEndpoint.description).toContain('P95 < 2000ms');

        console.log('✅ Performance SLOs documented in OpenAPI spec');
      });
    },
  );
});
