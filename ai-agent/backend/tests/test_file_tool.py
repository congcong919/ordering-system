import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from tools import all_tools


def test_file_read_tool_not_in_all_tools():
    tool_names = [t.name for t in all_tools]
    assert "file_read_tool" not in tool_names
