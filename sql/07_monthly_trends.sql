SELECT 
    strftime(o.order_purchase_timestamp, '%Y-%m') AS order_month,
    COUNT(DISTINCT o.order_id) AS total_orders,
    AVG(CASE WHEN r.sentiment_label = 'Negative' THEN 1.0 ELSE 0.0 END) AS negative_sentiment_rate
FROM fact_orders o
JOIN nlp_reviews r ON o.order_id = r.order_id
WHERE o.order_purchase_timestamp IS NOT NULL
GROUP BY 1
ORDER BY 1;