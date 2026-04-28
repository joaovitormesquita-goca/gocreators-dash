CREATE OR REPLACE FUNCTION get_distinct_products(p_brand_id bigint)
RETURNS TABLE (product_name text)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT cr.product_name
  FROM creatives cr
  JOIN creator_brands cb ON cb.id = cr.creator_brand_id
  WHERE cb.brand_id = p_brand_id
    AND cr.product_name IS NOT NULL
  ORDER BY cr.product_name;
$$;
