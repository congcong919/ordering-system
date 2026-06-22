import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from main import _check_api_key


def test_check_api_key_raises_when_missing(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="DEEPSEEK_API_KEY"):
        _check_api_key()


def test_check_api_key_raises_when_empty_string(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "")
    with pytest.raises(RuntimeError, match="DEEPSEEK_API_KEY"):
        _check_api_key()


def test_check_api_key_passes_when_key_present(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test-key-abc123")
    _check_api_key()  # must not raise
