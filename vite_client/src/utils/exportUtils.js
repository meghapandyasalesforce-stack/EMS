import { format } from 'date-fns';

/**
 * Utility functions for exporting dashboard data
 */

/**
 * Export data to CSV
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Filename for the exported file
 * @param {Array} columns - Column definitions [{ key, label }]
 */
export const exportToCSV = (data, filename = 'export', columns = null) => {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Auto-detect columns if not provided
  if (!columns) {
    const firstRow = data[0];
    columns = Object.keys(firstRow).map(key => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')
    }));
  }

  // Create CSV header
  const header = columns.map(col => col.label).join(',');

  // Create CSV rows
  const rows = data.map(row => {
    return columns.map(col => {
      const value = row[col.key];
      // Handle nested objects and arrays
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') {
        if (Array.isArray(value)) return value.join('; ');
        return JSON.stringify(value);
      }
      // Escape commas and quotes
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',');
  });

  // Combine header and rows
  const csvContent = [header, ...rows].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

/**
 * Export data to JSON
 * @param {Array|Object} data - Data to export
 * @param {string} filename - Filename for the exported file
 */
export const exportToJSON = (data, filename = 'export') => {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.json`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

/**
 * Export data to Excel (using CSV format, can be opened in Excel)
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Filename for the exported file
 * @param {Array} columns - Column definitions
 */
export const exportToExcel = (data, filename = 'export', columns = null) => {
  // Excel can open CSV files, so we use CSV format
  exportToCSV(data, filename, columns);
};

/**
 * Export dashboard statistics
 * @param {Object} stats - Dashboard statistics object
 * @param {string} dashboardType - Type of dashboard (admin, hr, etc.)
 */
export const exportDashboardStats = (stats, dashboardType = 'dashboard') => {
  // Convert stats object to array format
  const data = Object.entries(stats).map(([key, value]) => ({
    Metric: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
    Value: typeof value === 'object' ? JSON.stringify(value) : value
  }));

  exportToCSV(data, `${dashboardType}_stats`, [
    { key: 'Metric', label: 'Metric' },
    { key: 'Value', label: 'Value' }
  ]);
};

export default {
  exportToCSV,
  exportToJSON,
  exportToExcel,
  exportDashboardStats,
};

