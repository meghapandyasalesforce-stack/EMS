import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { createPlatformOrganization } from '../context/platformSlice';

const CreateOrganization = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { plans } = useSelector((state) => state.platform);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
    domain: '',
    subscriptionPlan: 'free',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
  });

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const org = await dispatch(createPlatformOrganization(form)).unwrap();
      toast.success('Organization created');
      navigate(`/platform/organizations/${org.id}`);
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Failed to create organization');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Create organization</h1>
        <p className="mt-1 text-sm text-slate-600">
          Provision a tenant and owner admin account from the control panel.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">Organization</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input required name="name" placeholder="Company name" value={form.name} onChange={onChange} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input required type="email" name="email" placeholder="Org email" value={form.email} onChange={onChange} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="phone" placeholder="Phone" value={form.phone} onChange={onChange} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="domain" placeholder="Domain" value={form.domain} onChange={onChange} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="website" placeholder="Website" value={form.website} onChange={onChange} className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
          <select name="subscriptionPlan" value={form.subscriptionPlan} onChange={onChange} className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2">
            {(plans.length ? plans : [{ id: 'free', name: 'Free' }, { id: 'basic', name: 'Basic' }, { id: 'premium', name: 'Premium' }, { id: 'enterprise', name: 'Enterprise' }]).map((p) => (
              <option key={p.id} value={p.id}>{p.name || p.id}</option>
            ))}
          </select>
        </div>

        <h2 className="pt-2 font-semibold text-slate-900">Owner admin</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input required name="ownerName" placeholder="Owner name" value={form.ownerName} onChange={onChange} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input required type="email" name="ownerEmail" placeholder="Owner email" value={form.ownerEmail} onChange={onChange} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input required type="password" minLength={8} name="ownerPassword" placeholder="Owner password" value={form.ownerPassword} onChange={onChange} className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
        </div>

        <button type="submit" disabled={saving} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
          {saving ? 'Creating…' : 'Create organization'}
        </button>
      </form>
    </div>
  );
};

export default CreateOrganization;
