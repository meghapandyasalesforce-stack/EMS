import React, { useState, useEffect, useRef } from 'react';
import { FiCreditCard, FiDownload, FiUser, FiCalendar, FiMapPin, FiBriefcase, FiTag } from 'react-icons/fi';
import { toast } from 'react-toastify';
import axios from '../utils/axios';
import html2canvas from 'html2canvas';

const IdCardView = () => {
  const [idCard, setIdCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const cardRef = useRef(null);

  useEffect(() => {
    fetchIdCard();
  }, []);

  const fetchIdCard = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/v1/admin/id-cards/employee/my-card');
      setIdCard(response.data.idCard);
    } catch (error) {
      console.error('Error fetching ID card:', error);
      setError('Failed to fetch ID card');
      if (error.response?.status === 404) {
        setError('No ID card found. Please contact your administrator to generate one.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!idCard || !cardRef.current) return;
    
    try {
      toast.info('Generating ID card image...');
      
      // Create a download-ready card element with inline styles (no Tailwind classes)
      const downloadCard = document.createElement('div');
      downloadCard.style.cssText = `
        width: 400px;
        background: white;
        padding: 20px;
        border-radius: 8px;
        border: 2px solid #e0e0e0;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      `;
      
      const bgColor = idCard.cardDesign?.backgroundColor || '#ffffff';
      const accentColor = idCard.cardDesign?.accentColor || '#1976d2';
      const textColor = idCard.cardDesign?.textColor || '#000000';
      const companyName = idCard.cardDesign?.companyName || 'Paarsiv Technologies';
      const companyAddress = idCard.cardDesign?.companyAddress || 'Employee ID Card';
      
      downloadCard.innerHTML = `
        <div style="background: ${accentColor}; color: white; padding: 15px; text-align: center; border-radius: 6px 6px 0 0;">
          <h3 style="margin: 0; font-size: 18px; font-weight: bold;">${companyName}</h3>
          <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.9;">${companyAddress}</p>
        </div>
        <div style="padding: 20px; background: ${bgColor};">
          <div style="text-align: center; margin-bottom: 15px;">
            <div style="width: 80px; height: 80px; border-radius: 50%; background: #f3f4f6; display: inline-flex; align-items: center; justify-content: center;">
              ${idCard.employeeId?.profilePhoto?.url || idCard.employeeId?.profilePhoto 
                ? `<img src="${idCard.employeeId.profilePhoto.url || idCard.employeeId.profilePhoto}" alt="Photo" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />`
                : '<div style="width: 40px; height: 40px; background: #d1d5db; border-radius: 50%;"></div>'}
            </div>
          </div>
          <div style="text-align: center;">
            <h4 style="margin: 0 0 15px 0; font-size: 20px; font-weight: bold; color: ${textColor};">
              ${idCard.employeeId?.name || ''} ${idCard.employeeId?.lastName || ''}
            </h4>
            <div style="font-size: 14px; color: ${textColor}; line-height: 1.8;">
              <div style="margin: 5px 0;">ID: ${idCard.employeeId?.employeeId || 'N/A'}</div>
              <div style="margin: 5px 0;">${idCard.employeeId?.jobTitle || 'Not Specified'}</div>
              <div style="margin: 5px 0;">${idCard.employeeId?.department || 'Not Specified'}</div>
              ${idCard.employeeId?.phone1 ? `<div style="margin: 5px 0;">Phone: ${idCard.employeeId.phone1}</div>` : ''}
              ${idCard.employeeId?.joiningDate ? `<div style="margin: 5px 0;">Joined: ${new Date(idCard.employeeId.joiningDate).toLocaleDateString()}</div>` : ''}
            </div>
          </div>
          ${idCard.qrCode?.imageUrl ? `
            <div style="text-align: center; margin-top: 15px;">
              <img src="${idCard.qrCode.imageUrl}" alt="QR Code" style="width: 64px; height: 64px;" />
            </div>
          ` : ''}
        </div>
        <div style="background: ${accentColor}; color: white; padding: 10px; text-align: center; font-size: 11px; border-radius: 0 0 6px 6px;">
          Valid until: ${new Date(idCard.expiryDate).toLocaleDateString()}
        </div>
      `;
      
      // Hide it temporarily
      downloadCard.style.position = 'absolute';
      downloadCard.style.left = '-9999px';
      downloadCard.style.top = '0';
      document.body.appendChild(downloadCard);
      
      // Wait for images to load
      const images = downloadCard.querySelectorAll('img');
      if (images.length > 0) {
        await Promise.all(
          Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = resolve; // Continue even if image fails
              setTimeout(resolve, 2000); // Max 2 second wait
            });
          })
        );
      } else {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Use html2canvas to capture
      const canvas = await html2canvas(downloadCard, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
        width: downloadCard.offsetWidth,
        height: downloadCard.offsetHeight,
        onclone: function(clonedDoc) {
          // Ensure all images are loaded in cloned document
          clonedDoc.querySelectorAll('img').forEach(img => {
            if (!img.complete) {
              img.src = img.src; // Force reload
            }
          });
        }
      });
      
      // Remove temporary element
      document.body.removeChild(downloadCard);

      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error('Failed to generate image');
          return;
        }

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `id-card-${idCard.employeeId?.employeeId || idCard.employeeId?.name || 'card'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success('ID card downloaded successfully!');
      }, 'image/png', 0.95);
      
    } catch (error) {
      console.error('Error downloading ID card:', error);
      toast.error('Failed to download ID card');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'text-green-600 bg-green-100',
      expired: 'text-red-600 bg-red-100',
      suspended: 'text-yellow-600 bg-yellow-100',
      cancelled: 'text-gray-600 bg-gray-100'
    };
    return colors[status] || 'text-gray-600 bg-gray-100';
  };

  const isExpired = (expiryDate) => {
    return new Date(expiryDate) < new Date();
  };

  const isExpiringSoon = (expiryDate) => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My ID Card</h1>
          <p className="text-gray-600">View and download your employee identification card</p>
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
                          src={idCard.employeeId.profilePhoto.url || idCard.employeeId.profilePhoto}
                          alt="Employee Photo"
                          className="w-20 h-20 rounded-full object-cover"
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
                  Valid until: {new Date(idCard.expiryDate).toLocaleDateString()}
                </div>
              </div>

              {/* Download Button */}
              <div className="mt-6 text-center">
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                  <span className="text-gray-600">Expiry Date</span>
                  <span className={`text-sm ${
                    isExpired(idCard.expiryDate) 
                      ? 'text-red-600 font-medium' 
                      : isExpiringSoon(idCard.expiryDate)
                      ? 'text-yellow-600 font-medium'
                      : 'text-gray-900'
                  }`}>
                    {new Date(idCard.expiryDate).toLocaleDateString()}
                    {isExpired(idCard.expiryDate) && ' (Expired)'}
                    {isExpiringSoon(idCard.expiryDate) && ' (Expiring Soon)'}
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
