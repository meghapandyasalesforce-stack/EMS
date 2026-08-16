import axios from '../../utils/axios';

export const sanitizeFilenamePart = (value) =>
    String(value || 'export')
        .trim()
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 80) || 'export';

export const exportFilename = (prefix, { part } = {}) => {
    const date = new Date().toISOString().slice(0, 10);
    if (part) return `${prefix}-${sanitizeFilenamePart(part)}-${date}.csv`;
    return `${prefix}-${date}.csv`;
};

export const downloadEngagementExport = async (url, filename, { onError, params } = {}) => {
    try {
        const response = await axios.get(url, {
            withCredentials: true,
            responseType: 'blob',
            params,
        });
        const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(link.href);
    } catch (error) {
        if (onError) onError(error);
        throw error;
    }
};
