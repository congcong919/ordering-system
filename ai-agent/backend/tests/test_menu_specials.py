import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch, MagicMock

from tools.menu_tool import menu_tool
from tools.specials_tool import specials_tool
from tests.conftest import _MENU_ITEMS


def _mock_get(items):
    """Return a mock httpx response that yields the given items list."""
    mock = MagicMock()
    mock.json.return_value = list(items)
    mock.raise_for_status.return_value = None
    return mock


# ── menu_tool ────────────────────────────────────────────────────────────────

def test_menu_no_category_returns_all_available(mock_menu):
    result = menu_tool.invoke("")
    assert "Test Bruschetta" in result   # T001 — available
    assert "Test Risotto" in result      # T002 — available
    assert "Test Tiramisu" not in result # T003 — unavailable


def test_menu_valid_category_exact_case(mock_menu):
    result = menu_tool.invoke("Starters")
    assert "Test Bruschetta" in result
    assert "Test Risotto" not in result


def test_menu_valid_category_lowercase(mock_menu):
    result_exact = menu_tool.invoke("Starters")
    result_lower = menu_tool.invoke("starters")
    assert result_exact == result_lower


def test_menu_invalid_category_lists_valid_options(mock_menu):
    result = menu_tool.invoke("Soups")
    assert "Valid categories" in result
    assert "Starters" in result


def test_menu_unavailable_item_excluded(mock_menu):
    result = menu_tool.invoke("")
    assert "Test Tiramisu" not in result


def test_menu_allergens_shown_in_output(mock_menu):
    result = menu_tool.invoke("")
    assert "gluten" in result   # T001
    assert "dairy" in result    # T002


def test_menu_all_unavailable_returns_fallback():
    items = [
        {"id": "X1", "name": "Ghost Item", "category": "Starters", "price": 1.0,
         "description": "x", "allergens": [], "available": False, "isSpecial": False},
    ]
    with patch("src.data.httpx.get", return_value=_mock_get(items)):
        result = menu_tool.invoke("")
    assert "No menu items" in result


# ── specials_tool ─────────────────────────────────────────────────────────────

def test_specials_available_special_appears(mock_menu):
    result = specials_tool.invoke("")
    assert "Test Risotto" in result          # T002 — isSpecial=True, available=True
    assert "Today's Specials" in result


def test_specials_unavailable_special_excluded():
    items = [
        {"id": "X1", "name": "Ghost Special", "category": "Mains", "price": 20.0,
         "description": "x", "allergens": [], "available": False, "isSpecial": True},
    ]
    with patch("src.data.httpx.get", return_value=_mock_get(items)):
        result = specials_tool.invoke("")
    assert "Ghost Special" not in result


def test_specials_no_specials_returns_fallback():
    items = [
        {"id": "X1", "name": "Regular Item", "category": "Starters", "price": 8.0,
         "description": "x", "allergens": [], "available": True, "isSpecial": False},
    ]
    with patch("src.data.httpx.get", return_value=_mock_get(items)):
        result = specials_tool.invoke("")
    assert "no specials" in result.lower()


def test_specials_allergens_shown(mock_menu):
    result = specials_tool.invoke("")
    assert "dairy" in result   # T002 allergen
