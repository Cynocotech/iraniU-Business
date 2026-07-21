-- Remove bulk-imported listing images from cover_image_url and gallery_json
-- These images were deleted from server/uploads/listings/

UPDATE businesses
SET cover_image_url = NULL
WHERE cover_image_url LIKE '/uploads/listings/%';

UPDATE businesses
SET gallery_json = '[]'
WHERE gallery_json LIKE '%/uploads/listings/%';
