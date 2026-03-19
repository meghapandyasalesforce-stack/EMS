import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FaDownload, FaFileCsv, FaFileAlt } from 'react-icons/fa';
import { exportToCSV, exportToJSON, exportDashboardStats } from '../utils/exportUtils';

/**
 * Export Button Component
 * Provides dropdown menu for exporting data in different formats
 */
const ExportButton = ({ data, filename, type = 'data', columns = null }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleExport = (format) => {
    if (type === 'stats') {
      exportDashboardStats(data, filename);
    } else if (format === 'csv') {
      exportToCSV(data, filename, columns);
    } else if (format === 'json') {
      exportToJSON(data, filename);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-theme-primary text-white rounded-lg hover:opacity-90 transition-colors"
      >
        <FaDownload className="w-4 h-4" />
        <span>Export</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-20 border border-gray-200">
            <div className="py-1">
              <button
                onClick={() => handleExport('csv')}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <FaFileCsv className="w-4 h-4 text-theme-primary" />
                Export as CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <FaFileAlt className="w-4 h-4 text-theme-secondary" />
                Export as JSON
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

ExportButton.propTypes = {
  data: PropTypes.oneOfType([PropTypes.array, PropTypes.object]).isRequired,
  filename: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['data', 'stats']),
  columns: PropTypes.array,
};

export default ExportButton;

