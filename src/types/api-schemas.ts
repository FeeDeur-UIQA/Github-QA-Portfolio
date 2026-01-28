import { z } from 'zod';

/**
 * API Contract Schemas for automationexercise.com API
 * 
 * These schemas define the expected structure of API responses
 * Used for contract validation and type safety
 */

// Product Schema
export const ProductSchema = z.object({
  id: z.number(),
  name: z.string(),
  price: z.string(),
  brand: z.string(),
  category: z.object({
    usertype: z.object({
      usertype: z.string(),
    }),
    category: z.string(),
  }),
});

// Products List Response Schema
export const ProductsListResponseSchema = z.object({
  responseCode: z.number(),
  products: z.array(ProductSchema),
});

// Login Request Schema
export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Login Response Schema
export const LoginResponseSchema = z.object({
  responseCode: z.number(),
  message: z.string(),
});

// Brands List Response Schema
export const BrandsListResponseSchema = z.object({
  responseCode: z.number(),
  brands: z.array(
    z.object({
      id: z.number(),
      brand: z.string(),
    })
  ),
});

// Search Products Response Schema
export const SearchProductsResponseSchema = z.object({
  responseCode: z.number(),
  products: z.array(ProductSchema),
});

// User Account Schema
export const UserAccountSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  title: z.enum(['Mr', 'Mrs']),
  birth_date: z.string().optional(),
  birth_month: z.string().optional(),
  birth_year: z.string().optional(),
  firstname: z.string(),
  lastname: z.string(),
  company: z.string().optional(),
  address1: z.string(),
  address2: z.string().optional(),
  country: z.string(),
  zipcode: z.string(),
  state: z.string(),
  city: z.string(),
  mobile_number: z.string(),
});

// User Account Response Schema
export const UserAccountResponseSchema = z.object({
  responseCode: z.number(),
  user: UserAccountSchema,
});

// Generic API Error Response
export const APIErrorResponseSchema = z.object({
  responseCode: z.number(),
  message: z.string(),
});

// Type exports for TypeScript
export type Product = z.infer<typeof ProductSchema>;
export type ProductsListResponse = z.infer<typeof ProductsListResponseSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type BrandsListResponse = z.infer<typeof BrandsListResponseSchema>;
export type SearchProductsResponse = z.infer<typeof SearchProductsResponseSchema>;
export type UserAccount = z.infer<typeof UserAccountSchema>;
export type UserAccountResponse = z.infer<typeof UserAccountResponseSchema>;
export type APIErrorResponse = z.infer<typeof APIErrorResponseSchema>;
