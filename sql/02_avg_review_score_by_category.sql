SELECT 
    p.product_category_name_english AS category,
    COUNT(r.review_id) AS total_reviews,
    AVG(r.review_score) AS avg_review_score
FROM nlp_reviews r
JOIN fact_order_items i ON r.order_id = i.order_id
LEFT JOIN dim_products p ON i.product_id = p.product_id
GROUP BY 1
HAVING COUNT(r.review_id) >= 100
ORDER BY avg_review_score DESC;