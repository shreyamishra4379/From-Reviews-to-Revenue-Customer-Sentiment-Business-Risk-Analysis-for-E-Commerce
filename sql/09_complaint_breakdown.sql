-- Negative-sentiment reviews broken down by discovered topic (business names from dim_topics).
SELECT
    t.business_topic_name AS topic,
    COUNT(*) AS negative_reviews,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS share_of_negative_pct,
    ROUND(AVG(r.review_score), 3) AS avg_review_score
FROM nlp_reviews r
JOIN dim_topics t ON r.emb_topic_id = t.topic_id
WHERE r.sentiment_label = 'Negative'
GROUP BY 1
ORDER BY 2 DESC;
