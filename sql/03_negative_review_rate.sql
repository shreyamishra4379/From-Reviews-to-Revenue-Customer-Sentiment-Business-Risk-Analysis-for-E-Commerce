-- Negative-review rate (review_score <= 2) per category, >= 100 text reviews.
-- One row per (review, category) so multi-item orders are not double-counted.
WITH review_category AS (
    SELECT DISTINCT
        r.review_id,
        r.order_id,
        r.review_score,
        COALESCE(p.product_category_name_english, 'unknown') AS category
    FROM nlp_reviews r
    JOIN fact_order_items i ON r.order_id = i.order_id
    LEFT JOIN dim_products p ON i.product_id = p.product_id
)
SELECT
    category,
    COUNT(*) AS total_reviews,
    ROUND(AVG(CASE WHEN review_score <= 2 THEN 1.0 ELSE 0.0 END), 4) AS negative_review_rate
FROM review_category
GROUP BY 1
HAVING COUNT(*) >= 100
ORDER BY negative_review_rate DESC;
