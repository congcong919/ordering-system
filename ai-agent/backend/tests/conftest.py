import json
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch

# Items use camelCase to match the Express API response that data.py now fetches.
# data.py normalises isSpecial→is_special before returning, so tool code sees snake_case.
# T003 is intentionally unavailable to test available-item filtering.
_MENU_ITEMS = [
    {
        "id": "T001",
        "name": "Test Bruschetta",
        "category": "Starters",
        "price": 8.50,
        "description": "Test starter with allergens",
        "allergens": ["gluten"],
        "available": True,
        "isSpecial": False,
    },
    {
        "id": "T002",
        "name": "Test Risotto",
        "category": "Mains",
        "price": 18.00,
        "description": "Test main — today's special",
        "allergens": ["dairy"],
        "available": True,
        "isSpecial": True,
    },
    {
        "id": "T003",
        "name": "Test Tiramisu",
        "category": "Desserts",
        "price": 9.00,
        "description": "Test dessert — currently unavailable",
        "allergens": ["dairy", "eggs", "gluten"],
        "available": False,
        "isSpecial": False,
    },
]

_ORDERS_DATA = {"orders": []}


@pytest.fixture
def mock_menu():
    """
    Patches httpx.get in src.data to return the standard test menu.
    Use this in menu_tool / specials_tool tests instead of patching DATA_DIR.
    """
    mock_resp = MagicMock()
    mock_resp.json.return_value = list(_MENU_ITEMS)
    mock_resp.raise_for_status.return_value = None
    with patch("src.data.httpx.get", return_value=mock_resp):
        yield


@pytest.fixture
def data_dir(tmp_path: Path) -> Path:
    """
    Temporary data directory used by order_tool tests (which still read
    menu.json and orders.json directly via their own _DATA_DIR).

    Menu items are stored in camelCase so they match the Express API shape
    that data.py now fetches — keeps both code paths consistent.
    """
    menu_data = {
        "categories": ["Starters", "Mains", "Desserts"],
        "items": _MENU_ITEMS,
    }
    (tmp_path / "menu.json").write_text(
        json.dumps(menu_data, indent=2), encoding="utf-8"
    )
    (tmp_path / "orders.json").write_text(
        json.dumps(_ORDERS_DATA, indent=2), encoding="utf-8"
    )
    return tmp_path
