import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateFinancialDetails } from '../../context/employeeDetailsSlice';
import { toast } from 'react-toastify';
import TaxDeclaration from './TaxDeclaration';

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
    }
  }, [employee]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.bankName || !formData.ifsc || !formData.accountNo || !formData.accountName) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await dispatch(updateFinancialDetails(formData)).unwrap();
      toast.success('Financial details updated successfully!');
      setIsEditing(false);
    } catch (error) {
      toast.error(error || 'Failed to update financial details');
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500">Loading financial details...</p>;
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen transition-all duration-300">
      <div className="max-w-3xl mx-auto bg-white p-6 md:p-8 rounded-2xl shadow-md">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Financial Details</h2>

        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-5">
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
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  placeholder={placeholder || label}
                />
              </div>
            ))}

            <div className="flex flex-col gap-1">
              <label htmlFor="taxRegime" className="text-sm text-gray-700 font-medium">
                Tax Regime <span className="text-gray-400 text-xs">(for payroll TDS)</span>
              </label>
              <select
                name="taxRegime"
                id="taxRegime"
                value={formData.taxRegime}
                onChange={handleChange}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 focus:ring-2 focus:ring-blue-400 focus:outline-none"
              >
                <option value="New">New Regime</option>
                <option value="Old">Old Regime</option>
                <option value="N/A">N/A (no TDS)</option>
              </select>
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
          <div className="bg-white p-6 rounded-xl shadow-lg max-w-md mx-auto">
            <h3 className="text-lg font-semibold mb-4">Bank Information</h3>
            <p className="mb-2">
              <strong>Bank Name:</strong> {formData.bankName || 'N/A'}
            </p>
            <p className="mb-2">
              <strong>IFSC:</strong> {formData.ifsc || 'N/A'}
            </p>
            <p className="mb-2">
              <strong>Account No:</strong>{' '}
              {formData.accountNo ? '••••••••' + formData.accountNo.slice(-4) : 'N/A'}
            </p>
            <p className="mb-4">
              <strong>Account Name:</strong> {formData.accountName || 'N/A'}
            </p>
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
              className="bg-theme-primary text-white px-4 py-2 rounded hover:opacity-90 transition"
            >
              Edit
            </button>
          </div>
        )}

        <TaxDeclaration />
      </div>
    </div>
  );
};

export default FinancialDetails;
