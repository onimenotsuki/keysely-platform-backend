import { logger } from '@shared/logger.ts';
import { getTypesenseClient } from '@shared/typesenseClient.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Typesense from 'npm:typesense';

const TYPESENSE_COLLECTION_NAME = 'spaces';

const schema = {
  name: TYPESENSE_COLLECTION_NAME,
  fields: [
    { name: 'title', type: 'string' },
    { name: 'description', type: 'string', optional: true },
    { name: 'address', type: 'string' },
    { name: 'city', type: 'string', facet: true },
    { name: 'state', type: 'string', optional: true, facet: true },
    { name: 'price_per_hour', type: 'float', facet: true },
    { name: 'currency', type: 'string', facet: true },
    { name: 'capacity', type: 'int32', facet: true },
    { name: 'area_sqm', type: 'float', optional: true, facet: true },
    { name: 'images', type: 'string[]', optional: true },
    { name: 'features', type: 'string[]', optional: true, facet: true },
    { name: 'amenities', type: 'string[]', optional: true, facet: true },
    { name: 'is_active', type: 'bool', default: false },
    { name: 'rating', type: 'float', default: 0, facet: true },
    { name: 'total_reviews', type: 'int32', default: 0 },
    { name: 'category_id', type: 'string', optional: true, facet: true },
    { name: 'owner_id', type: 'string' },
    { name: 'location', type: 'geopoint', optional: true },
  ],
};

export async function createTypesenseSchema(client: Typesense.Client) {
  logger.info('Checking if collection exists...');

  try {
    const collection = await client.collections(TYPESENSE_COLLECTION_NAME).retrieve();
    logger.info('Collection exists, attempting to update schema...');

    // We need to cast collection to a type that includes fields
    const existingFields = (collection as { fields?: { name: string }[] }).fields || [];

    if (existingFields.length > 0) {
      logger.info(`Found ${existingFields.length} existing fields. Dropping them...`);
      // Filter out 'id' field as it cannot be dropped
      const fieldsToDrop = existingFields
        .filter((field) => field.name !== 'id')
        .map((field) => ({
          name: field.name,
          drop: true,
        }));

      if (fieldsToDrop.length > 0) {
        try {
          await client.collections(TYPESENSE_COLLECTION_NAME).update({ fields: fieldsToDrop });
          logger.info('Existing fields dropped successfully.');
        } catch (dropError) {
          logger.error('Error dropping fields:', dropError);
          // We might want to throw here or continue depending on severity.
          // Continuing might fail the next step if fields conflict.
          throw dropError;
        }
      } else {
        logger.info('No fields to drop (only id found).');
      }
    }

    try {
      await client.collections(TYPESENSE_COLLECTION_NAME).update({ fields: schema?.fields });
      logger.info('Schema updated successfully with new fields.');
    } catch (updateError) {
      logger.error('Error adding new fields:', updateError);
      throw updateError;
    }
  } catch (error: unknown) {
    // If retrieve fails with 404, it means collection doesn't exist
    // Type guard for error object with httpStatus
    if (
      typeof error === 'object' &&
      error !== null &&
      'httpStatus' in error &&
      (error as { httpStatus: number }).httpStatus === 404
    ) {
      logger.info('Collection not found, creating...');
      await client.collections().create(schema);
      logger.info('Collection created successfully.');
    } else {
      // Other errors
      logger.error('Error checking/creating collection:', error);
      throw error;
    }
  }
}

serve(async (_req: Request) => {
  logger.logRequest(_req);

  try {
    const client = getTypesenseClient();
    await createTypesenseSchema(client);

    return new Response(JSON.stringify({ message: 'Schema created/updated successfully' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    logger.error('Error creating/updating schema:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
