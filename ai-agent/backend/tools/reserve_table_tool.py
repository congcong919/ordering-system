import logging
import os

import httpx
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


def _base_url() -> str:
    return os.environ.get("ORDERING_API_URL", "http://localhost:3001")


class ReserveTableInput(BaseModel):
    name: str = Field(description="Full name of the guest making the reservation")
    date: str = Field(description="Reservation date in YYYY-MM-DD format")
    time: str = Field(description="Preferred reservation time in HH:MM (24-hour) format")
    party_size: int = Field(description="Number of guests (1–8)")
    notes: str = Field(default="", description="Optional special requests or dietary requirements")


def _reserve_table(name: str, date: str, time: str, party_size: int, notes: str = "") -> str:
    logger.debug(
        "reserve_table_tool: name=%s date=%s time=%s party_size=%d", name, date, time, party_size
    )

    try:
        resp = httpx.post(
            f"{_base_url()}/api/reservations",
            json={
                "name": name,
                "date": date,
                "time": time,
                "partySize": party_size,
                "notes": notes,
            },
            timeout=10.0,
        )

        if resp.status_code == 400:
            try:
                detail = resp.json().get("error", "Invalid reservation request.")
            except Exception:
                detail = "Invalid reservation request."
            return f"Reservation rejected: {detail}"

        if resp.status_code == 409:
            return (
                f"I'm sorry, there are no available tables for {party_size} guest(s) on {date}. "
                "Please try a different date or party size."
            )

        resp.raise_for_status()
        data = resp.json()

    except httpx.RequestError as exc:
        logger.error("reserve_table_tool: network error: %s", exc)
        return "Sorry, the reservation service is temporarily unavailable. Please try again shortly."
    except httpx.HTTPStatusError as exc:
        logger.error("reserve_table_tool: HTTP %s", exc.response.status_code)
        return "Sorry, there was an error creating the reservation. Please try again."

    ref = data.get("id", "—")
    booked_time = data.get("time", time)
    booked_date = data.get("date", date)
    table = data.get("tableNumber", "—")
    requested_time = data.get("requestedTime")

    time_note = (
        f"  Note: {requested_time} was unavailable — booked the nearest available slot instead.\n"
        if requested_time
        else ""
    )

    return (
        f"Reservation confirmed!\n"
        f"  Booking reference: {ref}\n"
        f"  Name: {name}\n"
        f"  Date: {booked_date} at {booked_time}\n"
        f"{time_note}"
        f"  Party size: {party_size}\n"
        f"  Table: {table}\n"
        f"  Notes: {notes or 'None'}\n"
        "We look forward to welcoming you!"
    )


reserve_table_tool = StructuredTool.from_function(
    func=_reserve_table,
    name="reserve_table_tool",
    description=(
        "Book a table reservation in one step. "
        "Collect the guest name, date (YYYY-MM-DD), preferred time (HH:MM 24-hour), and party size, "
        "then call this tool to confirm the booking. "
        "If the requested time is unavailable, the server automatically books the nearest available "
        "slot (±30/60/90/120 min) and the response will include the actual booked time. "
        "If no tables are available at all on that date, returns a 'no availability' message. "
        "Notes are optional. Do not call this tool more than once for the same reservation."
    ),
    args_schema=ReserveTableInput,
)
