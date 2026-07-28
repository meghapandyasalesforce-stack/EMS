import React, { useCallback, useEffect, useState } from 'react';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { FaDownload, FaFileAlt } from 'react-icons/fa';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import LoadingSpinner from '../../components/LoadingSpinner';

const OffboardingLettersPanel = ({ workflowId }) => {
    const [loading, setLoading] = useState(true);
    const [letters, setLetters] = useState([]);

    const load = useCallback(async () => {
        if (!workflowId) return;
        try {
            setLoading(true);
            const { data } = await axios.get(
                `${ADMIN_LIFECYCLE_ENDPOINT}/offboarding/${workflowId}/letters/generated`,
                { withCredentials: true },
            );
            setLetters(data.data || []);
        } catch {
            setLetters([]);
        } finally {
            setLoading(false);
        }
    }, [workflowId]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingSpinner message="Loading letters..." />;

    if (!letters.length) {
        return (
            <p className="text-sm text-gray-500">
                No auto-generated letters yet. Letters are created when offboarding completes (if templates are published).
            </p>
        );
    }

    return (
        <div className="space-y-2">
            {letters.map((letter) => (
                <div key={letter._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                        <FaFileAlt className="text-theme-secondary" />
                        <div>
                            <p className="font-medium text-sm">{letter.title || letter.letterType}</p>
                            <p className="text-xs text-gray-500">
                                {letter.status} · {letter.createdAt ? format(new Date(letter.createdAt), 'MMM dd, yyyy') : ''}
                            </p>
                        </div>
                    </div>
                    {letter.pdfUrl && (
                        <a href={letter.pdfUrl} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-theme-primary underline">
                            <FaDownload /> Download
                        </a>
                    )}
                </div>
            ))}
        </div>
    );
};

export default OffboardingLettersPanel;
