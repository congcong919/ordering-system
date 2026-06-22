import json
import logging
import threading
import uuid
from contextvars import ContextVar
from datetime import datetime
from pathlib import Path
from typing import List

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).parent.parent / "data"
_lock = threading.Lock()

# Set by run_agent_stream() before invoking the agent so the tool always
# receives the correct session ID without the LLM needing to supply it.
_session_id: ContextVar[str] = ContextVar("order_tool_session_id", default="")


def _load_json(filename: str) -> dict:
    return json.loads((_DATA_DIR / filename).read_text(encoding="utf-8"))


def _save_json(filename: str, data: dict) -> None:
    (_DATA_DIR / filename).write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
    )


class OrderInput(BaseModel):
    items: List[str] = Field(description="List of dish names to order (as they appear on the menu)")


def _place_order(items: List[str]) -> str:
    session_id = _session_id.get()
    logger.debug("order_tool: session=%s items=%d", session_id, len(items))
    menu = _load_json("menu.json")
    menu_index = {i["name"].lower(): i for i in menu["items"]}

    ordered = []
    not_found = []

    for item_name in items:
        match = menu_index.get(item_name.strip().lower())
        if match:
            if not match["available"]:
                not_found.append(f"{item_name} (currently unavailable)")
            else:
                ordered.append(match)
        else:
            not_found.append(item_name)

    if not ordered:
        return (
            "None of the requested items were found on the menu. "
            "Please check the menu and try again."
        )

    total = sum(i["price"] for i in ordered)
    order_id = f"ORD-{str(uuid.uuid4())[:8].upper()}"

    with _lock:
        orders_data = _load_json("orders.json")
        orders_data["orders"].append({
            "id": order_id,
            "session_id": session_id,
            "items": [{"id": i["id"], "name": i["name"], "price": i["price"]} for i in ordered],
            "total": round(total, 2),
            "status": "received",
            "timestamp": datetime.utcnow().isoformat(),
        })
        _save_json("orders.json", orders_data)

    lines = [f"Order received! Reference: {order_id}", ""]
    for item in ordered:
        lines.append(f"  • {item['name']} — £{item['price']:.2f}")
    lines.append(f"\n  **Total: £{total:.2f}**")

    if not_found:
        lines.append(f"\nNote: the following items were not found: {', '.join(not_found)}")

    lines.append("\nYour order is being prepared. Grazie!")
    return "\n".join(lines)


order_tool = StructuredTool.from_function(
    func=_place_order,
    name="order_tool",
    description=(
        "Place a food order for items from the menu. "
        "Provide a list of dish names exactly as they appear on the menu. "
        "Returns an order confirmation with total price."
    ),
    args_schema=OrderInput,
)
