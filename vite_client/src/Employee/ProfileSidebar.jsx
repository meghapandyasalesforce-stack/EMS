import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMenu, FiX } from 'react-icons/fi';

const ProfileSidebar = ({ activeSection, onSectionClick }) => {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
      if (window.innerWidth >= 1024) {
        setIsOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sections = [
    'Personal Details',
    'Contact Details',
    'Education Qualifications',
    'Family Details',
    'Documents',
    'Financial Details',
  ];

  const handleSectionClick = (section) => {
    onSectionClick(section);
    if (isMobile) {
      setIsOpen(false); // Close menu after selection on mobile
    }
    switch (section) {
      case 'Contact Details':
        navigate('/contact-details');
        break;
      case 'Personal Details':
        navigate('/profile-details');
        break;
      case 'Education Qualifications':
        navigate('/education-qualifications');
        break;
      case 'Family Details':
        navigate('/family-details');
        break;
      case 'Documents':
        navigate('/job-details');
        break;
      case 'Financial Details':
        navigate('/financial-details');
        break;
      default:
        break;
    }
  };

  // Mobile view - hamburger menu
  if (isMobile) {
    return (
      <div className="lg:hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="fixed top-4 left-4 z-50 p-2 bg-theme-primary/10 rounded-lg shadow-md"
        >
          {isOpen ? <FiX size={24} /> : <FiMenu size={24} />}
        </button>

        {isOpen && (
          <div className="fixed inset-0 z-40 bg-white pt-16 overflow-y-auto">
            <div className="p-5">
              <ul className="space-y-2">
                {sections.map((section, index) => (
                  <li
                    key={index}
                    className={`text-center font-medium px-5 py-3 rounded-lg cursor-pointer transition-colors duration-300 ${
                      activeSection === section
                        ? 'bg-theme-primary text-white font-semibold border-l-4 border-theme-primary'
                        : 'bg-theme-secondary/10 text-gray-800 hover:bg-blue-200'
                    }`}
                    onClick={() => handleSectionClick(section)}
                  >
                    {section}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop view - fills App's sidebar wrapper (w-64); no extra width/margin so main content has room
  return (
    <div className="hidden lg:block w-full h-full min-h-screen overflow-y-auto sticky top-0">
      <div className="bg-theme-primary/10 p-4 rounded-xl h-full border-r border-gray-100">
        <ul className="space-y-2">
          {sections.map((section, index) => (
            <li
              key={index}
              className={`text-center font-medium px-5 py-3 rounded-lg cursor-pointer transition-colors duration-300 ${
                activeSection === section
                  ? 'bg-theme-primary text-white font-semibold border-l-4 border-theme-primary'
                  : 'bg-theme-secondary/10 text-gray-800 hover:bg-blue-200'
              }`}
              onClick={() => handleSectionClick(section)}
            >
              {section}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ProfileSidebar;