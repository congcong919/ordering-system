import logging
import os
from contextvars import ContextVar

import httpx
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Injected by run_agent_stream() in agent.py before the agent is invoked.
# Never passed as a tool parameter — the LLM never sees this value.
_firebase_token: ContextVar[str] = ContextVar("firebase_token", default="")


def _base_url() -> str:
    return os.environ.get("ORDERING_API_URL", "http://localhost:3001")


class OrderStatusInput(BaseModel):
    order_id: str = Field(description="The order ID provided by the customer")


def _check_order_status(order_id: str) -> str:
    token = _firebase_token.get()
    if not token:
        return (
            "I can only check order status for signed-in users. "
            "Please log in and try again, or visit the order tracking page directly."
        )

    try:
        resp = httpx.get(
            f"{_base_url()}/api/orders/{order_id.strip()}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10.0,
        )
        if resp.status_code == 404:
            return f"No order found with ID '{order_id}'. Please check the ID and try again."
        if resp.status_code == 403:
            return "You don't have permission to view that order."
        resp.raise_for_status()
        order = resp.json()
    except httpx.RequestError as exc:
        logger.error("order_status_tool: network error: %s", exc)
        return "Sorry, I couldn't reach the ordering service. Please try again shortly."
    except httpx.HTTPStatusError as exc:
        logger.error("order_status_tool: HTTP %s", exc.response.status_code)
        return "Sorry, there was an error looking up your order."

    status = order.get("status", "unknown")
    items = order.get("items", [])
    item_list = (
        ", ".join(f"{i['name']} ×{i['quantity']}" for i in items) if items else "—"
    )
    total = order.get("total")
    total_str = f"${total:.2f}" if total is not None else "—"

    status_messages = {
        "pending":   "Your order has been received and is waiting to be confirmed.",
        "confirmed": "Your order has been confirmed and will start being prepared shortly.",
        "preparing": "Your order is being prepared right now.",
        "ready":     "Your order is ready! Please collect it.",
        "completed": "Your order has been completed. Enjoy your meal!",
        "cancelled": "Your order has been cancelled.",
    }
    status_detail = status_messages.get(status, f"Status: {status}")

    short_id = order_id.strip()[-8:].upper()
    return (
        f"**Order #{short_id}**\n"
        f"- Status: **{status}** — {status_detail}\n"
        f"- Items: {item_list}\n"
        f"- Total: {total_str}"
    )


order_status_tool = StructuredTool.from_function(
    func=_check_order_status,
    name="order_status_tool",
    description=(
        "Look up the live status of a customer's order. "
        "Ask the customer for their order ID, then call this tool. "
        "Returns current status (pending/confirmed/preparing/ready/completed/cancelled) "
        "and a summary of order items and total."
    ),
    args_schema=OrderStatusInput,
)
