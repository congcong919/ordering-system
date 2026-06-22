import logging

from asteval import Interpreter
from langchain_core.tools import tool

logger = logging.getLogger(__name__)


@tool
def calculator_tool(expression: str) -> str:
    """Evaluate a math expression. Input must be a valid Python math expression string."""
    logger.debug("calculator_tool: expression=%r", expression)
    try:
        aeval = Interpreter()
        result = aeval(expression)
        if aeval.error:
            return f"Error: {aeval.error[0].get_error()}"
        return str(result)
    except Exception as e:
        return f"Error: {e}"
