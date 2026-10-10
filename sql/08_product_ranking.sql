-- Products ranked by NLP complaint rate (products with >= 30 text reviews).
-- One row per (review, product) so several units of one product in an order count once.
WITH review_product AS (
    SELECT DISTINCT
        i.product_id,
        r.review_id,
        r.order_id,
        r.review_score,
        r.sentiment_label
    FROM fact_order_items i
    JOIN nlp_reviews r ON i.order_id = r.order_id
)
SELECT
    v.product_id,
    COALESCE(p.product_category_name_english, 'unknown') AS category,
    COUNT(*) AS total_reviews,
    ROUND(AVG(v.review_score), 3) AS avg_score,
    ROUND(AVG(CASE WHEN v.sentiment_label = 'Negative' THEN 1.0 ELSE 0.0 END), 4) AS negative_sentiment_rate
FROM review_product v
LEFT JOIN dim_products p ON v.product_id = p.product_id
GROUP BY 1, 2
HAVING COUNT(*) >= 30
ORDER BY negative_sentiment_rate DESC;
