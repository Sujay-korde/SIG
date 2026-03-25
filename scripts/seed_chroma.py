from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.memory.chroma_client import ChromaIncidentStore
from backend.memory.seed_incidents import synthetic_incidents


def main() -> None:
    store = ChromaIncidentStore()
    count = store.seed(synthetic_incidents())
    print(f"Seeded {count} incidents.")


if __name__ == "__main__":
    main()
