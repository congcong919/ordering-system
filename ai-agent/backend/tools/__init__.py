from .calculator_tool import calculator_tool
from .menu_tool import menu_tool
from .order_status_tool import order_status_tool
from .reserve_table_tool import reserve_table_tool
from .specials_tool import specials_tool

all_tools = [
    menu_tool,
    specials_tool,
    reserve_table_tool,
    order_status_tool,
    calculator_tool,
]
