import { useEffect, useState } from 'react';
import axios from '../utils/axios';
import { DEFAULT_SYSTEM_ROLE } from '../utils/systemRoles';
import { inferSystemRoleFromWorkInfo } from '../utils/inferSystemRole';

const EMPTY_SUGGESTION = {
  systemRoleId: DEFAULT_SYSTEM_ROLE,
  reason: null,
  label: null,
};

/**
 * Fetches role suggestion from server (single source of truth), with client fallback.
 */
export const useSuggestedSystemRole = (
  { department, jobTitle, position },
  { enabled = true, debounceMs = 300 } = {}
) => {
  const [suggestion, setSuggestion] = useState(EMPTY_SUGGESTION);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setSuggestion(EMPTY_SUGGESTION);
      return undefined;
    }

    const hasInput = Boolean(department || jobTitle || position);
    if (!hasInput) {
      setSuggestion(EMPTY_SUGGESTION);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await axios.get('/v1/admin/platform-roles/suggest', {
          params: { department, jobTitle, position },
          withCredentials: true,
        });
        const data = res.data?.data || res.data;
        if (!cancelled) {
          setSuggestion({
            systemRoleId: data.systemRoleId || DEFAULT_SYSTEM_ROLE,
            reason: data.reason || null,
            label: data.label || null,
          });
        }
      } catch {
        if (!cancelled) {
          const fallback = inferSystemRoleFromWorkInfo({ department, jobTitle, position });
          setSuggestion({
            systemRoleId: fallback.systemRoleId,
            reason: fallback.reason,
            label: null,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [department, jobTitle, position, enabled, debounceMs]);

  return { suggestion, loading };
};

export default useSuggestedSystemRole;
