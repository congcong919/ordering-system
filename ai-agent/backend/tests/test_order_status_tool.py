"""
Tests for order_status_tool — looks up order status via Express GET /api/orders/:id.
Mocks httpx.get and the _firebase_token ContextVar.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import httpx
import pytest
from unittest.mock import patch, MagicMock

from tools.order_status_tool import _check_order_status, _firebase_token

_ORDER_ID = "abc123def456"
_TOKEN = "fake-firebase-token"

_SAMPLE_ORDER = {
    "id": _ORDER_ID,
    "status": "preparing",
    "items": [
        {"name": "Bruschetta", "quantity": 2},
        {"name": "Risotto", "quantity": 1},
    ],
    "total": 42.50,
}


def _mock_order_resp(order: dict, status_code: int = 200):
    mock = MagicMock()
    mock.status_code = status_code
    mock.json.return_value = order
    mock.raise_for_status.return_value = None
    return mock


def _set_token(token: str):
    """Helper to set the ContextVar and return the token value."""
    _firebase_token.set(token)


# ── No token (anonymous / guest) ─────────────────────────────────────────────

def test_no_token_returns_sign_in_message():
    _firebase_token.set("")
    result = _check_order_status(_ORDER_ID)
    assert "signed-in" in result.lower() or "log in" in result.lower()


def test_no_token_makes_no_http_call():
    _firebase_token.set("")
    with patch("tools.order_status_tool.httpx.get") as mock_get:
        _check_order_status(_ORDER_ID)
    mock_get.assert_not_called()


# ── Happy path ────────────────────────────────────────────────────────────────

def test_happy_path_returns_status():
    _firebase_token.set(_TOKEN)
    with patch("tools.order_status_tool.httpx.get", return_value=_mock_order_resp(_SAMPLE_ORDER)):
        result = _check_order_status(_ORDER_ID)
    assert "preparing" in result.lower()


def test_happy_path_includes_items():
    _firebase_token.set(_TOKEN)
    with patch("tools.order_status_tool.httpx.get", return_value=_mock_order_resp(_SAMPLE_ORDER)):
        result = _check_order_status(_ORDER_ID)
    assert "Bruschetta" in result
    assert "Risotto" in result


def test_happy_path_includes_total():
    _firebase_token.set(_TOKEN)
    with patch("tools.order_status_tool.httpx.get", return_value=_mock_order_resp(_SAMPLE_ORDER)):
        result = _check_order_status(_ORDER_ID)
    assert "42.50" in result


def test_happy_path_sends_auth_header():
    _firebase_token.set(_TOKEN)
    with patch("tools.order_status_tool.httpx.get", return_value=_mock_order_resp(_SAMPLE_ORDER)) as mock_get:
        _check_order_status(_ORDER_ID)
    _, kwargs = mock_get.call_args
    headers = kwargs.get("headers", {})
    assert headers.get("Authorization") == f"Bearer {_TOKEN}"


def test_all_statuses_have_detail_message():
    statuses = ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"]
    for status in statuses:
        _firebase_token.set(_TOKEN)
        order = {**_SAMPLE_ORDER, "status": status}
        with patch("tools.order_status_tool.httpx.get", return_value=_mock_order_resp(order)):
            result = _check_order_status(_ORDER_ID)
        assert status in result


# ── Error responses ───────────────────────────────────────────────────────────

def test_404_returns_not_found_message():
    _firebase_token.set(_TOKEN)
    mock = _mock_order_resp({}, status_code=404)
    with patch("tools.order_status_tool.httpx.get", return_value=mock):
        result = _check_order_status(_ORDER_ID)
    assert "No order found" in result


def test_403_returns_permission_message():
    _firebase_token.set(_TOKEN)
    mock = _mock_order_resp({}, status_code=403)
    with patch("tools.order_status_tool.httpx.get", return_value=mock):
        result = _check_order_status(_ORDER_ID)
    assert "permission" in result.lower()


def test_network_error_returns_friendly_message():
    _firebase_token.set(_TOKEN)
    with patch("tools.order_status_tool.httpx.get", side_effect=httpx.RequestError("timeout")):
        result = _check_order_status(_ORDER_ID)
    assert "try again" in result.lower()


def test_http_500_returns_error_message():
    _firebase_token.set(_TOKEN)
    mock = MagicMock()
    mock.status_code = 200
    mock.raise_for_status.side_effect = httpx.HTTPStatusError(
        "500", request=MagicMock(), response=MagicMock(status_code=500)
    )
    with patch("tools.order_status_tool.httpx.get", return_value=mock):
        result = _check_order_status(_ORDER_ID)
    assert "error" in result.lower()
