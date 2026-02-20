/**
 * AI Tools schemas for City Walker Gen UI
 * These are just type definitions - actual tools are defined in the API route
 */

import { z } from 'zod';

// Tool schemas for reference
export const poiSchema = z.object({
  name: z.string().describe('Name of the place'),
  type: z.string().describe('Type of place (museum, cafe, landmark, etc.)'),
  description: z.string().describe('Brief description of why to visit'),
  estimatedDuration: z.number().describe('Estimated visit duration in minutes'),
});

export const itineraryPreferencesSchema = z.object({
  city: z.string().describe('The city to explore'),
  interests: z.array(z.string()).describe('User interests like museums, food, nightlife'),
  duration: z.enum(['6h', 'day', '2days', '3days', '5days']).describe('How long the trip is'),
  transportMode: z.enum(['walking', 'driving', 'transit']).describe('Preferred transport'),
});

// Type exports for use in components
export type POIToolInput = z.infer<typeof poiSchema>;
export type ItineraryPreferences = z.infer<typeof itineraryPreferencesSchema>;
