import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { canAccessHrDocuments } from '../../utils/managerHelper';
import {
  FiCreditCard,
  FiDownload,
  FiEye,
  FiTrash2,
  FiSearch,
  FiCheckCircle,
  FiXCircle,
  FiUsers,

  FiRotateCcw,
  FiShield,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { downloadPdfBlob } from '../../utils/downloadPdfBlob';
import ProfilePicture from '../../Shared/ProfilePicture';
import PaarsivIdCard, { PAARSIV_ID } from '../../components/PaarsivIdCard';
import '../../styles/idCardsStudioUI.css';

const MINT = '#0e9370';
const MINT_DARK = '#00694f';
const MINT_GRADIENT = `linear-gradient(165deg, #0e2b3d 0%, #134056 100%)`;
const PRIMARY_GRADIENT = `linear-gradient(135deg, ${MINT} 0%, ${MINT_DARK} 100%)`;

/** Single brand template — physical Paarsiv badge look */
const themePresets = {
  paarsiv: {
    name: 'Paarsiv',
    backgroundColor: PAARSIV_ID.white,
    textColor: PAARSIV_ID.charcoal,
    accentColor: PAARSIV_ID.green,
    borderColor: PAARSIV_ID.border,
    headerGradient: `linear-gradient(135deg, ${PAARSIV_ID.green} 0%, ${PAARSIV_ID.charcoal} 100%)`,
  },
};

const CARD_STATUSES = ['active', 'expired', 'suspended', 'cancelled'];

/** ID card record status only (not employee employment status). */
const getCardStatus = (card) => {
  const raw = card?.status;
  if (raw && CARD_STATUSES.includes(String(raw))) return String(raw);
  return 'active';
};

const getCardStatusLabel = (status) => {
  const labels = {
    active: 'Active',
    cancelled: 'Deactivated',
    expired: 'Expired',
    suspended: 'Suspended',
  };
  return labels[status] || status;
};

const KpiStat = ({ label, value, icon: Icon }) => (
  <div className="idc-studio__kpi">
    <div>
      <p className="idc-studio__kpi-label">{label}</p>
      <p className="idc-studio__kpi-value">{value}</p>
    </div>
    <span className="idc-studio__kpi-icon" aria-hidden>
      <Icon className="h-5 w-5" />
    </span>
  </div>
);

const IdCardMiniPreview = ({ card }) => {
  const employee = card.employeeId || {};

  return (
    <div className="transition-transform duration-300 group-hover:scale-[1.02]">
      <PaarsivIdCard
        size="mini"
        name={employee.name}
        lastName={employee.lastName}
        jobTitle={employee.position || employee.jobTitle || 'Employee'}
        employeeId={employee.employeeId}
        cardNumber={card.cardNumber}
        profilePhoto={employee.profilePhoto || employee.profilePicture}
        userId={employee._id || employee.id}
      />
    </div>
  );
};

const IdCardGenerator = () => {
  const user = useSelector((state) => state.auth.user);
  const employee = useSelector((state) => state.employeeDetails.employee);
  const permissionFlags = useSelector((state) => state.auth.permissionFlags) || {};
  const isHrUser = canAccessHrDocuments(user, employee, permissionFlags);

  const [idCards, setIdCards] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ status: '', cardType: '' });

  const [generateForm, setGenerateForm] = useState({
    employeeId: '',
    cardDesign: { template: 'paarsiv' },
  });

  const buildGeneratePayload = useCallback(() => {
    const themeKey = generateForm.cardDesign?.template || 'paarsiv';
    const theme = themePresets[themeKey] || themePresets.paarsiv;
    return {
      employeeId: generateForm.employeeId,
      cardType: 'employee',
      accessLevel: 'basic',
      accessZones: [],
      cardDesign: {
        template: themeKey === 'paarsiv' ? 'standard' : themeKey,
        backgroundColor: theme.backgroundColor,
        textColor: theme.textColor,
        companyName: 'paarsiv',
        companyAddress: PAARSIV_ID.website,
      },
    };
  }, [generateForm]);

  const fetchIdCards = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.cardType) params.append('cardType', filters.cardType);
      const response = await axios.get(`/v1/admin/id-cards?${params}`, { withCredentials: true });
      const cardsData = response.data?.data || response.data || [];
      setIdCards(Array.isArray(cardsData) ? cardsData : []);
    } catch {
      toast.error('Failed to fetch ID cards');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchEmployees = async () => {
    try {
      setEmployeesLoading(true);
      const allEmployees = [];
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 20) {
        const response = await axios.get('/v1/employee/auth/get-all-employees', {
          params: { page, limit: 100 },
          withCredentials: true,
        });
        const body = response.data;
        const batch = Array.isArray(body)
          ? body
          : Array.isArray(body?.data)
            ? body.data
            : Array.isArray(body?.employees)
              ? body.employees
              : [];

        allEmployees.push(...batch);

        const pagination = body?.pagination;
        hasMore = pagination?.hasNext === true || (batch.length === 100 && !pagination);
        page += 1;
      }

      setEmployees(allEmployees);
    } catch {
      toast.error('Failed to fetch employees');
      setEmployees([]);
    } finally {
      setEmployeesLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchIdCards();
  }, [fetchIdCards]);

  const stats = useMemo(() => {
    const list = Array.isArray(idCards) ? idCards : [];
    return {
      total: list.length,
      active: list.filter((c) => getCardStatus(c) === 'active').length,
      deactivated: list.filter((c) => getCardStatus(c) === 'cancelled').length,
      employees: new Set(list.map((c) => c.employeeId?._id || c.employeeId).filter(Boolean)).size,
    };
  }, [idCards]);

  const employeesEligibleForCard = useMemo(() => {
    const withActiveCard = new Set(
      idCards
        .filter((c) => getCardStatus(c) === 'active')
        .map((c) => String(c.employeeId?._id || c.employeeId || ''))
        .filter(Boolean)
    );
    return employees.filter((e) => e._id && !withActiveCard.has(String(e._id)));
  }, [employees, idCards]);

  const filteredCards = useMemo(() => {
    let list = Array.isArray(idCards) ? [...idCards] : [];

    if (filters.status) {
      list = list.filter((card) => getCardStatus(card) === filters.status);
    }
    if (filters.cardType) {
      list = list.filter((card) => card.cardType === filters.cardType);
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;

    return list.filter((card) => {
      const emp = card.employeeId || {};
      const cardStatus = getCardStatus(card);
      const haystack = [
        card.cardNumber,
        emp.name,
        emp.lastName,
        emp.employeeId,
        emp.department,
        card.cardType,
        cardStatus,
        getCardStatusLabel(cardStatus),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [idCards, searchQuery, filters.status, filters.cardType]);

  const handleGenerateCard = async (e) => {
    e.preventDefault();
    if (!generateForm.employeeId) {
      toast.error('Please select an employee');
      return;
    }
    try {
      await axios.post('/v1/admin/id-cards/generate', buildGeneratePayload(), {
        withCredentials: true,
      });
      toast.success('ID card generated successfully');
      setShowGenerateModal(false);
      resetGenerateForm();
      fetchIdCards();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to generate ID card');
    }
  };

  const handleDownloadCard = async (cardId) => {
    try {
      toast.info('Preparing ID card PDF…');
      const response = await axios.get(`/v1/admin/id-cards/card/${cardId}/download`, {
        responseType: 'blob',
        withCredentials: true,
      });
      const contentType = response.headers?.['content-type'] || '';
      if (!contentType.includes('application/pdf')) {
        const errorText = await response.data.text();
        let message = 'Failed to download ID card';
        try {
          const parsed = JSON.parse(errorText);
          message = parsed?.message || message;
        } catch {
          /* keep default */
        }
        toast.error(message);
        return;
      }
      const method = await downloadPdfBlob(response.data, `id-card-${cardId}.pdf`);
      if (method === 'share-cancelled') return;
      if (method === 'open') {
        toast.success('ID card opened — use Share/Save in the browser to keep a copy');
      } else if (method === 'share') {
        toast.success('ID card ready to save or share');
      } else {
        toast.success('ID card downloaded successfully');
      }
    } catch (error) {
      let message = 'Failed to download ID card';
      try {
        const data = error.response?.data;
        if (data instanceof Blob) {
          const text = await data.text();
          message = JSON.parse(text)?.message || message;
        } else if (data?.message) {
          message = data.message;
        }
      } catch {
        /* keep default */
      }
      toast.error(message);
    }
  };

  const handleDeactivateCard = async (cardId) => {
    if (!window.confirm('Deactivate this ID card?')) return;
    try {
      await axios.put(
        `/v1/admin/id-cards/card/${cardId}`,
        { status: 'cancelled' },
        { withCredentials: true }
      );
      toast.success('ID card deactivated');
      fetchIdCards();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to deactivate ID card');
    }
  };

  const handleReactivateCard = async (cardId) => {
    if (!window.confirm('Reactivate this ID card?')) return;
    try {
      await axios.put(
        `/v1/admin/id-cards/card/${cardId}`,
        { status: 'active' },
        { withCredentials: true }
      );
      toast.success('ID card reactivated');
      fetchIdCards();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reactivate ID card');
    }
  };

  const resetGenerateForm = () => {
    setGenerateForm({
      employeeId: '',
      cardDesign: { template: 'paarsiv' },
    });
  };

  if (!isHrUser) {
    return <Navigate to="/employee/documents-id" replace />;
  }

  if (loading) {
    return (
      <div className="idc-studio__loading">
        <div className="idc-studio__spinner" aria-hidden />
        <p className="text-sm font-medium">Loading ID cards…</p>
      </div>
    );
  }

  return (
    <div className="idc-studio">
      <div className="idc-studio__inner">
        <header className="idc-studio__header">
          <div>
            <div className="idc-studio__badges">
              <span className="idc-studio__pill idc-studio__pill--mint">Security domain</span>
              <span className="idc-studio__pill idc-studio__pill--ghost">
                <FiShield size={12} /> ISO 27001 Certified Access Suite
              </span>
            </div>
            <h1 className="idc-studio__title">ID Cards Studio &amp; Badge Issuance</h1>
            <p className="idc-studio__sub">
              Issue and manage employee credentials on the official Paarsiv badge template.
            </p>
          </div>
          <div className="idc-studio__actions">
            <label className="idc-studio__search">
              <FiSearch size={16} />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, EMP ID, or card…"
              />
            </label>
            <select
              className="idc-studio__filter-sm"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              aria-label="Status"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="cancelled">Deactivated</option>
              <option value="expired">Expired</option>
              <option value="suspended">Suspended</option>
            </select>
            <select
              className="idc-studio__filter-sm"
              value={filters.cardType}
              onChange={(e) => setFilters({ ...filters, cardType: e.target.value })}
              aria-label="Card type"
            >
              <option value="">All Types</option>
              <option value="employee">Employee</option>
              <option value="visitor">Visitor</option>
              <option value="contractor">Contractor</option>
              <option value="temporary">Temporary</option>
            </select>
          </div>
        </header>

        <div className="idc-studio__kpis">
          <KpiStat label="Total Cards" value={stats.total} icon={FiCreditCard} />
          <KpiStat label="Active" value={stats.active} icon={FiCheckCircle} />
          <KpiStat label="Deactivated" value={stats.deactivated} icon={FiXCircle} />
          <KpiStat label="Employees" value={stats.employees} icon={FiUsers} />
        </div>

        <section className="idc-studio__panel">
          <div className="idc-studio__panel-head">
            <h2 className="idc-studio__panel-title">Issued badges ({filteredCards.length})</h2>
            <p className="idc-studio__panel-sub">Preview, download, or deactivate generated cards</p>
          </div>

          <div className="idc-studio__panel-body">
            {filteredCards.length === 0 ? (
              <div className="idc-studio__empty">
                <span className="idc-studio__empty-icon" aria-hidden>
                  <FiCreditCard />
                </span>
                <h3>No ID cards found</h3>
                <p>
                  {searchQuery || filters.status || filters.cardType
                    ? 'Try adjusting your search or filters.'
                    : 'No employee ID cards have been issued yet.'}
                </p>
              </div>
            ) : (
              <div className="idc-studio__grid">
                {filteredCards.map((card) => {
                  const emp = card.employeeId || {};
                  const cardStatus = getCardStatus(card);
                  return (
                    <article key={card._id} className="idc-studio__card">
                      <div className="idc-studio__card-preview">
                        <IdCardMiniPreview card={card} />
                      </div>

                      <div className="idc-studio__card-meta">
                        <div className="idc-studio__card-person">
                          <ProfilePicture user={emp} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="idc-studio__card-person-name">
                              {emp.name} {emp.lastName}
                            </p>
                            <p className="idc-studio__card-person-id">{emp.employeeId || '—'}</p>
                          </div>
                        </div>

                        <div className="idc-studio__tags">
                          <span className={`idc-studio__tag idc-studio__tag--${cardStatus}`}>
                            {getCardStatusLabel(cardStatus)}
                          </span>
                          <span className="idc-studio__tag idc-studio__tag--type">
                            {card.cardType}
                          </span>
                        </div>

                        <p className="idc-studio__card-number">{card.cardNumber}</p>

                        <div className="idc-studio__card-actions">
                          <button
                            type="button"
                            className="idc-studio__icon-btn"
                            onClick={() => {
                              setSelectedCard(card);
                              setShowPreviewModal(true);
                            }}
                            title="Preview"
                            aria-label="Preview ID card"
                          >
                            <FiEye size={16} />
                          </button>
                          <button
                            type="button"
                            className="idc-studio__icon-btn"
                            onClick={() => handleDownloadCard(card._id)}
                            title="Download"
                            aria-label="Download ID card PDF"
                          >
                            <FiDownload size={16} />
                          </button>
                          {cardStatus === 'active' ? (
                            <button
                              type="button"
                              className="idc-studio__icon-btn idc-studio__icon-btn--danger"
                              onClick={() => handleDeactivateCard(card._id)}
                              title="Deactivate"
                            >
                              <FiTrash2 size={16} />
                            </button>
                          ) : cardStatus === 'cancelled' ? (
                            <button
                              type="button"
                              className="idc-studio__icon-btn"
                              onClick={() => handleReactivateCard(card._id)}
                              title="Reactivate"
                            >
                              <FiRotateCcw size={16} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {showGenerateModal && (
        <GenerateModal
          formData={generateForm}
          setFormData={setGenerateForm}
          onSubmit={handleGenerateCard}
          onClose={() => {
            setShowGenerateModal(false);
            resetGenerateForm();
          }}
          employees={employeesEligibleForCard}
          employeesLoading={employeesLoading}
        />
      )}

      {showPreviewModal && selectedCard && (
        <PreviewModal
          card={selectedCard}
          onClose={() => {
            setShowPreviewModal(false);
            setSelectedCard(null);
          }}
          onDownload={() => handleDownloadCard(selectedCard._id)}
        />
      )}
    </div>
  );
};

const GenerateModal = ({ formData, setFormData, onSubmit, onClose, employees, employeesLoading }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
    <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
      <div className="flex items-center justify-between px-6 py-5 text-white" style={{ background: MINT_GRADIENT }}>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white/20 p-2.5">
            <FiCreditCard className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Generate ID Card</h3>
            <p className="text-sm text-white/80">Create a new card for an employee</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/20" aria-label="Close">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Select Employee</label>
          <select
            value={formData.employeeId}
            onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#0e9370] focus:ring-2 focus:ring-[#0e9370]/20"
            required
          >
            <option value="">Choose an employee...</option>
            {employeesLoading ? (
              <option disabled>Loading...</option>
            ) : employees.length === 0 ? (
              <option disabled>All employees already have ID cards</option>
            ) : (
              employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.name} {employee.lastName} — {employee.employeeId} ({employee.department || '—'})
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="mb-3 block text-sm font-semibold text-slate-700">Card Design</label>
          <div className="rounded-2xl border-2 border-[#0e9370] bg-[#e8faf4] p-4 shadow-md">
            <div className="mb-3 flex justify-center">
              <PaarsivIdCard
                size="mini"
                name="Clara"
                lastName="Jenkins"
                jobTitle="Senior Analyst"
                employeeId="EMP-2026-0001"
              />
            </div>
            <p className="text-center text-sm font-medium text-slate-800">Paarsiv Official Badge</p>
            <p className="mt-1 text-center text-xs text-slate-500">
              Official template — layout unchanged
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-md"
            style={{ background: PRIMARY_GRADIENT }}
          >
            Generate ID Card
          </button>
        </div>
      </form>
    </div>
  </div>
);

const PreviewModal = ({ card, onClose, onDownload }) => {
  const emp = card.employeeId || {};
  const cardStatus = getCardStatus(card);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-center justify-between px-5 py-3.5 text-white" style={{ background: MINT_GRADIENT }}>
          <div className="flex items-center gap-2.5">
            <FiEye className="h-5 w-5" />
            <div>
              <h3 className="text-base font-bold">ID Card Preview</h3>
              <p className="text-[11px] text-white/80">{card.cardNumber}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-white/20" aria-label="Close">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          <div className="mb-4 flex justify-center rounded-xl bg-[#e8faf4] py-4">
            <PaarsivIdCard
              size="preview"
              name={emp.name}
              lastName={emp.lastName}
              jobTitle={emp.position || emp.jobTitle || 'Employee'}
              employeeId={emp.employeeId}
              cardNumber={card.cardNumber}
              profilePhoto={emp.profilePhoto || emp.profilePicture}
              userId={emp._id || emp.id}
            />
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2.5">
            {[
              ['Card Number', card.cardNumber],
              ['Type', card.cardType],
              ['Status', getCardStatusLabel(cardStatus)],
              ['Issued', card.issueDate ? new Date(card.issueDate).toLocaleDateString() : '—'],
            ].map(([label, val]) => (
              <div key={label} className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-[11px] text-slate-500">{label}</p>
                <p className="text-sm font-semibold capitalize text-slate-900">{val}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: PRIMARY_GRADIENT }}
            >
              <FiDownload className="h-4 w-4" />
              Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdCardGenerator;

