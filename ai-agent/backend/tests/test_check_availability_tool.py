"""
Tests for check_availability_tool — checks table availability and suggests alternatives.
Mocks httpx.get to simulate Express /api/reservations/availability responses.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import httpx
import pytest
from unittest.mock import patch, MagicMock

from tools.check_availability_tool import _check_availability

_DATE = "2026-08-01"
_TIME = "19:00"


def _avail_resp(available: bool):
    mock = MagicMock()
    mock.status_code = 200
    mock.json.return_value = {"available": available}
    mock.raise_for_status.return_value = None
    return mock


# ── Happy path ────────────────────────────────────────────────────────────────

def test_available_slot_returns_confirmation():
    with patch("tools.check_availability_tool.httpx.get", return_value=_avail_resp(True)):
        result = _check_availability(_DATE, _TIME, 2)
    assert "available" in result.lower()
    assert "Would you like me to confirm" in result


def test_available_includes_date_and_time():
    with patch("tools.check_availability_tool.httpx.get", return_value=_avail_resp(True)):
        result = _check_availability(_DATE, _TIME, 2)
    assert _DATE in result
    assert _TIME in result


def test_available_singular_guest_label():
    with patch("tools.check_availability_tool.httpx.get", return_value=_avail_resp(True)):
        result = _check_availability(_DATE, _TIME, 1)
    assert "1 guest" in result


def test_available_plural_guests_label():
    with patch("tools.check_availability_tool.httpx.get", return_value=_avail_resp(True)):
        result = _check_availability(_DATE, _TIME, 4)
    assert "4 guests" in result


# ── Unavailable — alternatives found ─────────────────────────────────────────

def test_unavailable_probes_alternatives_and_returns_them():
    # Main: unavailable. Probe dt+1h (20:00): available. Rest: unavailable.
    responses = [_avail_resp(False)] + [_avail_resp(True)] + [_avail_resp(False)] * 3
    with patch("tools.check_availability_tool.httpx.get", side_effect=responses):
        result = _check_availability(_DATE, _TIME, 2)
    assert "fully booked" in result.lower()
    assert "20:00" in result


def test_unavailable_returns_up_to_3_alternatives():
    # Main: unavailable. All probes: available → stops at 3 alternatives.
    responses = [_avail_resp(False)] + [_avail_resp(True)] * 4
    with patch("tools.check_availability_tool.httpx.get", side_effect=responses):
        result = _check_availability(_DATE, _TIME, 2)
    assert result.count("•") <= 3


def test_unavailable_no_alternatives_found():
    with patch("tools.check_availability_tool.httpx.get", return_value=_avail_resp(False)):
        result = _check_availability(_DATE, _TIME, 2)
    assert "different date" in result.lower() or "no tables" in result.lower()


# ── Validation errors ─────────────────────────────────────────────────────────

def test_party_size_zero_returns_error():
    result = _check_availability(_DATE, _TIME, 0)
    assert "between 1 and 8" in result


def test_party_size_nine_returns_error():
    result = _check_availability(_DATE, _TIME, 9)
    assert "between 1 and 8" in result


def test_invalid_date_format_returns_error():
    result = _check_availability("next Friday", _TIME, 2)
    assert "Invalid" in result


def test_invalid_date_separators_returns_error():
    result = _check_availability("01/08/2026", _TIME, 2)
    assert "Invalid" in result


def test_invalid_time_format_returns_error():
    result = _check_availability(_DATE, "7pm", 2)
    assert "Invalid" in result


def test_invalid_time_12h_format_returns_error():
    result = _check_availability(_DATE, "7:00 PM", 2)
    assert "Invalid" in result


def test_validation_makes_no_http_call():
    with patch("tools.check_availability_tool.httpx.get") as mock_get:
        _check_availability(_DATE, "bad-time", 2)
    mock_get.assert_not_called()


# ── Network / server errors ───────────────────────────────────────────────────

def test_network_error_returns_unavailable_message():
    with patch("tools.check_availability_tool.httpx.get", side_effect=httpx.RequestError("timeout")):
        result = _check_availability(_DATE, _TIME, 2)
    assert "temporarily unavailable" in result.lower()


def test_http_error_returns_error_message():
    mock = MagicMock()
    mock.raise_for_status.side_effect = httpx.HTTPStatusError(
        "500", request=MagicMock(), response=MagicMock(status_code=500)
    )
    with patch("tools.check_availability_tool.httpx.get", return_value=mock):
        result = _check_availability(_DATE, _TIME, 2)
    assert "error" in result.lower()
