SELECT 
    i.seller_id,
    COUNT(DISTINCT i.order_id) AS total_orders,
    SUM(i.price) AS total_revenue,
    AVG(CASE WHEN r.sentiment_label = 'Negative' THEN 1.0 ELSE 0.0 END) AS negative_sentiment_rate
FROM fact_order_items i
JOIN nlp_reviews r ON i.order_id = r.order_id
GROUP BY 1
HAVING COUNT(DISTINCT i.order_id) >= 50
ORDER BY negative_sentiment_rate DESC;