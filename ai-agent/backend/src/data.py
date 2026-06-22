import logging
import os

import httpx

logger = logging.getLogger(__name__)


def load_menu() -> dict:
    url = os.environ.get("ORDERING_API_URL", "http://localhost:3001")
    resp = httpx.get(f"{url}/api/menu", timeout=5.0)
    resp.raise_for_status()
    items = resp.json()
    # Normalise camelCase fields from Express to snake_case for tool compatibility
    for item in items:
        item.setdefault("allergens", [])
        if "isSpecial" in item:
            item["is_special"] = item.pop("isSpecial")
        item.setdefault("is_special", False)
        if "imageUrl" in item:
            item["image_url"] = item.pop("imageUrl")
    return {"items": items}
