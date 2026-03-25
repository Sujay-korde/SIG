from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from .seed_incidents import synthetic_incidents

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")


class ChromaIncidentStore:
    """Thin wrapper around ChromaDB with a safe in-memory fallback."""

    def __init__(self, persist_dir: str | Path | None = None) -> None:
        self.persist_dir = Path(persist_dir or Path(__file__).resolve().parent / ".chroma")
        self.persist_dir.mkdir(parents=True, exist_ok=True)
        self.client = None
        self.collection = None
        self.model = None
        self._fallback = synthetic_incidents()
        self._enabled = os.getenv("SRE_ENABLE_CHROMA", "0") == "1"

        if self._enabled:
            try:  # pragma: no cover
                import chromadb
                from sentence_transformers import SentenceTransformer

                self.client = chromadb.PersistentClient(path=str(self.persist_dir))
                self.collection = self.client.get_or_create_collection("sre_whisperer_incidents")
                self.model = SentenceTransformer("all-MiniLM-L6-v2", device="cpu")
            except Exception:
                self.client = None
                self.collection = None
                self.model = None

    def seed(self, incidents: list[dict[str, str]] | None = None) -> int:
        incidents = incidents or synthetic_incidents()
        self._fallback = incidents
        if self.collection and self.model:
            ids = [item["id"] for item in incidents]
            docs = [item["summary"] for item in incidents]
            metas = [{"scenario": item["scenario"], "root_cause": item["root_cause"]} for item in incidents]
            embeddings = self.model.encode(docs, normalize_embeddings=True).tolist()
            self.collection.upsert(ids=ids, documents=docs, metadatas=metas, embeddings=embeddings)
        return len(incidents)

    def query(self, text: str, limit: int = 3) -> list[dict[str, Any]]:
        if self.collection and self.model:
            embedding = self.model.encode([text], normalize_embeddings=True).tolist()[0]
            result = self.collection.query(query_embeddings=[embedding], n_results=limit)
            matches = []
            for index, document in enumerate(result.get("documents", [[]])[0]):
                distance = result.get("distances", [[1.0]])[0][index]
                metadata = result.get("metadatas", [[{}]])[0][index]
                matches.append(
                    {
                        "summary": document,
                        "distance": distance,
                        "scenario": metadata.get("scenario"),
                        "root_cause": metadata.get("root_cause"),
                    }
                )
            return matches

        text_lower = text.lower()
        scored = []
        for incident in self._fallback:
            score = 0.95
            if incident["root_cause"].replace("_", " ") in text_lower:
                score = 0.12
            elif incident["scenario"].lower() in text_lower:
                score = 0.18
            scored.append({**incident, "distance": score})
        return sorted(scored, key=lambda item: item["distance"])[:limit]
