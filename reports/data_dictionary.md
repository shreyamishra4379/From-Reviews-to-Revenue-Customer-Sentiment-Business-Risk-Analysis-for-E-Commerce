# Data Dictionary — Sentiment-to-Outcome Analytics

## Star Schema Tables (Stage 1)

### `fact_orders.parquet` (99,441 rows)
| Column | Type | Description |
|--------|------|-------------|
| order_id | str | Unique order identifier (PK) |
| customer_id | str | FK to dim_customers |
| order_status | str | Order status (delivered, shipped, canceled, etc.) |
| order_purchase_timestamp | datetime | Timestamp when order was placed |
| order_approved_at | datetime | Timestamp when payment was approved |
| order_delivered_carrier_date | datetime | Timestamp when order was handed to carrier |
| order_delivered_customer_date | datetime | Timestamp when customer received order |
| order_estimated_delivery_date | datetime | Estimated delivery date shown to customer |

### `fact_order_items.parquet` (112,650 rows)
| Column | Type | Description |
|--------|------|-------------|
| order_id | str | FK to fact_orders |
| order_item_id | int | Sequential item number within the order |
| product_id | str | FK to dim_products |
| seller_id | str | FK to dim_sellers |
| shipping_limit_date | datetime | Seller shipping deadline |
| price | float64 | Item price in R$ |
| freight_value | float64 | Item freight cost in R$ |

### `fact_order_reviews.parquet` (99,224 rows)
| Column | Type | Description |
|--------|------|-------------|
| review_id | str | Unique review identifier |
| order_id | str | FK to fact_orders |
| review_score | int | Review rating (1–5) |
| review_comment_title | str | Optional review title text |
| review_comment_message | str | Optional review body text (40.77% non-null) |
| review_creation_date | datetime | When the review was created |
| review_answer_timestamp | datetime | When the review was answered |

### `dim_customers.parquet` (99,441 rows)
| Column | Type | Description |
|--------|------|-------------|
| customer_id | str | Unique customer identifier (1:1 with orders) |
| customer_unique_id | str | De-duplicated customer identifier |
| zip_code_prefix | int | Customer zip code prefix |
| city | str | Customer city |
| state | str | Customer state (2-letter code) |

### `dim_products.parquet` (32,951 rows)
| Column | Type | Description |
|--------|------|-------------|
| product_id | str | Unique product identifier (PK) |
| product_category_name | str | Portuguese category name |
| product_name_lenght | float64 | Length of product name |
| product_description_lenght | float64 | Length of product description |
| product_photos_qty | float64 | Number of product photos |
| product_weight_g | float64 | Product weight in grams |
| product_length_cm | float64 | Product length in cm |
| product_height_cm | float64 | Product height in cm |
| product_width_cm | float64 | Product width in cm |
| product_category_name_english | str | English category name (translated; 610 missing → "unknown") |

### `dim_sellers.parquet` (3,095 rows)
| Column | Type | Description |
|--------|------|-------------|
| seller_id | str | Unique seller identifier (PK) |
| zip_code_prefix | int | Seller zip code prefix |
| city | str | Seller city |
| state | str | Seller state (2-letter code) |

### `dim_payments.parquet` (99,440 rows)
| Column | Type | Description |
|--------|------|-------------|
| order_id | str | FK to fact_orders (1 row per order) |
| total_payment_value | float64 | Sum of all payment_value rows for the order (R$) |
| payment_installments_max | int | Maximum installment count across payment methods |
| n_payment_methods | int | Number of distinct payment types used |
| primary_payment_type | str | Payment type with the highest payment_value |

### `dim_geolocation.parquet` (19,015 rows)
| Column | Type | Description |
|--------|------|-------------|
| zip_code_prefix | int | Zip code prefix (PK after aggregation) |
| lat | float64 | Median latitude for the zip prefix |
| lng | float64 | Median longitude for the zip prefix |
| city | str | Representative city name |
| state | str | State (2-letter code) |

---

## Feature Table (Stage 2)

### `features_orders.parquet` (99,441 rows × 20 columns)

Grain: **order_id** (one row per order). Built by joining fact_orders with aggregated item-level, payment, review, customer, seller, and product data.

| Column | Type | Description | Formula | % Null |
|--------|------|-------------|---------|--------|
| order_id | str | Unique order identifier (PK) | From fact_orders.order_id | 0.00% |
| customer_id | str | FK to dim_customers | From fact_orders.customer_id | 0.00% |
| order_status | str | Order status | From fact_orders.order_status | 0.00% |
| order_purchase_timestamp | datetime | Purchase timestamp | From fact_orders.order_purchase_timestamp | 0.00% |
| delivery_delay_days | float64 | Days between actual and estimated delivery. Negative = early, positive = late | `(order_delivered_customer_date − order_estimated_delivery_date).total_seconds() / 86400` | 2.98% |
| order_total_value | float64 | Total order value including freight (R$) | `sum(price) + sum(freight_value)` per order | 0.78% |
| freight_ratio | float64 | Ratio of freight cost to product price | `sum(freight_value) / sum(price)`; NaN if sum(price)=0 | 0.78% |
| items_per_order | float64 | Number of line items in the order | `count(order_item_id)` per order | 0.78% |
| distinct_sellers_per_order | float64 | Number of distinct sellers in the order | `nunique(seller_id)` per order | 0.78% |
| payment_installments | float64 | Maximum installment count | From dim_payments.payment_installments_max | 0.00% |
| payment_type | str | Primary payment type | From dim_payments.primary_payment_type | 0.00% |
| review_score | float64 | Mean review score (1–5) | `mean(review_score)` across reviews for the order | 0.77% |
| has_review_text | bool/object | True if any review has non-null comment text | `any(review_comment_message.notna())` for the order | 0.77% |
| customer_state | str | Customer's state (2-letter code) | From dim_customers.state via customer_id | 0.00% |
| seller_state | str | Seller state of the highest-price item | dim_sellers.state for the seller of the item with max price | 0.78% |
| is_interstate_order | bool/object | True if customer and seller are in different states | `customer_state != seller_state`; NaN if either is missing | 0.78% |
| product_category | str | English product category of highest-price item | dim_products.product_category_name_english for max-price item | 0.78% |
| is_value_outlier | bool | Order total value exceeds IQR upper fence | `order_total_value > Q3 + 1.5 × IQR` | 0.00% |
| is_freight_ratio_outlier | bool | Freight ratio exceeds IQR upper fence | `freight_ratio > Q3 + 1.5 × IQR` | 0.00% |
| is_delay_outlier | bool | Delivery delay exceeds 8.39 days (IQR upper fence) | `delivery_delay_days > 8.39` | 0.00% |

**Grain justification**: order_id is the natural grain because (a) the project's analytical unit is the order—review scores, delivery dates, and payments are all at the order level; (b) item-level details are aggregated up (totals, counts, dominant category/seller) to avoid fan-out while preserving the key signals; (c) downstream NLP analysis (Stage 3) operates on per-order review text.

**Null explanation**: The 0.78% null rate on item-derived features (order_total_value, freight_ratio, items_per_order, etc.) corresponds to 775 orders that have no matching rows in fact_order_items. The 2.98% null rate on delivery_delay_days corresponds to 2,965 orders not yet delivered (status ≠ delivered). The 0.77% null rate on review features corresponds to 768 orders with no review in fact_order_reviews.

### Features NOT possible with this dataset

| Feature | Reason |
|---------|--------|
| profit_margin | No cost/wholesale price data available |
| customer_lifetime_value | No longitudinal customer purchase history |
| return_flag | No returns/refunds table in the dataset |
| seller_rating | No seller-level reputation metric beyond inferred review scores |
| product_rating_history | No time-series product ratings |
| discount_amount | No coupon/discount data; voucher ≠ discount |
| delivery_distance_km | Would require haversine on seller/customer geo — approximation not engineered |
