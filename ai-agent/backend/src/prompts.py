from pathlib import Path

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def load_prompt(name: str) -> str:
    """Read backend/prompts/{name}.md and return its contents."""
    return (_PROMPTS_DIR / f"{name}.md").read_text(encoding="utf-8")
