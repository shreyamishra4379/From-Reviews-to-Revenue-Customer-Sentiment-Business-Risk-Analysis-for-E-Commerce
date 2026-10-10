-- Average review score per category (categories with >= 100 text reviews).
-- A review is counted once per category even if its order has several items
-- from that category, so multi-item orders are not double-counted.
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
    ROUND(AVG(review_score), 3) AS avg_review_score
FROM review_category
GROUP BY 1
HAVING COUNT(*) >= 100
ORDER BY avg_review_score DESC;
