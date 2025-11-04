import React, { useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FiCamera, FiUpload, FiX, FiUser } from 'react-icons/fi';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';

const ProfilePhotoUpload = ({ userType = 'employee', userId, onPhotoUpdate }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cameraMode, setCameraMode] = useState(false);
  const [stream, setStream] = useState(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const user = useSelector((state) => state.auth.user);

  // Handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('File size must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  // Start camera
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: 640, 
          height: 640,
          facingMode: 'user'
        }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraMode(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Camera access denied or not available');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraMode(false);
  };

  // Capture photo from camera
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });
        setSelectedFile(file);
        setPreview(URL.createObjectURL(blob));
        stopCamera();
      }
    }, 'image/jpeg', 0.8);
  };

  // Upload photo
  const uploadPhoto = async () => {
    if (!selectedFile) {
      toast.error('Please select a photo first');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('profilePhoto', selectedFile);

      const response = await axios.post(
        `/v1/both/profile-photo/${userType}/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          withCredentials: true,
        }
      );

      toast.success('Profile photo uploaded successfully!');
      if (onPhotoUpdate) {
        onPhotoUpdate(response.data.profilePhoto || response.data);
      }
      
      // Reset state
      setSelectedFile(null);
      setPreview(null);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  // Remove selected photo
  const removePhoto = () => {
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <FiCamera className="mr-2" />
        Profile Photo
      </h3>

      {/* Current Photo Display */}
      <div className="flex flex-col items-center mb-6">
        <div className="relative">
          <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
            {preview ? (
              <img
                src={preview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            ) : user?.profilePhoto ? (
              <img
                src={user.profilePhoto.url || user.profilePhoto}
                alt="Current Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <FiUser className="w-16 h-16 text-gray-400" />
            )}
          </div>
          {preview && (
            <button
              onClick={removePhoto}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
            >
              <FiX className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-2">
          {preview ? 'New photo selected' : 'Current profile photo'}
        </p>
      </div>

      {/* Camera Mode */}
      {cameraMode && (
        <div className="mb-4 p-4 bg-gray-100 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Camera Preview</span>
            <button
              onClick={stopCamera}
              className="text-red-500 hover:text-red-700"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full max-w-md rounded-lg mb-2"
          />
          <canvas ref={canvasRef} className="hidden" />
          <button
            onClick={capturePhoto}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition duration-300 flex items-center justify-center"
          >
            <FiCamera className="mr-2" />
            Capture Photo
          </button>
        </div>
      )}

      {/* Upload Options */}
      {!cameraMode && (
        <div className="space-y-3">
          {/* File Upload */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition duration-300 flex items-center justify-center"
            >
              <FiUpload className="mr-2" />
              Choose from Files
            </button>
          </div>

          {/* Camera Option */}
          <button
            onClick={startCamera}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition duration-300 flex items-center justify-center"
          >
            <FiCamera className="mr-2" />
            Take Photo
          </button>
        </div>
      )}

      {/* Upload Button */}
      {selectedFile && !cameraMode && (
        <div className="mt-4">
          <button
            onClick={uploadPhoto}
            disabled={uploading}
            className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg transition duration-300 flex items-center justify-center disabled:opacity-50"
          >
            <FiUpload className="mr-2" />
            {uploading ? 'Uploading...' : 'Upload Photo'}
          </button>
        </div>
      )}

      {/* File Info */}
      {selectedFile && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>File:</strong> {selectedFile.name}
          </p>
          <p className="text-sm text-gray-600">
            <strong>Size:</strong> {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
          </p>
          <p className="text-sm text-gray-600">
            <strong>Type:</strong> {selectedFile.type}
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-800 mb-1">Instructions:</h4>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• Maximum file size: 5MB</li>
          <li>• Supported formats: JPG, PNG, GIF</li>
          <li>• Recommended size: 400x400 pixels</li>
          <li>• Make sure your face is clearly visible</li>
        </ul>
      </div>
    </div>
  );
};

export default ProfilePhotoUpload;
