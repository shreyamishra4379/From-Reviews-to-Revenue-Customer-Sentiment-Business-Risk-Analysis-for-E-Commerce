WITH order_values AS (
    SELECT 
        order_id, 
        SUM(price + freight_value) AS total_value 
    FROM fact_order_items 
    GROUP BY 1
)
SELECT 
    CASE 
        WHEN ov.total_value < 50 THEN 'Low Value (<50)'
        WHEN ov.total_value BETWEEN 50 AND 200 THEN 'Medium Value (50-200)'
        ELSE 'High Value (>200)'
    END AS value_segment,
    COUNT(r.review_id) AS total_reviews,
    AVG(r.review_score) AS avg_review_score,
    AVG(CASE WHEN r.sentiment_label = 'Negative' THEN 1.0 ELSE 0.0 END) AS negative_sentiment_rate
FROM order_values ov
JOIN nlp_reviews r ON ov.order_id = r.order_id
GROUP BY 1
ORDER BY total_reviews DESC;