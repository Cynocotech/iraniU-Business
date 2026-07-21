-- Remove bulk-imported listing images from cover_image_url and gallery_json
-- These images were deleted from server/uploads/listings/

-- Clear cover image
UPDATE businesses
SET cover_image_url = NULL
WHERE cover_image_url LIKE '/uploads/listings/%';

-- Remove only the /uploads/listings/ entries from gallery array, keep real images
UPDATE businesses
SET gallery_json = COALESCE(
  (
    SELECT json_agg(elem)::text
    FROM json_array_elements_text(gallery_json::json) AS elem
    WHERE elem NOT LIKE '/uploads/listings/%'
    AND elem != ''
  ),
  '[]'
)
WHERE gallery_json LIKE '%/uploads/listings/%';
