import json
import re
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch
from tools.order_tool import _place_order, _session_id

_PATCH = "tools.order_tool._DATA_DIR"
_SESSION = "test-session-001"


def test_happy_path_returns_confirmation(data_dir):
    _session_id.set(_SESSION)
    with patch(_PATCH, data_dir):
        result = _place_order(["Test Bruschetta"])
    assert "Order received" in result
    assert "Reference" in result


def test_reference_id_format(data_dir):
    _session_id.set(_SESSION)
    with patch(_PATCH, data_dir):
        result = _place_order(["Test Bruschetta"])
    assert re.search(r"ORD-[A-Z0-9]{8}", result) is not None


def test_case_insensitive_name_match(data_dir):
    # "test bruschetta" (all lowercase) must match "Test Bruschetta" in the menu.
    _session_id.set(_SESSION)
    with patch(_PATCH, data_dir):
        result = _place_order(["test bruschetta"])
    assert "Order received" in result
    assert "Test Bruschetta" in result


def test_item_not_found_listed_in_note(data_dir):
    # One valid item, one nonexistent — order proceeds for valid item only.
    _session_id.set(_SESSION)
    with patch(_PATCH, data_dir):
        result = _place_order(["Test Bruschetta", "Dragon Steak"])
    assert "Order received" in result
    assert "Dragon Steak" in result
    assert "not found" in result.lower()


def test_all_items_invalid_returns_not_found_message(data_dir):
    _session_id.set(_SESSION)
    with patch(_PATCH, data_dir):
        result = _place_order(["Dragon Steak", "Mystery Soup"])
    assert "None of the requested items were found" in result


def test_all_items_invalid_does_not_write_orders_json(data_dir):
    _session_id.set(_SESSION)
    with patch(_PATCH, data_dir):
        _place_order(["Dragon Steak"])
    saved = json.loads((data_dir / "orders.json").read_text(encoding="utf-8"))
    assert saved["orders"] == []


def test_unavailable_item_excluded_from_order(data_dir):
    # T003 (Test Tiramisu) is available=False. Order alongside a valid item so the
    # order proceeds; the unavailable item must not appear in the confirmed items.
    _session_id.set(_SESSION)
    with patch(_PATCH, data_dir):
        result = _place_order(["Test Bruschetta", "Test Tiramisu"])
    assert "Test Bruschetta" in result
    assert "currently unavailable" in result
    # Verify unavailable item is not billed
    assert "Test Tiramisu" not in result.split("Note:")[0]


def test_correct_total_for_multiple_items(data_dir):
    # T001 = £8.50, T002 = £18.00 → total = £26.50
    _session_id.set(_SESSION)
    with patch(_PATCH, data_dir):
        result = _place_order(["Test Bruschetta", "Test Risotto"])
    assert "26.50" in result


def test_data_persisted_to_orders_json(data_dir):
    _session_id.set(_SESSION)
    with patch(_PATCH, data_dir):
        _place_order(["Test Bruschetta"])
    saved = json.loads((data_dir / "orders.json").read_text(encoding="utf-8"))
    assert len(saved["orders"]) == 1
    order = saved["orders"][0]
    assert order["session_id"] == _SESSION
    assert order["status"] == "received"
    assert order["total"] == 8.50
    assert any(i["name"] == "Test Bruschetta" for i in order["items"])
    assert re.match(r"ORD-[A-Z0-9]{8}", order["id"])


def test_total_in_persisted_record_matches_sum(data_dir):
    # T001 (8.50) + T002 (18.00) = 26.50
    _session_id.set(_SESSION)
    with patch(_PATCH, data_dir):
        _place_order(["Test Bruschetta", "Test Risotto"])
    saved = json.loads((data_dir / "orders.json").read_text(encoding="utf-8"))
    assert saved["orders"][0]["total"] == 26.50
