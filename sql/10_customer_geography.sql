-- Customer geography: delivery timing from all delivered orders, review score from text reviews.
-- Reviews are aggregated per order first so orders with several reviews are not repeated.
WITH order_reviews AS (
    SELECT order_id, AVG(review_score) AS review_score
    FROM nlp_reviews
    GROUP BY 1
)
SELECT
    c.state,
    COUNT(*) AS delivered_orders,
    ROUND(AVG(date_diff('day', o.order_estimated_delivery_date, o.order_delivered_customer_date)), 2) AS avg_delay_days,
    COUNT(r.order_id) AS orders_with_text_review,
    ROUND(AVG(r.review_score), 3) AS avg_review_score
FROM fact_orders o
JOIN dim_customers c ON o.customer_id = c.customer_id
LEFT JOIN order_reviews r ON o.order_id = r.order_id
WHERE o.order_delivered_customer_date IS NOT NULL
  AND o.order_estimated_delivery_date IS NOT NULL
GROUP BY 1
ORDER BY delivered_orders DESC;
