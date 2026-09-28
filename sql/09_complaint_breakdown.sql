SELECT 
    topic_label,
    COUNT(*) AS total_complaints,
    AVG(review_score) AS avg_review_score
FROM nlp_reviews
WHERE sentiment_label = 'Negative'
GROUP BY 1
ORDER BY 2 DESC;