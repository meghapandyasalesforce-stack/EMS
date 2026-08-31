import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateFinancialDetails } from '../../context/employeeDetailsSlice';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import TaxDeclaration from './TaxDeclaration';
import { FiDollarSign, FiShield, FiEdit2 } from 'react-icons/fi';

const isNaRegime = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'n/a' || normalized === 'na';
};

const TaxRegimeNaConfirmModal = ({ open, onConfirm, onCancel, saving }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tax-regime-na-title"
      >
        <h2 id="tax-regime-na-title" className="text-lg font-semibold text-slate-900">
          Confirm tax regime N/A
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          Are you sure you want to select N/A in tax regime? This will send a request to HR and Admin
          for approval. Your current tax regime stays unchanged until they approve.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Go back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? 'Submitting...' : 'Yes, send request'}
          </button>
        </div>
      </div>
    </div>
  );
};

const InputField = ({ label, name, value, onChange, required, placeholder }) => (
  <div className="flex flex-col">
    <label htmlFor={name} className="text-xs font-medium text-gray-600 mb-1">
      {label}{' '}
      {required ? (
        <span className="text-red-500">*</span>
      ) : (
        <span className="text-gray-400">(optional)</span>
      )}
    </label>
    <input
      type="text"
      name={name}
      id={name}
      value={value}
      onChange={onChange}
      required={required}
      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition placeholder:text-gray-400"
      placeholder={placeholder || label}
    />
  </div>
);

const DetailItem = ({ label, value }) => (
  <div className="space-y-1">
    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
    <p className="text-sm font-medium text-gray-900">{value || 'N/A'}</p>
  </div>
);

const FinancialDetails = () => {
  const dispatch = useDispatch();
  const { employee, updatingFinancialDetails } = useSelector((state) => state.employeeDetails);

  const [formData, setFormData] = useState({
    bankName: '',
    ifsc: '',
    accountNo: '',
    accountName: '',
    panNumber: '',
    epfUan: '',
    taxRegime: 'New',
    metroCity: false,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNaConfirm, setShowNaConfirm] = useState(false);
  const [pendingNaRequest, setPendingNaRequest] = useState(null);

  const fetchPendingNaRequest = async () => {
    try {
      const response = await axios.get('/v1/both/tax-regime-change/request', {
        withCredentials: true,
      });
      const pending = (response.data?.data || []).find((item) => item.status === 'pending');
      setPendingNaRequest(pending || null);
    } catch {
      setPendingNaRequest(null);
    }
  };

  useEffect(() => {
    if (employee) {
      setFormData({
        bankName: employee.financialDetails?.bankName || '',
        ifsc: employee.financialDetails?.ifsc || '',
        accountNo: employee.financialDetails?.accountNo || '',
        accountName: employee.financialDetails?.accountName || '',
        panNumber: employee.financialDetails?.panNumber || '',
        epfUan: employee.financialDetails?.epfUan || '',
        taxRegime: employee.financialDetails?.taxRegime || 'New',
        metroCity: Boolean(employee.financialDetails?.metroCity),
      });
      setLoading(false);
      fetchPendingNaRequest();
    }
  }, [employee]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const saveFinancialDetails = async () => {
    try {
      const result = await dispatch(updateFinancialDetails(formData)).unwrap();
      if (result?.taxRegimeRequestPending) {
        toast.success(
          result.message ||
            'Financial details saved. Tax regime N/A request sent to HR/Admin for approval.'
        );
        await fetchPendingNaRequest();
      } else {
        toast.success('Financial details updated successfully!');
      }
      setShowNaConfirm(false);
      setIsEditing(false);
    } catch (error) {
      toast.error(error || 'Failed to update financial details');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.bankName || !formData.ifsc || !formData.accountNo || !formData.accountName) {
      toast.error('Please fill in all required fields');
      return;
    }

    const previousRegime = employee?.financialDetails?.taxRegime || 'New';
    const selectingNa = isNaRegime(formData.taxRegime) && !isNaRegime(previousRegime);

    if (selectingNa) {
      setShowNaConfirm(true);
      return;
    }

    await saveFinancialDetails();
  };

  if (loading) {
    return <p className="text-sm text-gray-500">Loading financial details...</p>;
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      {pendingNaRequest && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your request to set tax regime to <strong>N/A (no TDS)</strong> is pending HR/Admin approval.
          Current regime remains <strong>{formData.taxRegime || 'New'}</strong> until approved.
        </div>
      )}

      {isEditing ? (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <FiDollarSign className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Financial Details</h2>
                <p className="text-xs text-gray-500">Update your bank and tax information</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Bank Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Bank Name', name: 'bankName', required: true },
                  { label: 'IFSC Code', name: 'ifsc', required: true },
                  { label: 'Account Number', name: 'accountNo', required: true },
                  { label: 'Account Holder Name', name: 'accountName', required: true },
                ].map((field) => (
                  <InputField key={field.name} {...field} value={formData[field.name]} onChange={handleChange} />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Tax & Statutory</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label="PAN Number" name="panNumber" value={formData.panNumber} onChange={handleChange} required={false} placeholder="e.g. ABCDE1234F" />
                <InputField label="EPF UAN" name="epfUan" value={formData.epfUan} onChange={handleChange} required={false} placeholder="Universal Account Number" />

                <div className="flex flex-col">
                  <label htmlFor="taxRegime" className="text-xs font-medium text-gray-600 mb-1">
                    Tax Regime <span className="text-gray-400">(for payroll TDS)</span>
                  </label>
                  <select
                    name="taxRegime"
                    id="taxRegime"
                    value={formData.taxRegime}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition placeholder:text-gray-400"
                  >
                    <option value="New">New Regime</option>
                    <option value="Old">Old Regime</option>
                    <option value="N/A">N/A (no TDS)</option>
                  </select>
                  {isNaRegime(formData.taxRegime) && !isNaRegime(employee?.financialDetails?.taxRegime) && (
                    <p className="text-xs text-amber-700 mt-1">
                      Selecting N/A will send an approval request to HR/Admin when you save.
                    </p>
                  )}
                </div>
              </div>

              <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="metroCity"
                  checked={formData.metroCity}
                  onChange={handleChange}
                  className="rounded border-gray-300"
                />
                Metro city (used for HRA under Old regime)
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updatingFinancialDetails}
                className="inline-flex items-center gap-1.5 rounded-lg bg-theme-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingFinancialDetails ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          {/* Bank Information Card */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <FiDollarSign className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Bank Information</h3>
                  <p className="text-xs text-gray-500">4 fields</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-theme-primary px-3.5 py-2 text-sm font-medium text-white hover:opacity-90 transition"
              >
                <FiEdit2 className="h-3.5 w-3.5" />
                Edit
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 p-5">
              <DetailItem label="Bank Name" value={formData.bankName} />
              <DetailItem label="IFSC Code" value={formData.ifsc} />
              <DetailItem label="Account Number" value={formData.accountNo ? '••••••••' + formData.accountNo.slice(-4) : null} />
              <DetailItem label="Account Holder Name" value={formData.accountName} />
            </div>
          </div>

          {/* Tax & Statutory Card */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <FiShield className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Tax & Statutory</h3>
                  <p className="text-xs text-gray-500">4 fields</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 p-5">
              <DetailItem label="PAN Number" value={formData.panNumber} />
              <DetailItem label="EPF UAN" value={formData.epfUan} />
              <DetailItem
                label="Tax Regime"
                value={formData.taxRegime === 'N/A' ? 'N/A (no TDS)' : formData.taxRegime || 'N/A'}
              />
              <DetailItem label="Metro City" value={formData.metroCity ? 'Yes' : 'No'} />
            </div>
          </div>
        </>
      )}

      <TaxDeclaration />

      <TaxRegimeNaConfirmModal
        open={showNaConfirm}
        saving={updatingFinancialDetails}
        onCancel={() => setShowNaConfirm(false)}
        onConfirm={saveFinancialDetails}
      />
    </div>
  );
};

export default FinancialDetails;
