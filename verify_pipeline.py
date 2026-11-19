from pathlib import Path
from backend.rag_pipeline import (
    ingest_documents,
    list_documents,
    get_knowledge_base_stats,
    delete_all_documents,
)
from backend.generator import retrieve_candidates, rerank_passages

# Ensure clean slate
delete_all_documents()

# 1. Ingest Sample Documents
samples = [
    Path('sample_documents/quantum_computing_primer.md'),
    Path('sample_documents/apollo_mission_guidelines.txt'),
    Path('sample_documents/deep_learning_architectures.pdf'),
]

prepared = []
for p in samples:
    prepared.append((p.name, p.read_bytes()))

metrics = ingest_documents(prepared)
print("Ingestion metrics:", metrics)

stats = get_knowledge_base_stats()
print("Knowledge base stats:", stats)
assert stats['document_count'] == 3, f"Expected 3 docs, got {stats['document_count']}"
assert stats['chunk_count'] > 0, "Chunk count should be > 0"
assert stats['faiss_vector_count'] == stats['chunk_count'], "FAISS vectors should match chunk count"

# 2. Test Query 1: Quantum Shor's Algorithm
q1 = "How does Shors algorithm impact RSA encryption?"
print("\n--- Testing Query 1:", q1)
candidates1 = retrieve_candidates(q1, top_k_dense=10)
print(f"Stage 1 Dense Candidates: {len(candidates1)}")
top3_1 = rerank_passages(q1, candidates1, top_k_rerank=3)
print("Stage 2 Top 3 Passages:")
for idx, p in enumerate(top3_1, 1):
    print(f"  [{idx}] {p['filename']} (Pg {p['page_number']}) Relevance: {p['relevance_score']*100:.1f}%")
    print(f"      Snippet: {p['text'][:120]}...")
assert "quantum_computing_primer.md" in top3_1[0]["filename"]

# 3. Test Query 2: Saturn V F-1 Engines
q2 = "What engines and fuel were used on the Saturn V first stage?"
print("\n--- Testing Query 2:", q2)
candidates2 = retrieve_candidates(q2, top_k_dense=10)
top3_2 = rerank_passages(q2, candidates2, top_k_rerank=3)
print("Stage 2 Top 3 Passages:")
for idx, p in enumerate(top3_2, 1):
    print(f"  [{idx}] {p['filename']} (Pg {p['page_number']}) Relevance: {p['relevance_score']*100:.1f}%")
    print(f"      Snippet: {p['text'][:120]}...")
assert "apollo_mission_guidelines.txt" in top3_2[0]["filename"]

# 4. Test Query 3: ResNet PDF
q3 = "What was the degradation problem in deep networks solved by ResNet?"
print("\n--- Testing Query 3:", q3)
candidates3 = retrieve_candidates(q3, top_k_dense=10)
top3_3 = rerank_passages(q3, candidates3, top_k_rerank=3)
print("Stage 2 Top 3 Passages:")
for idx, p in enumerate(top3_3, 1):
    print(f"  [{idx}] {p['filename']} (Pg {p['page_number']}) Relevance: {p['relevance_score']*100:.1f}%")
    print(f"      Snippet: {p['text'][:120]}...")
assert "deep_learning_architectures.pdf" in top3_3[0]["filename"]

print("\n>>> ALL PIPELINE VERIFICATIONS PASSED SUCCESSFULLY! <<<")
