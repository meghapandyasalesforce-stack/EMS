import React from 'react';
import { FiDownload, FiEye, FiFileText } from 'react-icons/fi';
import SectionCard from '../SectionCard';
import { formatDate } from '../utils';

const DocumentsTab = ({ employee, onDownload, onView }) => {
  const docs = employee?.documents || [];

  return (
    <SectionCard title={`Documents (${docs.length})`} icon={FiFileText}>
      {docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
          <FiFileText className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-600">No documents uploaded</p>
          <p className="mt-1 text-xs text-slate-500">Employee document uploads appear here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {docs.map((doc, index) => (
            <li
              key={doc._id || index}
              className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">
                  {doc.fileName || doc.originalName || 'Document'}
                </p>
                <p className="text-xs text-slate-500">
                  {doc.documentType || 'File'} · {formatDate(doc.uploadedAt)} ·{' '}
                  {(doc.size ?? doc.fileSize)
                    ? `${((doc.size ?? doc.fileSize) / 1024).toFixed(1)} KB`
                    : '—'}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => onDownload(doc._id, doc.fileName || doc.originalName)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <FiDownload className="h-4 w-4" />
                  Download
                </button>
                {doc.filePath ? (
                  <button
                    type="button"
                    onClick={() => onView(doc)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#20C997] px-3 py-1.5 text-sm font-medium text-white hover:opacity-95"
                  >
                    <FiEye className="h-4 w-4" />
                    View
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
};

export default DocumentsTab;
