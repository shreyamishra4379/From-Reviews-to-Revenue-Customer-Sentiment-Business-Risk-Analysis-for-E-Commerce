-- Seller performance: revenue from all orders, NLP complaint rate from text reviews.
-- Revenue and review metrics are aggregated separately and then joined, so a
-- review is not repeated once per item and revenue is not repeated once per review.
WITH seller_revenue AS (
    SELECT
        seller_id,
        COUNT(DISTINCT order_id) AS total_orders,
        ROUND(SUM(price), 2) AS total_revenue
    FROM fact_order_items
    GROUP BY 1
),
seller_reviews AS (
    SELECT DISTINCT i.seller_id, r.review_id, r.order_id, r.sentiment_label
    FROM fact_order_items i
    JOIN nlp_reviews r ON i.order_id = r.order_id
)
SELECT
    s.seller_id,
    s.total_orders,
    s.total_revenue,
    COUNT(*) AS text_reviews,
    ROUND(AVG(CASE WHEN v.sentiment_label = 'Negative' THEN 1.0 ELSE 0.0 END), 4) AS negative_sentiment_rate
FROM seller_revenue s
JOIN seller_reviews v ON s.seller_id = v.seller_id
GROUP BY 1, 2, 3
HAVING COUNT(*) >= 30
ORDER BY negative_sentiment_rate DESC, text_reviews DESC, s.seller_id;
