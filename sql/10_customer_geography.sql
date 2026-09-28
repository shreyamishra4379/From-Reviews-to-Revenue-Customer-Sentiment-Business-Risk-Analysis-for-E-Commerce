SELECT 
    c.state,
    COUNT(DISTINCT o.order_id) AS total_orders,
    AVG(date_diff('day', o.order_estimated_delivery_date, o.order_delivered_customer_date)) AS avg_delay_days,
    AVG(r.review_score) AS avg_review_score
FROM fact_orders o
JOIN dim_customers c ON o.customer_id = c.customer_id
LEFT JOIN nlp_reviews r ON o.order_id = r.order_id
WHERE o.order_delivered_customer_date IS NOT NULL AND o.order_estimated_delivery_date IS NOT NULL
GROUP BY 1
ORDER BY total_orders DESC;