import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaFileAlt } from 'react-icons/fa';
import { FiToggleLeft, FiToggleRight, FiSave } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { fetchOrganizationProfile, updateOrganizationSettings } from '../../context/organizationSlice';

/**
 * Admin Settings → Document Settings
 * Controls employee document modes: Raise a Request and/or Self-Service.
 */
const DocumentSettings = () => {
  const dispatch = useDispatch();
  const { profile, loading } = useSelector((state) => state.organization);
  const [settings, setSettings] = useState({
    enableDocumentRequests: true,
    enableSelfServiceDocuments: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    dispatch(fetchOrganizationProfile());
  }, [dispatch]);

  useEffect(() => {
    if (profile?.settings) {
      setSettings({
        enableDocumentRequests: profile.settings.enableDocumentRequests !== false,
        enableSelfServiceDocuments: profile.settings.enableSelfServiceDocuments !== false,
      });
    }
  }, [profile]);

  const toggle = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await dispatch(
        updateOrganizationSettings({
          enableDocumentRequests: settings.enableDocumentRequests,
          enableSelfServiceDocuments: settings.enableSelfServiceDocuments,
        })
      ).unwrap();
      toast.success('Document settings saved successfully');
      dispatch(fetchOrganizationProfile());
    } catch (error) {
      toast.error(error || 'Failed to save document settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading && !profile) {
    return (
      <div className="p-6">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-theme-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 md:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center text-xl font-bold text-gray-800 sm:text-2xl">
            <FaFileAlt className="mr-2 text-[var(--color-primary)]" />
            Document Management Settings
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Choose how employees access documents for your organization
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          <FiSave className="mr-2" />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
          <div className="flex-1 pr-3">
            <h3 className="text-base font-medium text-gray-800">Enable Document Requests</h3>
            <p className="mt-1 text-sm text-gray-500">
              Allow employees to raise document requests for HR/Admin approval
            </p>
          </div>
          <button type="button" onClick={() => toggle('enableDocumentRequests')} className="ml-2 shrink-0">
            {settings.enableDocumentRequests ? (
              <FiToggleRight className="h-6 w-12 text-theme-primary" />
            ) : (
              <FiToggleLeft className="h-6 w-12 text-gray-400" />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
          <div className="flex-1 pr-3">
            <h3 className="text-base font-medium text-gray-800">Enable Self-Service Documents</h3>
            <p className="mt-1 text-sm text-gray-500">
              Allow employees to generate documents instantly from templates
            </p>
          </div>
          <button type="button" onClick={() => toggle('enableSelfServiceDocuments')} className="ml-2 shrink-0">
            {settings.enableSelfServiceDocuments ? (
              <FiToggleRight className="h-6 w-12 text-theme-primary" />
            ) : (
              <FiToggleLeft className="h-6 w-12 text-gray-400" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentSettings;
