SELECT 
    p.product_category_name_english AS category,
    COUNT(r.review_id) AS total_reviews,
    AVG(CASE WHEN r.review_score <= 2 THEN 1.0 ELSE 0.0 END) AS negative_review_rate
FROM nlp_reviews r
JOIN fact_order_items i ON r.order_id = i.order_id
LEFT JOIN dim_products p ON i.product_id = p.product_id
GROUP BY 1
HAVING COUNT(r.review_id) >= 100
ORDER BY negative_review_rate DESC;