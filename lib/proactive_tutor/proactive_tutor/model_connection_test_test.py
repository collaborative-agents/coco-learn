import io
import json
import ssl
import sys
from types import SimpleNamespace

import pytest
from external_api import dependency_smoke, llm
from external_api.litellm_api import LiteLLMMessage, TextContent
from proactive_tutor import model_connection_test, packaged_entrypoint


@pytest.fixture(autouse=True)
def isolate_connection_settings(monkeypatch):
    for name in ("LLM_ROUTER_URL", "LLM_ROUTER_API_KEY", "SSL_CERT_FILE", "SSL_CERT_DIR"):
        monkeypatch.delenv(name, raising=False)


def test_connection_uses_tiny_multimodal_request(monkeypatch) -> None:
    captured: dict = {}

    def fake_chat_completion(messages, **kwargs):
        captured["messages"] = messages
        captured.update(kwargs)
        return (
            LiteLLMMessage(role="assistant", content=[TextContent(text="OK")]),
            {},
        )

    monkeypatch.setattr(llm, "chat_completion", fake_chat_completion)

    assert model_connection_test.test_connection("gemini/test-model", True) == "OK"
    assert captured["max_tokens"] == 8
    assert captured["temperature"] is None
    content = captured["messages"][0]["content"]
    assert content[0] == {"type": "text", "text": "Reply only OK."}
    assert content[1]["type"] == "image_url"
    assert content[1]["image_url"]["url"].startswith("data:image/png;base64,")


def test_tutor_connection_test_is_text_only(monkeypatch) -> None:
    captured: dict = {}

    def fake_chat_completion(messages, **kwargs):
        captured["messages"] = messages
        return (
            LiteLLMMessage(role="assistant", content=[TextContent(text="OK")]),
            {},
        )

    monkeypatch.setattr(llm, "chat_completion", fake_chat_completion)

    model_connection_test.test_connection("anthropic/test-model", False)
    assert captured["messages"][0]["content"] == [
        {"type": "text", "text": "Reply only OK."}
    ]


def test_openai_compatible_test_does_not_inject_vllm_options(monkeypatch) -> None:
    captured: dict = {}

    def fake_chat_completion(messages, **kwargs):
        captured.update(kwargs)
        return (
            LiteLLMMessage(role="assistant", content=[TextContent(text="OK")]),
            {},
        )

    monkeypatch.setattr(llm, "chat_completion", fake_chat_completion)

    model_connection_test.test_connection("hosted_vllm/aws/anthropic/model", False)
    assert "extra_body" not in captured
    assert "reasoning_effort" not in captured


@pytest.mark.parametrize("include_image", [False, True])
def test_router_probe_verifies_tls_without_system_certificates(monkeypatch, include_image):
    monkeypatch.setenv("LLM_ROUTER_URL", "https://router.example.test")
    monkeypatch.setenv("LLM_ROUTER_API_KEY", "test-key")
    # Simulate Python installations without a usable default certificate store.
    monkeypatch.setattr(ssl.SSLContext, "load_default_certs", lambda *args: None)

    def fake_urlopen(request, *, timeout, context):
        assert context.verify_mode == ssl.CERT_REQUIRED
        assert context.check_hostname is True
        assert context.cert_store_stats()["x509_ca"] > 0
        assert timeout == 8
        assert request.full_url == "https://router.example.test/v1/chat/completions"
        content = json.loads(request.data)["messages"][0]["content"]
        assert len(content) == (2 if include_image else 1)
        return io.BytesIO(b'{"choices":[{"message":{"content":"OK"}}]}')

    monkeypatch.setattr(model_connection_test.urllib.request, "urlopen", fake_urlopen)
    assert model_connection_test.test_connection("test-model", include_image) == "OK"


def test_router_probe_preserves_explicit_certificate_bundle(monkeypatch, tmp_path):
    monkeypatch.setenv("LLM_ROUTER_URL", "https://router.example.test")
    monkeypatch.setenv("LLM_ROUTER_API_KEY", "test-key")
    bundle = tmp_path / "custom-ca.pem"
    with open(model_connection_test.certifi.where()) as source:
        bundle.write_text(source.read())
    monkeypatch.setenv("SSL_CERT_FILE", str(bundle))

    def unexpected_fallback():
        raise AssertionError("Explicit trust configuration must not use the fallback")

    monkeypatch.setattr(model_connection_test.certifi, "where", unexpected_fallback)

    def fake_urlopen(request, *, timeout, context):
        assert context.cert_store_stats()["x509_ca"] > 0
        assert context.verify_mode == ssl.CERT_REQUIRED
        return io.BytesIO(b'{"choices":[{"message":{"content":"OK"}}]}')

    monkeypatch.setattr(model_connection_test.urllib.request, "urlopen", fake_urlopen)
    assert model_connection_test.test_connection("test-model", False) == "OK"


@pytest.mark.parametrize("roots", [0, 1])
def test_packaged_smoke_rejects_missing_trusted_roots(monkeypatch, roots):
    monkeypatch.setattr(sys, "argv", ["tutor-server", "--dependency-smoke-test"])
    monkeypatch.setattr(
        model_connection_test,
        "create_tls_context",
        lambda: SimpleNamespace(cert_store_stats=lambda: {"x509_ca": roots}),
    )
    calls = []
    monkeypatch.setattr(dependency_smoke, "main", lambda: calls.append("sdk"))
    if roots:
        packaged_entrypoint.main()
        assert calls == ["sdk"]
    else:
        with pytest.raises(RuntimeError, match="no trusted HTTPS certificates"):
            packaged_entrypoint.main()
        assert calls == []
