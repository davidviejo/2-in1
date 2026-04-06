import pytest
from unittest.mock import MagicMock, patch
from apps.tools.llm_service import query_llm

def test_query_llm_invalid_provider():
    response = query_llm("test", provider='invalid_provider')
    assert "no soportado" in response

def test_query_llm_openai_simulation():
    # Forzamos que openai sea None para probar la simulación
    with patch('apps.tools.llm_service.openai', None):
         response = query_llm("test", provider='openai')
         assert "[SIMULACIÓN OpenAI]" in response

def test_query_llm_anthropic_simulation():
    with patch('apps.tools.llm_service.anthropic', None):
         response = query_llm("test", provider='anthropic')
         assert "[SIMULACIÓN Anthropic/Claude]" in response

def test_query_llm_google_simulation():
    with patch('apps.tools.llm_service.genai', None):
         response = query_llm("test", provider='google')
         assert "[SIMULACIÓN Google Gemini]" in response

def test_openai_call_success():
    mock_client = MagicMock()
    # Mockear la estructura de respuesta de OpenAI
    mock_response = MagicMock()
    mock_message = MagicMock()
    mock_message.content = "GPT Response"
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response.choices = [mock_choice]

    mock_client.chat.completions.create.return_value = mock_response

    with patch('apps.tools.llm_service.openai') as mock_openai:
        mock_openai.OpenAI.return_value = mock_client
        # Debemos proveer api_key para evitar el fallback a simulación
        response = query_llm("test", provider='openai', api_key='sk-test')
        assert response == "GPT Response"
        mock_client.chat.completions.create.assert_called_once()

def test_anthropic_call_success():
    mock_client = MagicMock()
    # Mockear estructura de respuesta de Anthropic
    mock_content = MagicMock()
    mock_content.text = "Claude Response"
    mock_msg_response = MagicMock()
    mock_msg_response.content = [mock_content]

    mock_client.messages.create.return_value = mock_msg_response

    with patch('apps.tools.llm_service.anthropic') as mock_anthropic:
        mock_anthropic.Anthropic.return_value = mock_client
        response = query_llm("test", provider='anthropic', api_key='sk-ant-test')
        assert response == "Claude Response"
        mock_client.messages.create.assert_called_once()

def test_google_call_success():
    mock_model = MagicMock()
    mock_model.generate_content.return_value.text = "Gemini Response"

    with patch('apps.tools.llm_service.genai') as mock_genai:
        mock_genai.GenerativeModel.return_value = mock_model
        response = query_llm("test", provider='gemini', api_key='ai-google-test')
        assert response == "Gemini Response"
        mock_genai.configure.assert_called_with(api_key='ai-google-test')
