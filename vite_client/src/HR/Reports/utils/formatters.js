export const formatCurrency = (amount) => {
    if (!amount || Number.isNaN(Number(amount))) return '₹0';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

export const formatCompactCurrency = (amount) => {
    const n = Number(amount) || 0;
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return formatCurrency(n);
};

export const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

export const formatPercent = (value, decimals = 1) => {
    const n = Number(value);
    if (Number.isNaN(n)) return '0%';
    return `${n.toFixed(decimals)}%`;
};
