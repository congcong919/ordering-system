import logging

from langchain_core.tools import tool

from src.data import load_menu

logger = logging.getLogger(__name__)


@tool
def menu_tool(category: str = "") -> str:
    """Browse the restaurant menu. Optionally filter by category: Starters, Mains, Desserts, or Drinks.
    Leave the input empty to see all available items."""
    logger.debug("menu_tool: category=%r", category)
    data = load_menu()
    items = [i for i in data["items"] if i["available"]]

    if category:
        items = [i for i in items if i["category"].lower() == category.strip().lower()]
        if not items:
            valid = ", ".join(sorted({i["category"] for i in data["items"]}))
            return f"No items found in category '{category}'. Valid categories: {valid}."

    if not items:
        return "No menu items are currently available."

    lines = []
    current_cat = None
    for item in sorted(items, key=lambda x: (x["category"], x["name"])):
        if item["category"] != current_cat:
            current_cat = item["category"]
            lines.append(f"\n**{current_cat}**")
        allergen_note = f" [allergens: {', '.join(item['allergens'])}]" if item["allergens"] else ""
        lines.append(f"  • {item['name']} — £{item['price']:.2f}: {item['description']}{allergen_note}")

    return "\n".join(lines).strip()
