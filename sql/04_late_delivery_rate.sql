SELECT 
    c.state,
    COUNT(o.order_id) AS total_orders,
    AVG(CASE WHEN o.order_delivered_customer_date > o.order_estimated_delivery_date THEN 1.0 ELSE 0.0 END) AS late_delivery_rate
FROM fact_orders o
JOIN dim_customers c ON o.customer_id = c.customer_id
WHERE o.order_delivered_customer_date IS NOT NULL
GROUP BY 1
HAVING COUNT(o.order_id) >= 100
ORDER BY late_delivery_rate DESC;