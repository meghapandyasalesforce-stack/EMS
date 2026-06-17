import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTaxDeclaration, updateTaxDeclaration } from '../../context/employeeDetailsSlice';
import { toast } from 'react-toastify';

const emptyForm = {
  section80C: { ppf: '', lic: '', elss: '', tuitionFees: '', homeLoanPrincipal: '', other: '' },
  section80D: {
    selfFamilyPremium: '',
    parentsPremium: '',
    selfSeniorCitizen: false,
    parentsSeniorCitizen: false
  },
  section80E: { educationLoanInterest: '' },
  section24b: { homeLoanInterest: '' },
  hra: { monthlyRent: '', landlordPan: '', metroCity: false }
};

const TaxDeclaration = () => {
  const dispatch = useDispatch();
  const { employee, taxDeclaration, updatingTaxDeclaration, loadingTaxDeclaration } = useSelector(
    (state) => state.employeeDetails
  );
  const [formData, setFormData] = useState(emptyForm);
  const [isEditing, setIsEditing] = useState(false);

  const taxRegime = (employee?.financialDetails?.taxRegime || 'New').toLowerCase();
  const isOldRegime = taxRegime === 'old' || taxRegime === 'old regime';

  useEffect(() => {
    dispatch(fetchTaxDeclaration());
  }, [dispatch]);

  useEffect(() => {
    if (!taxDeclaration?.taxDeclaration) return;
    const d = taxDeclaration.taxDeclaration;
    setFormData({
      section80C: {
        ppf: d.section80C?.ppf || '',
        lic: d.section80C?.lic || '',
        elss: d.section80C?.elss || '',
        tuitionFees: d.section80C?.tuitionFees || '',
        homeLoanPrincipal: d.section80C?.homeLoanPrincipal || '',
        other: d.section80C?.other || ''
      },
      section80D: {
        selfFamilyPremium: d.section80D?.selfFamilyPremium || '',
        parentsPremium: d.section80D?.parentsPremium || '',
        selfSeniorCitizen: Boolean(d.section80D?.selfSeniorCitizen),
        parentsSeniorCitizen: Boolean(d.section80D?.parentsSeniorCitizen)
      },
      section80E: { educationLoanInterest: d.section80E?.educationLoanInterest || '' },
      section24b: { homeLoanInterest: d.section24b?.homeLoanInterest || '' },
      hra: {
        monthlyRent: d.hra?.monthlyRent || '',
        landlordPan: d.hra?.landlordPan || '',
        metroCity: Boolean(d.hra?.metroCity ?? taxDeclaration?.metroCity)
      }
    });
  }, [taxDeclaration]);

  const handleNestedChange = (section, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await dispatch(updateTaxDeclaration(formData)).unwrap();
      toast.success('Tax declaration saved');
      setIsEditing(false);
    } catch (error) {
      toast.error(error || 'Failed to save tax declaration');
    }
  };

  const renderNumberField = (section, field, label, hint) => (
    <div key={`${section}-${field}`} className="flex flex-col gap-1">
      <label className="text-sm text-gray-700 font-medium">{label}</label>
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
      <input
        type="number"
        min="0"
        name={field}
        value={formData[section][field]}
        onChange={(e) => handleNestedChange(section, field, e.target.value)}
        disabled={!isEditing}
        className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 focus:ring-2 focus:ring-blue-400 focus:outline-none disabled:bg-gray-50"
        placeholder="Annual amount (₹)"
      />
    </div>
  );

  if (loadingTaxDeclaration) {
    return <p className="text-sm text-gray-500">Loading tax declaration...</p>;
  }

  return (
    <div className="mt-8 border-t border-gray-200 pt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Tax declaration (FY {taxDeclaration?.financialYear || '—'})</h3>
          <p className="text-sm text-gray-500 mt-1">
            {isOldRegime
              ? 'Used for TDS under Old regime. PF is included automatically from payroll.'
              : 'You are on New regime — 80C/80D/HRA declarations are not applied to TDS.'}
          </p>
        </div>
        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="bg-theme-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
          >
            {taxDeclaration?.taxDeclaration ? 'Edit' : 'Add declaration'}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Section 80C (annual, excl. PF)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderNumberField('section80C', 'ppf', 'PPF')}
            {renderNumberField('section80C', 'lic', 'LIC premium')}
            {renderNumberField('section80C', 'elss', 'ELSS')}
            {renderNumberField('section80C', 'tuitionFees', 'Tuition fees')}
            {renderNumberField('section80C', 'homeLoanPrincipal', 'Home loan principal')}
            {renderNumberField('section80C', 'other', 'Other 80C')}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Section 80D (annual health insurance)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderNumberField('section80D', 'selfFamilyPremium', 'Self & family premium')}
            {renderNumberField('section80D', 'parentsPremium', 'Parents premium')}
          </div>
          <div className="flex flex-wrap gap-4 mt-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={formData.section80D.selfSeniorCitizen}
                onChange={(e) => handleNestedChange('section80D', 'selfSeniorCitizen', e.target.checked)}
                disabled={!isEditing}
              />
              Self senior citizen
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={formData.section80D.parentsSeniorCitizen}
                onChange={(e) => handleNestedChange('section80D', 'parentsSeniorCitizen', e.target.checked)}
                disabled={!isEditing}
              />
              Parents senior citizen
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderNumberField('section80E', 'educationLoanInterest', 'Section 80E — education loan interest')}
          {renderNumberField('section24b', 'homeLoanInterest', 'Section 24(b) — home loan interest')}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">HRA (Old regime only)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-700 font-medium">Monthly rent paid</label>
              <input
                type="number"
                min="0"
                value={formData.hra.monthlyRent}
                onChange={(e) => handleNestedChange('hra', 'monthlyRent', e.target.value)}
                disabled={!isEditing}
                className="px-4 py-2 rounded-lg border border-gray-300 disabled:bg-gray-50"
                placeholder="₹ per month"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-700 font-medium">Landlord PAN</label>
              <input
                type="text"
                value={formData.hra.landlordPan}
                onChange={(e) => handleNestedChange('hra', 'landlordPan', e.target.value.toUpperCase())}
                disabled={!isEditing}
                className="px-4 py-2 rounded-lg border border-gray-300 disabled:bg-gray-50"
                placeholder="ABCDE1234F"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 mt-3">
            <input
              type="checkbox"
              checked={formData.hra.metroCity}
              onChange={(e) => handleNestedChange('hra', 'metroCity', e.target.checked)}
              disabled={!isEditing}
            />
            Metro city (for HRA calculation)
          </label>
        </div>

        {isEditing && (
          <div className="flex gap-4 pt-2">
            <button
              type="submit"
              disabled={updatingTaxDeclaration}
              className="bg-theme-primary text-white px-6 py-2 rounded-lg font-medium disabled:opacity-60"
            >
              {updatingTaxDeclaration ? 'Saving...' : 'Save declaration'}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="bg-gray-500 text-white px-6 py-2 rounded-lg font-medium"
            >
              Cancel
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default TaxDeclaration;
