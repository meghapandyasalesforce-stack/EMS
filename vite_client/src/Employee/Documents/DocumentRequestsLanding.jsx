import React, { useState } from 'react';
import { FaClipboardList, FaFileAlt } from 'react-icons/fa';
import EmployeeDocumentRequests from './EmployeeDocumentRequests';
import SelfServiceDocuments from './SelfServiceDocuments';

/**
 * Landing page for Employee Document Requests.
 * Presents two options as tabs:
 *   - Option 1: Raise a Request (existing flow — unchanged)
 *   - Option 2: Self-Service (generate from predefined template — no approval required)
 *
 * Both tabs are available to ALL employee-side users regardless of role.
 * When mode is 'admin' or 'hr', the "Raise a Request" tab shows the management view.
 */
export default function DocumentRequestsLanding({ mode = 'employee' }) {
  const [activeTab, setActiveTab] = useState('request');

  const tabs = [
    { key: 'request', label: 'Raise a Request', icon: FaClipboardList, description: 'Request documents from HR' },
    { key: 'self-service', label: 'Self-Service', icon: FaFileAlt, description: 'Generate documents instantly' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-4 lg:p-6">
      <div className="space-y-5">

        {/* Header + Tabs */}
        <div className="rounded-2xl bg-white shadow-sm">
          <div className="px-6 pt-6 pb-0">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Employee Documents</h1>
            <p className="mt-1 text-sm text-slate-500">
              Request or generate official documents from your organization
            </p>
          </div>

          {/* Tab selector */}
          <div className="mt-4 flex border-b border-slate-100">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative flex items-center gap-1.5 px-3 py-3 text-xs font-medium transition sm:gap-2 sm:px-5 sm:text-sm ${
                    isActive ? 'text-[#20C997]' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-[#20C997]' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                  <span className="hidden text-[10px] font-normal text-slate-400 sm:inline">— {tab.description}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[#20C997]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'request' && (
            <EmployeeDocumentRequests mode={mode} />
          )}
          {activeTab === 'self-service' && (
            <SelfServiceDocuments />
          )}
        </div>
      </div>
    </div>
  );
}
