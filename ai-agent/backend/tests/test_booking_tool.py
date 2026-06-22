"""
Tests for make_reservation_tool — the successor to the old booking_tool.
Mocks httpx.post to simulate Express /api/reservations responses.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import httpx
import pytest
from unittest.mock import patch, MagicMock

from tools.make_reservation_tool import _make_reservation

_DATE = "2026-08-01"
_TIME = "19:00"


def _post_ok(body=None):
    mock = MagicMock()
    mock.status_code = 201
    mock.json.return_value = body or {"id": "R1A2B3", "tableNumber": 3, "status": "confirmed"}
    mock.raise_for_status.return_value = None
    return mock


def _post_conflict():
    mock = MagicMock()
    mock.status_code = 409
    mock.raise_for_status.side_effect = None
    return mock


def test_happy_path_returns_confirmation():
    with patch("tools.make_reservation_tool.httpx.post", return_value=_post_ok()):
        result = _make_reservation("Alice Smith", _DATE, _TIME, 2)
    assert "Reservation confirmed" in result
    assert "R1A2B3" in result


def test_confirmation_includes_table_number():
    with patch("tools.make_reservation_tool.httpx.post", return_value=_post_ok({"id": "RXYZ", "tableNumber": 5})):
        result = _make_reservation("Bob", _DATE, _TIME, 4)
    assert "Table: 5" in result


def test_confirmation_includes_all_fields():
    with patch("tools.make_reservation_tool.httpx.post", return_value=_post_ok()):
        result = _make_reservation("Carol", _DATE, _TIME, 3, notes="gluten-free")
    assert "Carol" in result
    assert _DATE in result
    assert _TIME in result
    assert "3" in result
    assert "gluten-free" in result


def test_empty_notes_shown_as_none():
    with patch("tools.make_reservation_tool.httpx.post", return_value=_post_ok()):
        result = _make_reservation("Dave", _DATE, _TIME, 2, notes="")
    assert "Notes: None" in result


def test_409_conflict_returns_race_condition_message():
    with patch("tools.make_reservation_tool.httpx.post", return_value=_post_conflict()):
        result = _make_reservation("Eve", _DATE, _TIME, 2)
    assert "just filled up" in result


def test_409_suggests_checking_availability_again():
    with patch("tools.make_reservation_tool.httpx.post", return_value=_post_conflict()):
        result = _make_reservation("Eve", _DATE, _TIME, 2)
    assert "check_availability_tool" in result


def test_network_error_returns_unavailable_message():
    with patch("tools.make_reservation_tool.httpx.post", side_effect=httpx.RequestError("timeout")):
        result = _make_reservation("Frank", _DATE, _TIME, 2)
    assert "temporarily unavailable" in result.lower()


def test_http_500_returns_error_message():
    mock = MagicMock()
    mock.status_code = 500
    mock.raise_for_status.side_effect = httpx.HTTPStatusError(
        "500", request=MagicMock(), response=MagicMock(status_code=500)
    )
    with patch("tools.make_reservation_tool.httpx.post", return_value=mock):
        result = _make_reservation("Grace", _DATE, _TIME, 2)
    assert "error" in result.lower()


def test_post_payload_contains_camelCase_partySize():
    captured = {}

    def fake_post(url, json=None, timeout=None):
        captured["json"] = json
        return _post_ok()

    with patch("tools.make_reservation_tool.httpx.post", side_effect=fake_post):
        _make_reservation("Hannah", _DATE, _TIME, 4)

    assert captured["json"]["partySize"] == 4
    assert captured["json"]["name"] == "Hannah"
