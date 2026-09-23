import pandas as pd
import time
import torch
from transformers import pipeline
from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
import nltk
from nltk.corpus import stopwords
import warnings
warnings.filterwarnings('ignore')

def run_benchmark():
    print("Loading data...")
    df = pd.read_parquet("data/processed/fact_order_reviews.parquet")
    df_text = df.dropna(subset=['review_comment_message']).copy()
    sample_size = 500
    texts = df_text['review_comment_message'].head(sample_size).tolist()
    print(f"Sample size: {len(texts)} reviews")
    
    results = {}
    
    # 1. Multilingual Transformer Sentiment Benchmark
    print("\nBenchmarking Multilingual Transformer Sentiment...")
    # cardiffnlp/twitter-xlm-roberta-base-sentiment is great for multi-lingual sentiment
    start = time.time()
    try:
        sentiment_pipeline = pipeline("sentiment-analysis", model="cardiffnlp/twitter-xlm-roberta-base-sentiment", device=-1)
        sentiment_preds = sentiment_pipeline(texts, truncation=True, max_length=512)
        elapsed = time.time() - start
        print(f"Transformer Sentiment Time: {elapsed:.2f} seconds for {sample_size} reviews")
        est_full = elapsed * (40977 / sample_size)
        print(f"Estimated for 40,977 reviews: {est_full / 60:.2f} minutes")
        results['Transformer_Sentiment_Sec'] = elapsed
    except Exception as e:
        print(f"Transformer Sentiment Failed: {e}")
        
    # 2. Sentence Transformers Embedding Benchmark
    print("\nBenchmarking Sentence Transformers Embeddings...")
    start = time.time()
    try:
        embedder = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
        embeddings = embedder.encode(texts, show_progress_bar=False)
        elapsed = time.time() - start
        print(f"Embeddings Time: {elapsed:.2f} seconds for {sample_size} reviews")
        est_full = elapsed * (40977 / sample_size)
        print(f"Estimated for 40,977 reviews: {est_full / 60:.2f} minutes")
        results['Transformer_Embeddings_Sec'] = elapsed
    except Exception as e:
        print(f"Sentence Transformers Failed: {e}")
        
    # 3. TF-IDF + LDA/NMF Benchmark
    print("\nBenchmarking TF-IDF Baseline...")
    start = time.time()
    try:
        nltk.download('stopwords', quiet=True)
        pt_stops = stopwords.words('portuguese')
        vectorizer = TfidfVectorizer(stop_words=pt_stops, max_features=1000)
        tfidf_matrix = vectorizer.fit_transform(texts)
        elapsed = time.time() - start
        print(f"TF-IDF Time: {elapsed:.2f} seconds for {sample_size} reviews")
        results['TFIDF_Sec'] = elapsed
    except Exception as e:
        print(f"TF-IDF Failed: {e}")

if __name__ == "__main__":
    run_benchmark()
