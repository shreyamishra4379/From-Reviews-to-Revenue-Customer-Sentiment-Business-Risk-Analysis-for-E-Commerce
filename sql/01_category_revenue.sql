SELECT 
    p.product_category_name_english AS category,
    COUNT(DISTINCT i.order_id) AS total_orders,
    SUM(i.price) AS total_revenue,
    SUM(i.freight_value) AS total_freight
FROM fact_order_items i
LEFT JOIN dim_products p ON i.product_id = p.product_id
GROUP BY 1
ORDER BY total_revenue DESC;