import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
  FiBriefcase,
  FiMail,
  FiPhone,
  FiGlobe,
  FiUser,
  FiLock,
  FiCopy,
  FiRefreshCw,
  FiCheck,
  FiLayers,
  FiUsers,
  FiArrowLeft,
  FiLink,
} from 'react-icons/fi';
import { createPlatformOrganization } from '../context/platformSlice';
import '../styles/platformCreateOrg.css';

const FALLBACK_PLANS = [
  { id: 'free', name: 'Free', price: 0, maxEmployees: 10 },
  { id: 'basic', name: 'Basic', price: 49, maxEmployees: 50 },
  { id: 'premium', name: 'Premium', price: 149, maxEmployees: 200 },
  { id: 'enterprise', name: 'Enterprise', price: 499, maxEmployees: 1000 },
];

const INDUSTRY_OPTIONS = [
  { value: 'technology', label: 'Technology & SaaS' },
  { value: 'fintech', label: 'Fintech & Banking' },
  { value: 'healthcare', label: 'Healthcare & Life Sciences' },
  { value: 'education', label: 'Education' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'retail', label: 'Retail & E-commerce' },
  { value: 'logistics', label: 'Logistics & Supply Chain' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'government', label: 'Government & Public Sector' },
  { value: 'media', label: 'Media & Entertainment' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'energy', label: 'Energy & Utilities' },
  { value: 'nonprofit', label: 'Non-profit' },
  { value: 'hospitality', label: 'Hospitality & Travel' },
  { value: 'telecom', label: 'Telecommunications' },
  { value: 'other', label: 'Other' },
];

const makePassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
};

const slugifyDomain = (value = '') =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const formatPrice = (price) => {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return 'Free';
  return `$${n.toLocaleString()}/mo`;
};

const CreateOrganization = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { plans } = useSelector((state) => state.platform);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [industry, setIndustry] = useState('');
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

  const planList = useMemo(() => {
    if (Array.isArray(plans) && plans.length) {
      return plans.map((p) => ({
        id: p.id || p.planId,
        name: p.name || p.id || p.planId,
        price: p.price ?? 0,
        maxEmployees: p.maxEmployees ?? null,
      }));
    }
    return FALLBACK_PLANS;
  }, [plans]);

  useEffect(() => {
    if (planList[0]?.id && !planList.some((p) => p.id === form.subscriptionPlan)) {
      setForm((f) => ({ ...f, subscriptionPlan: planList[0].id }));
    }
  }, [planList, form.subscriptionPlan]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: value };
      if (name === 'name' && (!f.domain || f.domain === slugifyDomain(f.name))) {
        next.domain = slugifyDomain(value);
      }
      return next;
    });
  };

  const generatePassword = () => {
    setForm((f) => ({ ...f, ownerPassword: makePassword() }));
    setCopied(false);
  };

  const copyPassword = async () => {
    if (!form.ownerPassword) return;
    try {
      await navigator.clipboard.writeText(form.ownerPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy password');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const org = await dispatch(
        createPlatformOrganization({
          name: form.name,
          email: form.email,
          phone: form.phone,
          website: form.website,
          domain: form.domain,
          subscriptionPlan: form.subscriptionPlan,
          ownerName: form.ownerName,
          ownerEmail: form.ownerEmail,
          ownerPassword: form.ownerPassword,
        })
      ).unwrap();
      toast.success('Organization created');
      navigate(`/platform/organizations/${org.id}`);
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Failed to create organization');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="platform-create-org flex flex-col gap-5">
      <header>
        <nav aria-label="Breadcrumbs" className="pc-crumb">
          <Link to="/platform/organizations">Organizations</Link>
          <span className="pc-crumb-sep" aria-hidden>
            /
          </span>
          <span className="pc-crumb-current">Create</span>
        </nav>
        <h1 className="pc-title">Create Organization</h1>
        <p className="pc-subtitle">Add a new tenant and its owner admin account.</p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <section className="pc-section">
          <div className="pc-section-head">
            <div className="pc-step-icon">
              <FiBriefcase className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <div className="pc-step-label">Step 1</div>
              <h2 className="pc-step-title">Organization details</h2>
            </div>
          </div>

          <div className="pc-panel pc-grid">
            <div>
              <label className="pc-label" htmlFor="create-org-name">
                <span>
                  Organization name <span className="pc-req">*</span>
                </span>
              </label>
              <div className="pc-field">
                <FiBriefcase className="pc-field-icon h-4 w-4" aria-hidden />
                <input
                  id="create-org-name"
                  required
                  name="name"
                  placeholder="Acme Corp"
                  value={form.name}
                  onChange={onChange}
                  className="pc-input has-icon"
                />
              </div>
            </div>

            <div>
              <label className="pc-label" htmlFor="create-org-email">
                <span>
                  Organization email <span className="pc-req">*</span>
                </span>
              </label>
              <div className="pc-field">
                <FiMail className="pc-field-icon h-4 w-4" aria-hidden />
                <input
                  id="create-org-email"
                  required
                  type="email"
                  name="email"
                  placeholder="ops@acmecorp.com"
                  value={form.email}
                  onChange={onChange}
                  className="pc-input has-icon"
                />
              </div>
            </div>

            <div>
              <label className="pc-label" htmlFor="create-org-phone">
                Phone
              </label>
              <div className="pc-field">
                <FiPhone className="pc-field-icon h-4 w-4" aria-hidden />
                <input
                  id="create-org-phone"
                  name="phone"
                  placeholder="+1 555 000 0000"
                  value={form.phone}
                  onChange={onChange}
                  className="pc-input has-icon"
                />
              </div>
            </div>

            <div>
              <label className="pc-label" htmlFor="create-org-domain">
                Domain
              </label>
              <div className="pc-field">
                <FiLink className="pc-field-icon h-4 w-4" aria-hidden />
                <input
                  id="create-org-domain"
                  name="domain"
                  placeholder="acme-corp"
                  value={form.domain}
                  onChange={onChange}
                  className="pc-input has-icon"
                />
              </div>
            </div>

            <div>
              <label className="pc-label" htmlFor="create-org-website">
                Website
              </label>
              <div className="pc-field">
                <FiGlobe className="pc-field-icon h-4 w-4" aria-hidden />
                <input
                  id="create-org-website"
                  name="website"
                  placeholder="https://acmecorp.com"
                  value={form.website}
                  onChange={onChange}
                  className="pc-input has-icon"
                />
              </div>
            </div>

            <div>
              <label className="pc-label" htmlFor="create-org-industry">
                Industry sector
              </label>
              <select
                id="create-org-industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="pc-select"
              >
                <option value="">Select industry</option>
                {INDUSTRY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="pc-section">
          <div className="pc-section-head">
            <div className="pc-step-icon">
              <FiLayers className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <div className="pc-step-label">Step 2</div>
              <h2 className="pc-step-title">Choose a plan</h2>
            </div>
          </div>

          <div className="pc-plans">
            {planList.map((plan) => {
              const selected = form.subscriptionPlan === plan.id;
              return (
                <label key={plan.id} className={`pc-plan ${selected ? 'is-selected' : ''}`}>
                  <div className="pc-plan-top">
                    <span className="pc-plan-name">{plan.name}</span>
                    <input
                      type="radio"
                      name="subscriptionPlan"
                      value={plan.id}
                      checked={selected}
                      onChange={onChange}
                      className="pc-plan-radio"
                    />
                  </div>
                  <div className="pc-plan-price">{formatPrice(plan.price)}</div>
                  <div className="pc-plan-meta">
                    <FiUsers className="h-4 w-4" aria-hidden />
                    {plan.maxEmployees != null
                      ? `Up to ${Number(plan.maxEmployees).toLocaleString()} seats`
                      : 'Seat limit by plan'}
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        <section className="pc-section">
          <div className="pc-section-head">
            <div className="pc-step-icon">
              <FiUser className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <div className="pc-step-label">Step 3</div>
              <h2 className="pc-step-title">Owner admin</h2>
            </div>
          </div>

          <div className="pc-panel pc-grid">
            <div>
              <label className="pc-label" htmlFor="create-owner-name">
                <span>
                  Full name <span className="pc-req">*</span>
                </span>
              </label>
              <div className="pc-field">
                <FiUser className="pc-field-icon h-4 w-4" aria-hidden />
                <input
                  id="create-owner-name"
                  required
                  name="ownerName"
                  placeholder="Jane Admin"
                  value={form.ownerName}
                  onChange={onChange}
                  className="pc-input has-icon"
                />
              </div>
            </div>

            <div>
              <label className="pc-label" htmlFor="create-owner-email">
                <span>
                  Admin email <span className="pc-req">*</span>
                </span>
              </label>
              <div className="pc-field">
                <FiMail className="pc-field-icon h-4 w-4" aria-hidden />
                <input
                  id="create-owner-email"
                  required
                  type="email"
                  name="ownerEmail"
                  placeholder="admin@acmecorp.com"
                  value={form.ownerEmail}
                  onChange={onChange}
                  className="pc-input has-icon"
                />
              </div>
            </div>

            <div className="pc-grid-full">
              <label className="pc-label" htmlFor="create-owner-password">
                <span>
                  Password <span className="pc-req">*</span>
                </span>
                <button type="button" onClick={generatePassword} className="pc-gen-btn">
                  <FiRefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Generate
                </button>
              </label>
              <div className="pc-field">
                <FiLock className="pc-field-icon h-4 w-4" aria-hidden />
                <input
                  id="create-owner-password"
                  required
                  type="text"
                  minLength={8}
                  name="ownerPassword"
                  placeholder="At least 8 characters"
                  value={form.ownerPassword}
                  onChange={onChange}
                  className="pc-input has-icon"
                  autoComplete="new-password"
                  style={{ paddingRight: '5.5rem' }}
                />
                <button
                  type="button"
                  onClick={copyPassword}
                  className={`pc-copy-btn ${copied ? 'is-copied' : ''}`}
                >
                  {copied ? <FiCheck className="h-3 w-3" /> : <FiCopy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="pc-actions">
          <Link to="/platform/organizations" className="pc-btn pc-btn-secondary">
            <FiArrowLeft className="h-4 w-4" aria-hidden />
            Cancel
          </Link>
          <button type="submit" disabled={saving} className="pc-btn pc-btn-primary">
            <FiCheck className="h-4 w-4" aria-hidden />
            {saving ? 'Creating…' : 'Create organization'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateOrganization;
