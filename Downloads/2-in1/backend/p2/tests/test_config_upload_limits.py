import importlib


def test_max_content_length_uses_mb_env(monkeypatch):
    monkeypatch.setenv('MAX_CONTENT_LENGTH_MB', '256')

    import apps.core.config as config_module

    reloaded = importlib.reload(config_module)

    assert reloaded.Config.MAX_CONTENT_LENGTH_MB == 256
    assert reloaded.Config.MAX_CONTENT_LENGTH == 256 * 1024 * 1024
