from pathlib import Path


def test_pyproject_quality_sections_exist() -> None:
    content = Path("pyproject.toml").read_text(encoding="utf-8")
    assert "[tool.ruff]" in content
    assert "[tool.mypy]" in content


def test_makefile_quality_targets_exist() -> None:
    content = Path("Makefile").read_text(encoding="utf-8")
    for target in ("lint:", "format:", "typecheck:", "test:", "quality:"):
        assert target in content
