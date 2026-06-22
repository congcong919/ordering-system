import asyncio
import logging
import os
import sys
from datetime import date
from pathlib import Path

logger = logging.getLogger(__name__)

# Ensure backend/ is on the path when run from any working directory
sys.path.insert(0, str(Path(__file__).parent.parent))

from langchain.agents import create_agent
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI

from src.prompts import load_prompt
from tools import all_tools
from tools.order_status_tool import _firebase_token

# Single checkpointer shared across all sessions — stores memory keyed by thread_id
_checkpointer = MemorySaver()
_agent = None


def _get_agent():
    global _agent
    if _agent is None:
        system_prompt = load_prompt("restaurant").format(
            current_date=date.today().isoformat()
        )
        llm = ChatOpenAI(
            model="deepseek-chat",
            openai_api_key=os.environ["DEEPSEEK_API_KEY"],
            openai_api_base="https://api.deepseek.com",
            streaming=True,
            temperature=0,
        )
        _agent = create_agent(
            model=llm,
            tools=all_tools,
            checkpointer=_checkpointer,
            system_prompt=system_prompt,
            debug=False,
        )
    return _agent


async def run_agent_stream(message: str, thread_id: str, queue: asyncio.Queue, firebase_token: str = "") -> None:
    """Run the agent and push response tokens into queue. Puts None when done."""
    _firebase_token.set(firebase_token)
    agent = _get_agent()
    config = {"configurable": {"thread_id": thread_id}}
    try:
        async for event in agent.astream_events(
            {"messages": [("human", message)]},
            config=config,
            version="v2",
        ):
            if event["event"] == "on_chat_model_stream":
                chunk = event["data"]["chunk"]
                # Skip tool-call chunks — only emit final text answer
                if chunk.content and not getattr(chunk, "tool_call_chunks", []):
                    await queue.put(chunk.content)
    except Exception:
        logger.exception("Agent error for session %s", thread_id)
        await queue.put("Sorry, something went wrong. Please try again.")
    finally:
        await queue.put(None)  # sentinel — stream complete


def remove_session(thread_id: str) -> bool:
    """Delete all checkpoint data for a thread_id (clears conversation memory)."""
    # Storage and writes are keyed by (thread_id, checkpoint_ns, checkpoint_id) tuples.
    storage_keys = [k for k in _checkpointer.storage if k[0] == thread_id]
    for k in storage_keys:
        _checkpointer.storage.pop(k, None)
    write_keys = [k for k in _checkpointer.writes if k[0] == thread_id]
    for k in write_keys:
        _checkpointer.writes.pop(k, None)
    return bool(storage_keys)
