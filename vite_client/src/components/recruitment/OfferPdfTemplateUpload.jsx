import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { FaUpload } from 'react-icons/fa';
import axios from '../../utils/axios';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import { CmButton } from '../corporateModern';

const OfferPdfTemplateUpload = ({ onUploaded, onClose }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        if (!file) {
            toast.error('Select a PDF file');
            return;
        }
        if (!name.trim()) {
            toast.error('Template name is required');
            return;
        }
        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('pdf', file);
            formData.append('name', name.trim());
            if (description.trim()) formData.append('description', description.trim());

            const { data } = await axios.post(
                `${ADMIN_LIFECYCLE_ENDPOINT}/offers/templates/pdf/upload`,
                formData,
                { withCredentials: true, headers: { 'Content-Type': 'multipart/form-data' } },
            );
            if (!data.success) throw new Error(data.message);
            toast.success(data.message || 'PDF template uploaded');
            onUploaded?.(data.data, data.meta);
            onClose?.();
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
                <h3 className="mb-4 text-lg font-semibold">Upload PDF Template</h3>
                <p className="mb-4 text-sm text-gray-600">
                    Upload your company offer letter PDF (from Word/Google Docs). Fields will be detected automatically — you only verify once.
                </p>
                <form onSubmit={submit} className="space-y-4">
                    <label className="block text-sm">
                        Template name
                        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" required />
                    </label>
                    <label className="block text-sm">
                        Description (optional)
                        <input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
                    </label>
                    <label className="block text-sm">
                        PDF file (max 10 MB)
                        <input
                            type="file"
                            accept="application/pdf,.pdf"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                            className="mt-1 w-full text-sm"
                            required
                        />
                    </label>
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
                        <CmButton type="submit" disabled={uploading}>
                            <FaUpload className="text-xs" /> {uploading ? 'Uploading...' : 'Upload PDF'}
                        </CmButton>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default OfferPdfTemplateUpload;
