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
        const blob = response.data;
        const contentType = String(response.headers?.['content-type'] || blob?.type || '');
        if (
            contentType.includes('application/json') ||
            (blob instanceof Blob && blob.type === 'application/json')
        ) {
            const text = await blob.text();
            let message = 'Export failed';
            try {
                const parsed = JSON.parse(text);
                message = parsed?.message || message;
            } catch {
                /* keep default */
            }
            const err = new Error(message);
            err.response = { data: { message } };
            throw err;
        }
        const csvBlob = new Blob([blob], { type: 'text/csv;charset=utf-8;' });
        const objectUrl = URL.createObjectURL(csvBlob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
    } catch (error) {
        if (error?.response?.data instanceof Blob) {
            try {
                const text = await error.response.data.text();
                const parsed = JSON.parse(text);
                error.response.data = parsed;
            } catch {
                /* keep blob */
            }
        }
        if (onError) onError(error);
        throw error;
    }
};
