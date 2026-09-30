import { useEffect, useState } from 'react';
import axios from '../utils/axios';
import { BOTH_DOCUMENT_TEMPLATES_ENDPOINT } from '../utils/constant';

const DEFAULTS = {
  enableDocumentRequests: true,
  enableSelfServiceDocuments: true,
};

export default function useDocumentModeSettings() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${BOTH_DOCUMENT_TEMPLATES_ENDPOINT}/mode-settings`, {
          withCredentials: true,
        });
        if (cancelled) return;
        setSettings({
          enableDocumentRequests: data?.data?.enableDocumentRequests !== false,
          enableSelfServiceDocuments: data?.data?.enableSelfServiceDocuments !== false,
        });
      } catch {
        if (!cancelled) setSettings(DEFAULTS);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...settings, ready };
}
