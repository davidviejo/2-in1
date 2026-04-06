import pytest
from apps.web.blueprints.wpo_tool import check_wpo

def test_check_wpo_safe_url():
    # This shouldn't actually reach the internet if it is not a valid or safe URL,
    # or should fail fast and return expected dict struct with -1 ttfb.
    # The `is_safe_url` prevents `requests.get` from being hit with local IP.

    # Safe valid URL (we mock requests to prevent real net requests usually, but check_wpo catches error anyway)
    # We will test an unsafe URL

    unsafe_url = "http://127.0.0.1/admin"
    res = check_wpo(unsafe_url)
    assert res['url'] == unsafe_url
    assert res['ttfb'] == 0
    assert res['size'] == 0

def test_check_wpo_invalid_url():
    res = check_wpo("not a url")
    assert res['ttfb'] == 0
    assert res['size'] == 0
