from services.system_prompt import append_system_text


def test_append_system_text_handles_missing_addition() -> None:
    assert append_system_text(None, None) == ""
    assert append_system_text("  Keep me  ", None) == "Keep me"
    assert append_system_text("", "") == ""


def test_append_system_text_appends_with_newline() -> None:
    assert append_system_text(None, "  Alpha  ") == "Alpha"
    assert append_system_text("Alpha", "Beta") == "Alpha\nBeta"
    assert append_system_text("  Alpha  ", "  Beta ") == "Alpha\nBeta"
