import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateFinancialDetails } from '../../context/employeeDetailsSlice';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import TaxDeclaration from './TaxDeclaration';

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
    <div className="w-full min-w-0">
      <div className="w-full rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 md:p-6 shadow-sm">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-5 sm:mb-6 text-left">Financial Details</h2>

        {pendingNaRequest && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your request to set tax regime to <strong>N/A (no TDS)</strong> is pending HR/Admin approval.
            Current regime remains <strong>{formData.taxRegime || 'New'}</strong> until approved.
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="hrms-form-grid">
            {[
              { label: 'Bank Name', name: 'bankName', required: true },
              { label: 'IFSC Code', name: 'ifsc', required: true },
              { label: 'Account Number', name: 'accountNo', required: true },
              { label: 'Account Holder Name', name: 'accountName', required: true },
              { label: 'PAN Number', name: 'panNumber', required: false, placeholder: 'e.g. ABCDE1234F' },
              { label: 'EPF UAN', name: 'epfUan', required: false, placeholder: 'Universal Account Number' },
            ].map(({ label, name, required, placeholder }) => (
              <div key={name} className="flex flex-col gap-1">
                <label htmlFor={name} className="text-sm text-gray-700 font-medium">
                  {label}{' '}
                  {required ? (
                    <span className="text-red-500">*</span>
                  ) : (
                    <span className="text-gray-400 text-xs">(optional)</span>
                  )}
                </label>
                <input
                  type="text"
                  name={name}
                  id={name}
                  value={formData[name]}
                  onChange={handleChange}
                  required={required}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  placeholder={placeholder || label}
                />
              </div>
            ))}
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="taxRegime" className="text-sm text-gray-700 font-medium">
                Tax Regime <span className="text-gray-400 text-xs">(for payroll TDS)</span>
              </label>
              <select
                name="taxRegime"
                id="taxRegime"
                value={formData.taxRegime}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 focus:ring-2 focus:ring-blue-400 focus:outline-none"
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

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="metroCity"
                checked={formData.metroCity}
                onChange={handleChange}
              />
              Metro city (used for HRA under Old regime)
            </label>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={updatingFinancialDetails}
                className={`${
                  updatingFinancialDetails
                    ? 'bg-green-400 cursor-not-allowed'
                    : 'bg-theme-primary hover:bg-theme-primary'
                } text-white px-6 py-2 rounded-lg font-medium transition`}
              >
                {updatingFinancialDetails ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="bg-gray-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-600 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="w-full rounded-xl border border-slate-100 bg-slate-50 p-4 sm:p-6">
            <h3 className="text-lg font-semibold mb-4">Bank Information</h3>
            <div className="hrms-form-grid text-sm">
              <p>
                <strong>Bank Name:</strong> {formData.bankName || 'N/A'}
              </p>
              <p>
                <strong>IFSC:</strong> {formData.ifsc || 'N/A'}
              </p>
              <p>
                <strong>Account No:</strong>{' '}
                {formData.accountNo ? '••••••••' + formData.accountNo.slice(-4) : 'N/A'}
              </p>
              <p>
                <strong>Account Name:</strong> {formData.accountName || 'N/A'}
              </p>
            </div>
            <h3 className="text-lg font-semibold mb-4 mt-6">Tax & statutory</h3>
            <p className="mb-2">
              <strong>PAN Number:</strong> {formData.panNumber || 'N/A'}
            </p>
            <p className="mb-2">
              <strong>EPF UAN:</strong> {formData.epfUan || 'N/A'}
            </p>
            <p className="mb-2">
              <strong>Tax Regime:</strong>{' '}
              {formData.taxRegime === 'N/A'
                ? 'N/A (no TDS)'
                : formData.taxRegime || 'N/A'}
            </p>
            <p className="mb-4">
              <strong>Metro city:</strong> {formData.metroCity ? 'Yes' : 'No'}
            </p>
            <button
              onClick={() => setIsEditing(true)}
              className="mt-4 bg-theme-primary text-white px-4 py-2 rounded hover:opacity-90 transition"
            >
              Edit
            </button>
          </div>
        )}

        <TaxDeclaration />
      </div>

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
