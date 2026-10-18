import os
import sys
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

print("=" * 70, flush=True)
print("🔬 CineSense AI — Embedding Equivalence & FAISS Compatibility Check", flush=True)
print("=" * 70, flush=True)

# 1. Load Sentence-Transformers (PyTorch)
from sentence_transformers import SentenceTransformer
st_model = SentenceTransformer("all-MiniLM-L6-v2")
print("✓ Loaded reference PyTorch SentenceTransformer(all-MiniLM-L6-v2)", flush=True)

# 2. Load FastEmbed (ONNX)
from fastembed import TextEmbedding
fe_model = TextEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")
print("✓ Loaded ONNX TextEmbedding(sentence-transformers/all-MiniLM-L6-v2)", flush=True)

# 3. Generate 200 diverse sample movie queries and descriptions
sample_texts = [
    f"Emotion and mood query {i}: feeling melancholic and heartbroken in a rainy city seeking quiet redemption" for i in range(25)
] + [
    f"Sci-fi thriller {i}: dystopian cyberpunk detective investigating artificial intelligence rebellion on Mars" for i in range(25)
] + [
    f"Comedy romance {i}: two clumsy rival wedding planners accidentally fall in love in picturesque Paris" for i in range(25)
] + [
    f"Horror mystery {i}: ancient cursed wooden doll terrifies isolated Victorian mansion during a thunderstorm" for i in range(25)
] + [
    f"Historical war drama {i}: courageous resistance fighter smuggles secret documents across occupied territory" for i in range(25)
] + [
    f"Animated adventure {i}: curious young dragon searches for magical lost constellation across enchanted kingdoms" for i in range(25)
] + [
    f"Psychological mind-bender {i}: retired mathematician realizes his recurring dreams predict global events" for i in range(25)
] + [
    f"Action martial arts {i}: undercover agent infiltrates high-stakes underworld syndicate in Hong Kong" for i in range(25)
]

print(f"\nComputing embeddings for {len(sample_texts)} sample texts...", flush=True)

# Compute PyTorch embeddings
st_vecs = st_model.encode(sample_texts, convert_to_numpy=True, normalize_embeddings=True)
st_vecs = st_vecs.astype(np.float32)

# Compute FastEmbed (ONNX) embeddings
fe_generator = fe_model.embed(sample_texts)
fe_vecs = np.array(list(fe_generator), dtype=np.float32)

# Ensure L2 normalization for ONNX
norms = np.linalg.norm(fe_vecs, axis=1, keepdims=True)
fe_vecs = fe_vecs / np.maximum(norms, 1e-12)

# 4. Compute Cosine Similarities (Dot product of L2 normalized vectors)
similarities = np.sum(st_vecs * fe_vecs, axis=1)

avg_sim = float(np.mean(similarities))
min_sim = float(np.min(similarities))
max_sim = float(np.max(similarities))
p50_sim = float(np.median(similarities))

print("-" * 70, flush=True)
print(f"Embedding Dimensions: PyTorch={st_vecs.shape[1]}, ONNX={fe_vecs.shape[1]}", flush=True)
print(f"Cosine Similarity Summary across {len(sample_texts)} texts:", flush=True)
print(f"  • Mean Cosine Similarity:   {avg_sim:.6f}  (Target >= 0.99)", flush=True)
print(f"  • Median Cosine Similarity: {p50_sim:.6f}", flush=True)
print(f"  • Min Cosine Similarity:    {min_sim:.6f}", flush=True)
print(f"  • Max Cosine Similarity:    {max_sim:.6f}", flush=True)

# 5. Check FAISS Retrieval Top-10 Overlap
import faiss
from app.services.faiss_service import _get_index_paths
index_path, id_map_path = _get_index_paths()
index = faiss.read_index(index_path)

test_queries = [
    "cozy comforting feel-good movie",
    "dark gritty cyberpunk thriller",
    "heartbreaking tragic romantic drama",
    "hilarious laugh out loud comedy",
    "scary supernatural haunted house horror",
    "epic medieval fantasy sword fight",
    "mind bending psychological puzzle",
    "nostalgic coming of age 80s film",
    "gripping true crime courtroom drama",
    "intense claustrophobic submarine thriller",
    "quirky independent romance",
    "visually stunning space exploration",
    "wholesome family friendly animated movie",
    "post apocalyptic survival journey",
    "martial arts revenge kung fu",
    "detective investigating murder in a small town",
    "inspiring sports underdog victory",
    "philosophical existential slow burn",
    "time travel paradox catastrophe",
    "tense hostage negotiation drama",
    "gangster mafia organized crime epic",
    "warm summer road trip friendship",
    "atmospheric gothic mystery",
    "high octane car chase action",
    "isolated cabin in the snowy woods",
    "satirical political comedy",
    "magical realism surreal fantasy",
    "melancholic poetic lonely night",
    "heist team planning bank robbery",
    "psychopathic serial killer thriller",
    "bittersweet love story with tragic ending",
    "alien invasion defense military battle",
    "deep ocean creature survival",
    "dystopian surveillance state resistance",
    "tender grandfather and grandson bond",
]

overlaps = []
for q in test_queries:
    # PyTorch vector top-10
    st_q = st_model.encode([q], convert_to_numpy=True, normalize_embeddings=True).astype(np.float32)
    _, st_idx = index.search(st_q, 10)
    st_top10 = set(st_idx[0].tolist())

    # ONNX vector top-10
    fe_q = np.array(list(fe_model.embed([q])), dtype=np.float32)
    fe_q = fe_q / np.maximum(np.linalg.norm(fe_q, axis=1, keepdims=True), 1e-12)
    _, fe_idx = index.search(fe_q, 10)
    fe_top10 = set(fe_idx[0].tolist())

    overlap = len(st_top10.intersection(fe_top10)) / 10.0
    overlaps.append(overlap)

avg_overlap = float(np.mean(overlaps)) * 100
min_overlap = float(np.min(overlaps)) * 100
print("-" * 70, flush=True)
print(f"FAISS Retrieval Top-10 Overlap across {len(test_queries)} queries:", flush=True)
print(f"  • Average Top-10 Overlap:   {avg_overlap:.1f}%", flush=True)
print(f"  • Minimum Top-10 Overlap:   {min_overlap:.1f}%", flush=True)
print("=" * 70, flush=True)
if avg_sim >= 0.99:
    print("✅ RESULT: EXCELLENT MATCH! Existing FAISS index is 100% valid with ONNX runtime.", flush=True)
else:
    print("⚠️ RESULT: Embedding mismatch detected. Index rebuild recommended.", flush=True)
