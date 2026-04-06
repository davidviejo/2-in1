import pytest
from unittest.mock import patch, Mock
import requests
from apps.web.blueprints.bot_sim import check

class TestBotSim:

    def test_check_url_vacia(self):
        """Test that an empty URL returns URL_VACIA status."""
        assert check("")['status'] == 'URL_VACIA'
        assert check(None)['status'] == 'URL_VACIA'
        assert check("   ")['status'] == 'URL_VACIA'

    @patch('apps.web.blueprints.bot_sim.is_safe_url')
    def test_check_url_no_permitida(self, mock_is_safe):
        """Test that an unsafe URL returns URL_NO_PERMITIDA status."""
        mock_is_safe.return_value = False
        result = check("http://unsafe.com")
        assert result['status'] == 'URL_NO_PERMITIDA'

    @patch('apps.web.blueprints.bot_sim.is_safe_url')
    @patch('apps.web.blueprints.bot_sim.session.get')
    def test_check_error_ambos(self, mock_get, mock_is_safe):
        """Test that connection errors for both agents return ERROR_AMBOS."""
        mock_is_safe.return_value = True
        mock_get.side_effect = requests.exceptions.RequestException("Connection error")

        result = check("http://example.com")
        assert result['status'] == 'ERROR_AMBOS'

    @patch('apps.web.blueprints.bot_sim.is_safe_url')
    @patch('apps.web.blueprints.bot_sim.session.get')
    def test_check_error_user(self, mock_get, mock_is_safe):
        """Test that connection error for user agent only returns ERROR_USER."""
        mock_is_safe.return_value = True

        # First call fails (User), second succeeds (Bot)
        mock_resp_bot = Mock()
        mock_resp_bot.status_code = 200
        mock_resp_bot.content = b"bot content"

        mock_get.side_effect = [
            requests.exceptions.RequestException("User error"),
            mock_resp_bot
        ]

        result = check("http://example.com")
        assert result['status'] == 'ERROR_USER'

    @patch('apps.web.blueprints.bot_sim.is_safe_url')
    @patch('apps.web.blueprints.bot_sim.session.get')
    def test_check_error_bot(self, mock_get, mock_is_safe):
        """Test that connection error for bot agent only returns ERROR_BOT."""
        mock_is_safe.return_value = True

        # First call succeeds (User), second fails (Bot)
        mock_resp_user = Mock()
        mock_resp_user.status_code = 200
        mock_resp_user.content = b"user content"

        mock_get.side_effect = [
            mock_resp_user,
            requests.exceptions.RequestException("Bot error")
        ]

        result = check("http://example.com")
        assert result['status'] == 'ERROR_BOT'

    @patch('apps.web.blueprints.bot_sim.is_safe_url')
    @patch('apps.web.blueprints.bot_sim.session.get')
    def test_check_bloqueado(self, mock_get, mock_is_safe):
        """Test detection of blocking (User 200, Bot != 200)."""
        mock_is_safe.return_value = True

        # User gets 200, Bot gets 403
        mock_resp_user = Mock()
        mock_resp_user.status_code = 200
        mock_resp_user.content = b"content"

        mock_resp_bot = Mock()
        mock_resp_bot.status_code = 403
        mock_resp_bot.content = b"forbidden"

        mock_get.side_effect = [mock_resp_user, mock_resp_bot]

        result = check("http://example.com")
        assert result['status'] == 'BLOQUEADO'

    @patch('apps.web.blueprints.bot_sim.is_safe_url')
    @patch('apps.web.blueprints.bot_sim.session.get')
    def test_check_diferente(self, mock_get, mock_is_safe):
        """Test detection of different content (Length difference > 50%)."""
        mock_is_safe.return_value = True

        # User len 100, Bot len 20. Diff=80. Max=100. Ratio=0.8 > 0.5 -> DIFERENTE
        mock_resp_user = Mock()
        mock_resp_user.status_code = 200
        mock_resp_user.content = b"x" * 100

        mock_resp_bot = Mock()
        mock_resp_bot.status_code = 200
        mock_resp_bot.content = b"x" * 20

        mock_get.side_effect = [mock_resp_user, mock_resp_bot]

        result = check("http://example.com")
        assert result['status'] == 'DIFERENTE'

    @patch('apps.web.blueprints.bot_sim.is_safe_url')
    @patch('apps.web.blueprints.bot_sim.session.get')
    def test_check_ok(self, mock_get, mock_is_safe):
        """Test happy path (Similar content)."""
        mock_is_safe.return_value = True

        # User len 100, Bot len 90. Diff=10. Max=100. Ratio=0.1 <= 0.5 -> OK
        mock_resp_user = Mock()
        mock_resp_user.status_code = 200
        mock_resp_user.content = b"x" * 100

        mock_resp_bot = Mock()
        mock_resp_bot.status_code = 200
        mock_resp_bot.content = b"x" * 90

        mock_get.side_effect = [mock_resp_user, mock_resp_bot]

        result = check("http://example.com")
        assert result['status'] == 'OK'
