SELECT 
    p.product_id,
    p.product_category_name_english AS category,
    COUNT(r.review_id) AS total_reviews,
    AVG(r.review_score) AS avg_score,
    AVG(CASE WHEN r.sentiment_label = 'Negative' THEN 1.0 ELSE 0.0 END) AS negative_sentiment_rate
FROM fact_order_items i
JOIN nlp_reviews r ON i.order_id = r.order_id
JOIN dim_products p ON i.product_id = p.product_id
GROUP BY 1, 2
HAVING COUNT(r.review_id) >= 30
ORDER BY negative_sentiment_rate DESC;