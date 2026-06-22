import logging

from langchain_core.tools import tool

from src.data import load_menu

logger = logging.getLogger(__name__)


@tool
def specials_tool() -> str:
    """Get today's specials from the restaurant. No input is needed."""
    logger.debug("specials_tool called")
    data = load_menu()
    specials = [i for i in data["items"] if i.get("is_special") and i["available"]]

    if not specials:
        return "There are no specials today. Please browse our full menu instead."

    lines = ["**Today's Specials**"]
    for item in specials:
        allergen_note = f" [allergens: {', '.join(item['allergens'])}]" if item["allergens"] else ""
        lines.append(f"  • {item['name']} ({item['category']}) — £{item['price']:.2f}: {item['description']}{allergen_note}")

    return "\n".join(lines)
