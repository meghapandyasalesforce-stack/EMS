import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCreditCard, FiDownload, FiUser, FiCalendar, FiMapPin, FiBriefcase, FiTag, FiArrowLeft } from 'react-icons/fi';
import { toast } from 'react-toastify';
import axios from '../utils/axios';
import { getUploadUrl } from '../utils/axios';

const IdCardView = () => {
  const [idCard, setIdCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const cardRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchIdCard();
  }, []);

  const fetchIdCard = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/v1/admin/id-cards/employee/my-card');
      setIdCard(response.data.idCard);
    } catch (error) {
      // Removed console.error for production
      setError('Failed to fetch ID card');
      if (error.response?.status === 404) {
        setError('No ID card found. Please contact your administrator to generate one.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!idCard?._id) return;
    
    try {
      toast.info('Generating ID card PDF...');
      const response = await axios.get(`/v1/admin/id-cards/card/${idCard._id}/download`, {
        responseType: 'blob'
      });

      const contentType = response.headers?.['content-type'] || '';
      if (!contentType.includes('application/pdf')) {
        const errorText = await response.data.text();
        let message = 'Failed to download ID card';
        try {
          const parsed = JSON.parse(errorText);
          message = parsed?.message || message;
        } catch {
          // Keep generic message
        }
        toast.error(message);
        return;
      }

      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `id-card-${idCard.employeeId?.employeeId || idCard.cardNumber || 'card'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('ID card downloaded successfully!');
    } catch (error) {
      // Removed console.error for production
      toast.error('Failed to download ID card');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'text-theme-primary bg-theme-primary/10',
      expired: 'text-red-600 bg-red-100',
      suspended: 'text-yellow-600 bg-yellow-100',
      cancelled: 'text-gray-600 bg-gray-100'
    };
    return colors[status] || 'text-gray-600 bg-gray-100';
  };

  // Expiry date functions removed - cards no longer expire

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-theme-secondary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your ID card...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <FiCreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No ID Card Found</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchIdCard}
            className="px-4 py-2 bg-theme-primary text-white rounded-lg hover:opacity-90 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!idCard) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <FiCreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No ID Card Available</h2>
          <p className="text-gray-600">Please contact your administrator to generate an ID card for you.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8" ref={cardRef}>
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              aria-label="Go back"
            >
              <FiArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">My ID Card</h1>
              <p className="text-gray-600 text-sm">View and download your employee identification card</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            className="hidden sm:inline-flex items-center px-4 py-2 bg-theme-primary text-white rounded-lg hover:opacity-90 transition-colors text-sm"
          >
            <FiDownload className="w-4 h-4 mr-2" />
            Download
          </button>
        </div>

        {/* ID Card Display */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Card Preview */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <FiCreditCard className="w-5 h-5 mr-2" />
                ID Card Preview
              </h2>
              
              {/* ID Card Design */}
              <div 
                id="id-card-preview"
                className="w-full max-w-sm mx-auto rounded-lg border-2 shadow-lg overflow-hidden"
                style={{
                  backgroundColor: idCard.cardDesign?.backgroundColor || '#ffffff',
                  borderColor: idCard.cardDesign?.borderColor || '#e0e0e0'
                }}
              >
                {/* Card Header */}
                <div 
                  className="p-4 text-center"
                  style={{
                    backgroundColor: idCard.cardDesign?.accentColor || '#1976d2',
                    color: '#ffffff'
                  }}
                >
                  <h3 className="font-bold text-lg">
                    {idCard.cardDesign?.companyName || 'Paarsiv Technologies'}
                  </h3>
                  <p className="text-sm opacity-90">
                    {idCard.cardDesign?.companyAddress || 'Employee ID Card'}
                  </p>
                </div>

                {/* Card Content */}
                <div className="p-6">
                  {/* Employee Photo */}
                  <div className="flex justify-center mb-4">
                    <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                      {idCard.employeeId?.profilePhoto?.url || idCard.employeeId?.profilePhoto ? (
                        <img
                          src={getUploadUrl(idCard.employeeId.profilePhoto.url || idCard.employeeId.profilePhoto)}
                          alt="Employee Photo"
                          className="w-20 h-20 rounded-full object-cover"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <FiUser className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Employee Details */}
                  <div className="space-y-3 text-center">
                    <h4 
                      className="text-xl font-bold"
                      style={{ color: idCard.cardDesign?.textColor || '#000000' }}
                    >
                      {idCard.employeeId?.name} {idCard.employeeId?.lastName}
                    </h4>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-center">
                        <FiTag className="w-4 h-4 mr-2 text-gray-500" />
                        <span style={{ color: idCard.cardDesign?.textColor || '#000000' }}>
                          ID: {idCard.employeeId?.employeeId}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-center">
                        <FiBriefcase className="w-4 h-4 mr-2 text-gray-500" />
                        <span style={{ color: idCard.cardDesign?.textColor || '#000000' }}>
                          {idCard.employeeId?.jobTitle || 'Not Specified'}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-center">
                        <FiMapPin className="w-4 h-4 mr-2 text-gray-500" />
                        <span style={{ color: idCard.cardDesign?.textColor || '#000000' }}>
                          {idCard.employeeId?.department || 'Not Specified'}
                        </span>
                      </div>

                      {idCard.employeeId?.phone1 && (
                        <div className="flex items-center justify-center">
                          <FiUser className="w-4 h-4 mr-2 text-gray-500" />
                          <span style={{ color: idCard.cardDesign?.textColor || '#000000' }}>
                            {idCard.employeeId.phone1}
                          </span>
                        </div>
                      )}

                      {idCard.employeeId?.joiningDate && (
                        <div className="flex items-center justify-center">
                          <FiCalendar className="w-4 h-4 mr-2 text-gray-500" />
                          <span style={{ color: idCard.cardDesign?.textColor || '#000000' }}>
                            Joined: {new Date(idCard.employeeId.joiningDate).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="flex justify-center mt-4">
                    {idCard.qrCode?.imageUrl && (
                      <img
                        src={idCard.qrCode.imageUrl}
                        alt="QR Code"
                        className="w-16 h-16"
                      />
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div 
                  className="px-4 py-2 text-center text-xs"
                  style={{
                    backgroundColor: idCard.cardDesign?.accentColor || '#1976d2',
                    color: '#ffffff'
                  }}
                >
                  Employee ID Card
                </div>
              </div>

              {/* Download Button */}
              <div className="mt-6 text-center">
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center px-4 py-2 bg-theme-primary text-white rounded-lg hover:opacity-90 transition-colors"
                >
                  <FiDownload className="w-4 h-4 mr-2" />
                  Download ID Card
                </button>
              </div>
            </div>
          </div>

          {/* Card Details */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <FiUser className="w-5 h-5 mr-2" />
                Card Details
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Status</span>
                  <span className={`px-2 py-1 rounded-full text-sm font-medium ${getStatusColor(idCard.status)}`}>
                    {idCard.status.charAt(0).toUpperCase() + idCard.status.slice(1)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Card Number</span>
                  <span className="font-mono text-sm">{idCard.cardNumber}</span>
                </div>
                
                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Issue Date</span>
                  <span className="text-sm">
                    {new Date(idCard.issueDate).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Card Type</span>
                  <span className="text-sm capitalize">{idCard.cardType}</span>
                </div>
                
                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Access Level</span>
                  <span className="text-sm capitalize">{idCard.accessLevel}</span>
                </div>
                
                {idCard.lastUsed && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">Last Used</span>
                    <span className="text-sm">
                      {new Date(idCard.lastUsed).toLocaleDateString()}
                    </span>
                  </div>
                )}
                
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-600">Usage Count</span>
                  <span className="text-sm">{idCard.usageCount || 0}</span>
                </div>
              </div>
            </div>

            {/* Theme Information */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Card Theme</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Template</span>
                  <span className="text-sm capitalize">{idCard.cardDesign?.template || 'Standard'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Background</span>
                  <div className="flex items-center">
                    <div 
                      className="w-4 h-4 rounded border mr-2"
                      style={{ backgroundColor: idCard.cardDesign?.backgroundColor || '#ffffff' }}
                    ></div>
                    <span className="text-sm font-mono">
                      {idCard.cardDesign?.backgroundColor || '#ffffff'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Text Color</span>
                  <div className="flex items-center">
                    <div 
                      className="w-4 h-4 rounded border mr-2"
                      style={{ backgroundColor: idCard.cardDesign?.textColor || '#000000' }}
                    ></div>
                    <span className="text-sm font-mono">
                      {idCard.cardDesign?.textColor || '#000000'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdCardView;
