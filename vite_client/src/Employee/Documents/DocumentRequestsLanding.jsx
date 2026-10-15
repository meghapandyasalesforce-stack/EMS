import React, { useEffect, useMemo, useState } from 'react';
import { FaClipboardList, FaFileAlt } from 'react-icons/fa';
import axios from '../../utils/axios';
import { BOTH_DOCUMENT_TEMPLATES_ENDPOINT } from '../../utils/constant';
import EmployeeDocumentRequests from './EmployeeDocumentRequests';
import SelfServiceDocuments from './SelfServiceDocuments';

/**
 * Landing page for Employee Document Requests.
 * Tabs filtered by org settings (enableDocumentRequests / enableSelfServiceDocuments).
 */
export default function DocumentRequestsLanding({ mode = 'employee' }) {
  const [activeTab, setActiveTab] = useState('request');
  const [modeSettings, setModeSettings] = useState({
    enableDocumentRequests: true,
    enableSelfServiceDocuments: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${BOTH_DOCUMENT_TEMPLATES_ENDPOINT}/mode-settings`, {
          withCredentials: true,
        });
        if (cancelled) return;
        setModeSettings({
          enableDocumentRequests: data?.data?.enableDocumentRequests !== false,
          enableSelfServiceDocuments: data?.data?.enableSelfServiceDocuments !== false,
        });
      } catch {
        // Keep both enabled on failure
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tabs = useMemo(() => {
    const all = [
      {
        key: 'request',
        label: 'Raise a Request',
        icon: FaClipboardList,
        description: 'Request documents from HR with approval',
        enabled: modeSettings.enableDocumentRequests,
      },
      {
        key: 'self-service',
        label: 'Self-Service',
        icon: FaFileAlt,
        description: 'Generate documents instantly from templates',
        enabled: modeSettings.enableSelfServiceDocuments,
      },
    ];
    return all.filter((tab) => tab.enabled);
  }, [modeSettings]);

  useEffect(() => {
    if (!tabs.length) return;
    if (!tabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(tabs[0].key);
    }
  }, [tabs, activeTab]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50 to-white p-3 sm:p-4 lg:p-6">
      <div className="mx-auto max-w-[1200px] space-y-5">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-white via-white to-[#20C997]/5 px-5 py-5 sm:px-6 sm:py-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#20C997]">
              Employee Documents
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Documents Center
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
              Request official letters from HR or generate approved templates yourself in a few steps.
            </p>
          </div>

          {tabs.length > 0 && (
            <div className="flex flex-col gap-2 p-3 sm:flex-row sm:gap-2 sm:p-4">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex flex-1 items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      isActive
                        ? 'border-[#20C997]/35 bg-[#20C997]/8 shadow-sm'
                        : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        isActive ? 'bg-[#20C997] text-white' : 'bg-white text-slate-400 ring-1 ring-slate-200'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-sm font-semibold ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
                        {tab.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-slate-500">{tab.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          {tabs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-700">Document options are disabled</p>
              <p className="mt-1 text-sm text-slate-500">
                Please contact your administrator to enable Raise a Request or Self-Service.
              </p>
            </div>
          ) : (
            <>
              {activeTab === 'request' && modeSettings.enableDocumentRequests && (
                <EmployeeDocumentRequests mode={mode} />
              )}
              {activeTab === 'self-service' && modeSettings.enableSelfServiceDocuments && (
                <SelfServiceDocuments />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
