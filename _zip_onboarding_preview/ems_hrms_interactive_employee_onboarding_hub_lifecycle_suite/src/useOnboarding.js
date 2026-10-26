import { useEffect, useRef, useState } from 'react';
import { initialCandidates } from './data.js';

const defaultFilters = { status: 'ALL', dept: 'ALL', location: 'ALL' };

export function useOnboarding() {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(defaultFilters);
  const [tab, switchTab] = useState('onboarding');
  const [modal, setModal] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState('');
  const [page, changePage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [forceEmpty, setForceEmpty] = useState(false);
  const [selected, setSelected] = useState([]);
  const [menu, setMenu] = useState(null);
  const [actionCandidate, setActionCandidate] = useState(null);
  const toastTimer = useRef();
  const loadingTimer = useRef();

  useEffect(() => {
    const dismiss = () => setMenu(null);
    const escape = event => {
      if (event.key === 'Escape') { setModal(null); setDrawer(false); setMenu(null); }
    };
    document.addEventListener('click', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('click', dismiss);
      document.removeEventListener('keydown', escape);
      clearTimeout(toastTimer.current);
      clearTimeout(loadingTimer.current);
    };
  }, []);

  const filtered = forceEmpty ? [] : candidates.filter(item =>
    [item.name, item.role, item.id, item.email].some(value => value.toLowerCase().includes(search.toLowerCase())) &&
    Object.entries(filters).every(([key, value]) => value === 'ALL' || item[key] === value)
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 6));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * 6, currentPage * 6);
  function setPage(value) { changePage(Math.max(1, Math.min(value, totalPages))); }
  function triggerToast(message) {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  }
  function handleSearch(value) { setSearch(value); setForceEmpty(false); changePage(1); }
  function updateFilter(key, value) { setFilters(previous => ({ ...previous, [key]: value })); setForceEmpty(false); changePage(1); }
  function resetFilters() {
    setSearch(''); setFilters(defaultFilters); setForceEmpty(false); setLoading(false); changePage(1);
    clearTimeout(loadingTimer.current);
  }
  function openModal(id) { setModal(id); setMenu(null); }
  function closeModal() { setModal(null); }
  function openDrawer() { setActionCandidate(candidates[0] ?? null); setDrawer(true); }
  function openCandidateDrawer(id) { setActionCandidate(candidates.find(item => item.id === id)); setDrawer(true); setMenu(null); }
  function promptPause(id) { setActionCandidate(candidates.find(item => item.id === id)); openModal('pause-modal'); }
  function promptDelete(id) { setActionCandidate(candidates.find(item => item.id === id)); openModal('delete-modal'); }
  function confirmPauseWorkflow() {
    if (!actionCandidate) return triggerToast('Select a candidate from the roster first');
    setCandidates(previous => previous.map(item => item.id === actionCandidate.id ? { ...item, status: 'Paused' } : item));
    closeModal(); triggerToast('Onboarding paused');
  }
  function confirmDeleteWorkflow() {
    if (!actionCandidate) return triggerToast('Select a candidate from the roster first');
    setCandidates(previous => previous.filter(item => item.id !== actionCandidate.id));
    setSelected(previous => previous.filter(id => id !== actionCandidate.id));
    closeModal(); setActionCandidate(null); triggerToast('Candidate record removed');
  }
  function handleCreateSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const [name, dept, id, role] = form.querySelector('#new-hire-select').value.split('|');
    if (!name) return;
    if (candidates.some(item => item.id === id)) return triggerToast('This candidate already has an onboarding record');
    const joining = new Date(`${form.querySelector('input[type="date"]').value}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const buddy = form.querySelectorAll('select')[2].value.replace(/ \(.*/, '');
    const manager = form.querySelector('input[type="text"]').value;
    setCandidates(previous => [{ id, name, dept, role, email: `${name.toLowerCase().replaceAll(' ', '.')}@talent.net`, location: 'Bengaluru HQ', joining, buddy, manager, progressPct: 10, tasksDone: 2, tasksTotal: 20, bgvStatus: 'Initiated', status: 'Pre-Boarding', img: '' }, ...previous]);
    form.reset(); closeModal(); switchTab('onboarding'); resetFilters(); triggerToast(`Onboarding initialized for ${name}`);
  }
  function setSimState(state) {
    resetFilters(); switchTab('onboarding');
    if (state === 'filtered') setFilters({ ...defaultFilters, status: 'Day 1 Ready' });
    if (state === 'empty') setForceEmpty(true);
    if (state === 'skeleton') {
      setLoading(true);
      loadingTimer.current = setTimeout(() => setLoading(false), 1600);
    }
  }
  function toggleSelected(id) { setSelected(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]); }
  function toggleSelectAll(checked) {
    setSelected(previous => checked ? [...new Set([...previous, ...pageItems.map(item => item.id)])] : previous.filter(id => !pageItems.some(item => item.id === id)));
  }
  return { candidates, search, filters, tab, modal, drawer, toast, page: currentPage, totalPages, filtered, pageItems, loading, selected, menu, setMenu, actionCandidate, handleSearch, updateFilter, resetFilters, switchTab, openModal, closeModal, openDrawer, closeDrawer: () => setDrawer(false), openCandidateDrawer, setPage, prevPage: () => setPage(currentPage - 1), nextPage: () => setPage(currentPage + 1), promptPause, promptDelete, confirmPauseWorkflow, confirmDeleteWorkflow, handleCreateSubmit, setSimState, triggerToast, toggleSelectAll, toggleSelected };
}
