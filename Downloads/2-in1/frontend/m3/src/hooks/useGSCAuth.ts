import { useState, useEffect } from 'react';
import { GoogleUser } from '../types';
import { getUserInfo } from '../services/googleSearchConsole';
import { useToast } from '../components/ui/ToastContext';

export const useGSCAuth = () => {
  const { error: showError, success: showSuccess } = useToast();
  const [gscAccessToken, setGscAccessToken] = useState<string | null>(() =>
    localStorage.getItem('mediaflow_gsc_token'),
  );
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [showGscConfig, setShowGscConfig] = useState(false);
  const [clientId, setClientId] = useState(
    () =>
      localStorage.getItem('mediaflow_gsc_client_id') ||
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      '',
  );

  const handleSaveClientId = (id: string) => {
    if (!id) {
      showError('El Client ID no puede estar vacío.');
      return;
    }
    setClientId(id);
    localStorage.setItem('mediaflow_gsc_client_id', id);
    setShowGscConfig(false);
    showSuccess('Configuración guardada correctamente.');
  };

  const handleLogoutGsc = () => {
    setGscAccessToken(null);
    setGoogleUser(null);
    localStorage.removeItem('mediaflow_gsc_token');
    showSuccess('Sesión cerrada.');
  };

  // Restore session
  useEffect(() => {
    if (gscAccessToken && !googleUser) {
      getUserInfo(gscAccessToken)
        .then(setGoogleUser)
        .catch(() => {
          // Token invalid or expired
          handleLogoutGsc();
        });
    }
  }, []); // Run once on mount

  const login = (onSuccess?: (token: string) => void) => {
    if (!clientId) {
      setShowGscConfig(true);
      return;
    }

    if (window.google) {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope:
            'https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              console.error('GSC OAuth callback error', tokenResponse);
              showError(
                `No se pudo completar la autorización de Google (${tokenResponse.error}${
                  tokenResponse.error_description
                    ? `: ${tokenResponse.error_description}`
                    : ''
                }).`,
              );
              return;
            }

            if (tokenResponse.access_token) {
              const token = tokenResponse.access_token;
              setGscAccessToken(token);
              localStorage.setItem('mediaflow_gsc_token', token);

              try {
                const userInfo = await getUserInfo(token);
                setGoogleUser(userInfo);
                showSuccess(`Bienvenido, ${userInfo.name}`);
                if (onSuccess) onSuccess(token);
              } catch (e) {
                console.error(e);
                setGscAccessToken(null);
                setGoogleUser(null);
                localStorage.removeItem('mediaflow_gsc_token');
                showError(
                  'No se pudo validar tu cuenta de Google Search Console. Intenta iniciar sesión nuevamente.',
                );
              }
            } else {
              showError('No se pudo obtener el token de acceso.');
            }
          },
        });
        client.requestAccessToken();
      } catch (error) {
        console.error('GSC OAuth init error', error);
        showError(
          'No se pudo iniciar OAuth de Google. Revisa tu Client ID y que el dominio actual esté en Authorized JavaScript origins.',
        );
      }
    } else {
      showError('La librería de Google Identity no ha cargado aún. Recarga la página.');
    }
  };

  return {
    gscAccessToken,
    googleUser,
    clientId,
    showGscConfig,
    setShowGscConfig,
    handleSaveClientId,
    handleLogoutGsc,
    login,
    setClientId, // Exporting this in case we need to bind it to an input
  };
};
