import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from tools.calculator_tool import calculator_tool


def test_calculator_basic():
    assert calculator_tool.invoke("2 + 2") == "4"


def test_calculator_math():
    result = calculator_tool.invoke("sqrt(16)")
    assert result == "4.0"


def test_calculator_invalid():
    result = calculator_tool.invoke("import os")
    assert "Error" in result
