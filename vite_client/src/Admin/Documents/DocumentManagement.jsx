import React, { useEffect, useMemo, useState } from 'react';
import { FaClipboardList, FaLayerGroup } from 'react-icons/fa';
import DocumentTemplateManager from './DocumentTemplateManager';
import AdminEmployeeDocumentRequests from './AdminEmployeeDocumentRequests';
import HREmployeeDocumentRequests from '../../HR/Documents/HREmployeeDocumentRequests';
import useAuthPermissions from '../../Hooks/useAuthPermissions';
import useDocumentModeSettings from '../../Hooks/useDocumentModeSettings';

/**
 * Document Management — Requests queue + Templates.
 * HR sees the HR approval queue; org owners/admins see the admin queue.
 */
const DocumentManagement = () => {
  const [activeSection, setActiveSection] = useState('requests');
  const { isOrgOwner } = useAuthPermissions();
  const useAdminQueue = Boolean(isOrgOwner);
  const { enableDocumentRequests, enableSelfServiceDocuments, ready } = useDocumentModeSettings();

  const tabs = useMemo(() => {
    const all = [
      {
        key: 'requests',
        label: 'Document Requests',
        hint: 'Review & approve',
        icon: FaClipboardList,
        enabled: enableDocumentRequests,
      },
      {
        key: 'templates',
        label: 'Document Templates',
        hint: 'Self-service setup',
        icon: FaLayerGroup,
        enabled: enableSelfServiceDocuments,
      },
    ];
    return all.filter((tab) => tab.enabled);
  }, [enableDocumentRequests, enableSelfServiceDocuments]);

  useEffect(() => {
    if (!ready || !tabs.length) return;
    if (!tabs.some((tab) => tab.key === activeSection)) {
      setActiveSection(tabs[0].key);
    }
  }, [ready, tabs, activeSection]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50 to-white">
      <div className="border-b border-slate-200/80 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#20C997]">
              Documents
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.65rem]">
              Document Management
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-slate-500">
              Review employee document requests and manage self-service templates in one place.
            </p>
          </div>

          {tabs.length > 0 ? (
          <div className="flex w-full gap-1 rounded-2xl border border-slate-200 bg-slate-100/80 p-1.5 sm:w-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeSection === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveSection(tab.key)}
                  className={`flex flex-1 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left transition sm:flex-none sm:min-w-[170px] ${
                    active
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                      : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      active ? 'bg-[#20C997]/12 text-[#20C997]' : 'bg-slate-200/70 text-slate-500'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-tight">{tab.label}</span>
                    <span className="mt-0.5 block text-[10px] font-medium text-slate-400">{tab.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-[1600px]">
        {ready && tabs.length === 0 ? (
          <div className="px-4 py-10 text-sm text-slate-500 sm:px-6">
            Document requests and self-service documents are turned off in settings.
          </div>
        ) : null}
        {ready && activeSection === 'requests' && enableDocumentRequests && (
          useAdminQueue ? <AdminEmployeeDocumentRequests /> : <HREmployeeDocumentRequests />
        )}
        {ready && activeSection === 'templates' && enableSelfServiceDocuments && <DocumentTemplateManager />}
      </div>
    </div>
  );
};

export default DocumentManagement;
