/**
 * Read a selected File into an attachment payload for recruitment APIs.
 * Max 5MB — PDF / DOC / DOCX / images / plain text.
 */
export async function fileToAttachment(file, { maxBytes = 5 * 1024 * 1024 } = {}) {
    if (!file) return null;
    if (file.size > maxBytes) {
        throw new Error('File must be 5MB or smaller');
    }
    const url = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
    return {
        url,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
    };
}

export const COVER_LETTER_ACCEPT = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg';
