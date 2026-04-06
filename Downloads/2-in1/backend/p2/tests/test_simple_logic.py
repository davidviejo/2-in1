import pytest
from unittest.mock import patch
from apps.web.blueprints.pixel_tool import get_px
from apps.web.blueprints.serp_scanner import is_valid_url
from apps.core_monitor import update_global, reset_global, GLOBAL_STATE
from apps.tools.ai_hub import execute_ai_task

# --- Tests for apps.web.blueprints.pixel_tool.py ---

def test_get_px_normal():
    # "test" length is 4. Scale 1. 4 * 9 * 1 = 36
    assert get_px("test") == 36
    # "hello" length 5. Scale 1. 5 * 9 = 45
    assert get_px("hello") == 45

def test_get_px_scale():
    # Scale 0.9. "test" length 4. 4 * 9 * 0.9 = 32.4 -> int(32.4) = 32
    assert get_px("test", scale=0.9) == 32

def test_get_px_edge():
    # Empty string
    assert get_px("") == 0
    assert get_px(None) == 0

# --- Tests for apps/serp_scanner.py ---

def test_is_valid_url_normal():
    assert is_valid_url("https://example.com") is True
    assert is_valid_url("http://mysite.org/page") is True

def test_is_valid_url_edge():
    # Blacklisted domain
    assert is_valid_url("https://www.google.com/search") is False
    assert is_valid_url("https://facebook.com/profile") is False
    # Empty
    assert is_valid_url("") is False
    assert is_valid_url(None) is False

# --- Tests for apps/core_monitor.py ---

def test_monitor_state_flow():
    # Ensure clean state at start
    reset_global()
    try:
        assert GLOBAL_STATE['active'] is False
        assert GLOBAL_STATE['progress'] == 0

        # Update state
        update_global("Test Tool", 50, "Processing...")
        assert GLOBAL_STATE['active'] is True
        assert GLOBAL_STATE['tool_name'] == "Test Tool"
        assert GLOBAL_STATE['progress'] == 50
        assert GLOBAL_STATE['action'] == "Processing..."
    finally:
        # Always reset state after test to avoid side effects
        reset_global()
        assert GLOBAL_STATE['active'] is False
        assert GLOBAL_STATE['progress'] == 0
        assert GLOBAL_STATE['action'] == "Inactivo"

# --- Tests for apps/ai_fixer.py ---

def test_execute_ai_task_simulation():
    # Mock query_llm to simulate response
    with patch('apps.tools.ai_hub._query_openai_direct') as mock_query:
        mock_query.return_value = "[SIMULACIÓN AI] Fix this text"

        prompt = "Fix this text"
        response = execute_ai_task(prompt, 'gpt-4o')

        assert isinstance(response, dict)
        assert "[SIMULACIÓN AI]" in response['content']
        assert "Fix this text" in response['content']
