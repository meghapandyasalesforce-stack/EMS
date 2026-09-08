// import React, { useState } from 'react';
// import { FaFileAlt, FaFolderOpen, FaArrowLeft, FaClipboardList, FaLayerGroup } from 'react-icons/fa';
// import DocumentTemplateManager from './DocumentTemplateManager';
// import AdminEmployeeDocumentRequests from './AdminEmployeeDocumentRequests';

// /**
//  * Document Management — single page for Admin/HR Manager.
//  * Shows two sections: Document Templates and Document Requests.
//  * Clicking either shows that section inline with navigation.
//  */
// export default function DocumentManagement() {
//   const [activeSection, setActiveSection] = useState(null); // null | 'templates' | 'requests'

//   // Main landing — two option cards
//   if (!activeSection) {
//     return (
//       <div className="min-h-screen bg-slate-50 p-3 sm:p-5 lg:p-8">
//         <div className="mx-auto max-w-3xl space-y-8">
//           {/* Header */}
//           <div className="text-center">
//             <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Document Management</h1>
//             <p className="mt-2 text-sm text-slate-500 sm:text-base">
//               Manage document templates and employee document requests
//             </p>
//           </div>

//           {/* Option Cards */}
//           <div className="grid gap-6 sm:grid-cols-2">
//             {/* Document Requests */}
//             <button
//               onClick={() => setActiveSection('requests')}
//               className="group relative overflow-hidden rounded-2xl bg-white p-7 text-left shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 sm:p-8"
//             >
//               <div className="absolute right-0 top-0 h-24 w-24 -translate-y-4 translate-x-4 rounded-full bg-blue-50 opacity-60 transition group-hover:opacity-100" />
//               <div className="relative">
//                 <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 transition group-hover:bg-blue-200">
//                   <FaClipboardList className="h-5 w-5 text-blue-600" />
//                 </div>
//                 <h2 className="mt-5 text-lg font-semibold text-slate-900">Document Requests</h2>
//                 <p className="mt-2 text-sm leading-relaxed text-slate-500">
//                   Review and manage employee document requests. Approve, reject, upload documents, and track status.
//                 </p>
//                 <div className="mt-5 flex items-center gap-1.5 text-xs font-medium text-blue-600 transition group-hover:gap-2.5">
//                   <span>Open Requests</span>
//                   <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
//                 </div>
//               </div>
//             </button>

//             {/* Document Templates */}
//             <button
//               onClick={() => setActiveSection('templates')}
//               className="group relative overflow-hidden rounded-2xl bg-white p-7 text-left shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 sm:p-8"
//             >
//               <div className="absolute right-0 top-0 h-24 w-24 -translate-y-4 translate-x-4 rounded-full bg-emerald-50 opacity-60 transition group-hover:opacity-100" />
//               <div className="relative">
//                 <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 transition group-hover:bg-emerald-200">
//                   <FaLayerGroup className="h-5 w-5 text-emerald-600" />
//                 </div>
//                 <h2 className="mt-5 text-lg font-semibold text-slate-900">Document Templates</h2>
//                 <p className="mt-2 text-sm leading-relaxed text-slate-500">
//                   Create and manage predefined templates for employee self-service document generation.
//                 </p>
//                 <div className="mt-5 flex items-center gap-1.5 text-xs font-medium text-emerald-600 transition group-hover:gap-2.5">
//                   <span>Manage Templates</span>
//                   <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
//                 </div>
//               </div>
//             </button>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   // Section view with sticky navigation bar
//   return (
//     <div className="min-h-screen bg-slate-50">
//       {/* Sticky nav bar */}
//       <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
//         <div className="flex items-center gap-4 px-3 py-3 sm:px-5">
//           <button
//             onClick={() => setActiveSection(null)}
//             className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:border-slate-300"
//           >
//             <FaArrowLeft className="h-3 w-3" />
//             <span className="hidden sm:inline">Back</span>
//           </button>
//           <div className="h-4 w-px bg-slate-200" />
//           <h2 className="text-sm font-semibold text-slate-900">
//             {activeSection === 'templates' ? 'Document Templates' : 'Document Requests'}
//           </h2>

//           {/* Section switcher */}
//           <div className="ml-auto hidden sm:flex items-center gap-1 rounded-lg bg-slate-100 p-1">
//             <button
//               onClick={() => setActiveSection('requests')}
//               className={`rounded-md px-3 py-1 text-xs font-medium transition ${activeSection === 'requests' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
//             >
//               Requests
//             </button>
//             <button
//               onClick={() => setActiveSection('templates')}
//               className={`rounded-md px-3 py-1 text-xs font-medium transition ${activeSection === 'templates' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
//             >
//               Templates
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* Content */}
//       <div className="pt-2">
//         {activeSection === 'templates' && <DocumentTemplateManager />}
//         {activeSection === 'requests' && <AdminEmployeeDocumentRequests />}
//       </div>
//     </div>
//   );
// }

import React, { useState } from 'react';
import DocumentTemplateManager from './DocumentTemplateManager';
import AdminEmployeeDocumentRequests from './AdminEmployeeDocumentRequests';
import HREmployeeDocumentRequests from '../../HR/Documents/HREmployeeDocumentRequests';
import useAuthPermissions from '../../Hooks/useAuthPermissions';

/**
 * Document Management — Requests queue + Templates.
 * HR sees the HR approval queue; org owners/admins see the admin queue.
 */
const DocumentManagement = () => {
    const [activeSection, setActiveSection] = useState('requests');
    const { isOrgOwner } = useAuthPermissions();
    const useAdminQueue = Boolean(isOrgOwner);

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                            Document Management
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Review employee document requests and manage templates
                        </p>
                    </div>

                    <div className="flex w-full items-center rounded-lg bg-slate-100 p-1 sm:w-auto">
                        <button
                            type="button"
                            onClick={() => setActiveSection('requests')}
                            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition sm:flex-none ${
                                activeSection === 'requests'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            Document Requests
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveSection('templates')}
                            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition sm:flex-none ${
                                activeSection === 'templates'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            Document Templates
                        </button>
                    </div>
                </div>
            </div>

            <div>
                {activeSection === 'requests' && (
                    useAdminQueue ? <AdminEmployeeDocumentRequests /> : <HREmployeeDocumentRequests />
                )}
                {activeSection === 'templates' && <DocumentTemplateManager />}
            </div>
        </div>
    );
};

export default DocumentManagement;