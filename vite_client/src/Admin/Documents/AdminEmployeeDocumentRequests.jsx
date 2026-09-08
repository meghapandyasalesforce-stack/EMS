import React from 'react';
import EmployeeDocumentRequests from '../../Employee/Documents/EmployeeDocumentRequests';

/** Admin document-request queue (employee letter/certificate requests). */
export default function AdminEmployeeDocumentRequests() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
      <EmployeeDocumentRequests mode="admin" />
    </div>
  );
}
