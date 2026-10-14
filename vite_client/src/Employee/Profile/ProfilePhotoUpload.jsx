import React, { useCallback, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { FiCamera, FiUpload, FiX, FiUser, FiZoomIn } from 'react-icons/fi';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { usePermissions } from '../../Hooks/usePermissions';
import { useSignedProfilePhoto } from '../../Hooks/useSignedProfilePhoto';
import { resolveProfilePhotoOwner } from '../../utils/profileUtils';

const OUTPUT_SIZE = 400;
const VIEWPORT_SIZE = 280;
/** Stable sentinel so the update modal always requests a signed URL when an owner id is known. */
const FETCH_CURRENT_PHOTO = { url: '__fetch__' };

function cropToBlob({ image, offsetX, offsetY, zoom, viewportSize }) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas not available'));
      return;
    }

    // Display width = viewportSize * zoom maps to naturalWidth
    const scale = image.naturalWidth / (viewportSize * zoom);
    const srcSize = viewportSize * scale;
    const srcX = (-offsetX) * scale;
    const srcY = (-offsetY) * scale;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    ctx.drawImage(image, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Failed to create image'));
        else resolve(blob);
      },
      'image/jpeg',
      0.9
    );
  });
}

const ProfilePhotoUpload = ({ userType = 'employee', userId, profilePhoto: profilePhotoProp, onPhotoUpdate }) => {
  const [sourceUrl, setSourceUrl] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });
  const [uploading, setUploading] = useState(false);
  const [cameraMode, setCameraMode] = useState(false);
  const [stream, setStream] = useState(null);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const user = useSelector((state) => state.auth.user);
  const employeeDetails = useSelector((state) => state.employeeDetails.employee);
  const { isPermissionGranted, isPermissionDenied, requestCameraPermission } = usePermissions();

  const fallbackOwner = resolveProfilePhotoOwner(user);
  const photoUserId = userId || fallbackOwner.userId;
  const photoUserType = userType || fallbackOwner.userType;
  // Prefer explicit prop / employee record — auth.user often lacks profilePhoto metadata
  const photoMeta =
    profilePhotoProp ||
    employeeDetails?.profilePhoto ||
    employeeDetails?.profilePicture ||
    user?.profilePhoto ||
    user?.profilePicture ||
    (photoUserId ? FETCH_CURRENT_PHOTO : null);
  const { photoUrl: currentPhotoUrl } = useSignedProfilePhoto(photoMeta, {
    userType: photoUserType,
    userId: photoUserId,
    preferFull: true,
  });
  const hasExistingPhoto = Boolean(currentPhotoUrl);

  const minZoomForCover = (w, h) => {
    if (!w || !h) return 1;
    // Need displayH >= viewport and displayW >= viewport
    return Math.max(1, w / h);
  };

  const setNewSource = (url) => {
    if (sourceUrl?.startsWith('blob:')) URL.revokeObjectURL(sourceUrl);
    setSourceUrl(url);
    setOffset({ x: 0, y: 0 });
    setZoom(1);
    setImgNatural({ w: 0, h: 0 });
  };

  const resetEditor = () => {
    if (sourceUrl?.startsWith('blob:')) URL.revokeObjectURL(sourceUrl);
    setSourceUrl(null);
    setOffset({ x: 0, y: 0 });
    setZoom(1);
    setImgNatural({ w: 0, h: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error('File size must be less than 5MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    setNewSource(URL.createObjectURL(file));
  };

  // Start camera with permission check
  const startCamera = async () => {
    if (isPermissionDenied('camera')) {
      toast.error('Camera permission denied. Please enable it in browser settings.');
      return;
    }

    if (!isPermissionGranted('camera')) {
      try {
        const result = await requestCameraPermission();
        if (!result.granted) {
          toast.warning('Camera permission is required to take a photo.');
          return;
        }
      } catch (error) {
        toast.error('Failed to request camera permission.');
        return;
      }
    }

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
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        toast.error('Camera access denied. Please enable it in browser settings.');
      } else {
        toast.error('Camera access denied or not available');
      }
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

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        setNewSource(URL.createObjectURL(blob));
        stopCamera();
      }
    }, 'image/jpeg', 0.8);
  };

  const clampOffset = useCallback(
    (x, y, nextZoom = zoom) => {
      if (!imgNatural.w || !imgNatural.h) return { x, y };
      const displayW = VIEWPORT_SIZE * nextZoom;
      const displayH = (imgNatural.h / imgNatural.w) * displayW;
      const minX = Math.min(0, VIEWPORT_SIZE - displayW);
      const minY = Math.min(0, VIEWPORT_SIZE - displayH);
      return {
        x: Math.max(minX, Math.min(0, x)),
        y: Math.max(minY, Math.min(0, y)),
      };
    },
    [imgNatural, zoom]
  );

  const onPointerDown = (e) => {
    if (!sourceUrl) return;
    e.preventDefault();
    setDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset(clampOffset(dragStartRef.current.ox + dx, dragStartRef.current.oy + dy));
  };

  const onPointerUp = () => setDragging(false);

  const handleZoomChange = (value) => {
    const nextZoom = Number(value);
    setZoom(nextZoom);
    setOffset((prev) => clampOffset(prev.x, prev.y, nextZoom));
  };

  // Crop and upload photo
  const uploadPhoto = async () => {
    if (!sourceUrl || !imageRef.current) {
      toast.error('Please select a photo first');
      return;
    }

    if (!photoUserId) {
      toast.error('User ID is required to upload photo');
      return;
    }

    setUploading(true);
    try {
      const blob = await cropToBlob({
        image: imageRef.current,
        offsetX: offset.x,
        offsetY: offset.y,
        zoom,
        viewportSize: VIEWPORT_SIZE,
      });
      const file = new File([blob], 'profile-photo.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('profilePhoto', file);

      const response = await axios.post(
        `/v1/both/profile-photo/${photoUserType}/${photoUserId}/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          withCredentials: true,
        }
      );

      toast.success(
        hasExistingPhoto ? 'Profile photo updated successfully!' : 'Profile photo uploaded successfully!'
      );
      if (onPhotoUpdate) {
        // Server response structure: { success: true, profilePhoto: {...}, fileSize: ... }
        const profilePhotoData = response.data?.profilePhoto || response.data?.data?.profilePhoto || response.data;
        onPhotoUpdate(profilePhotoData);
      }

      resetEditor();
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Failed to upload profile photo';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const displayW = VIEWPORT_SIZE * zoom;
  const displayH = imgNatural.w ? (imgNatural.h / imgNatural.w) * displayW : displayW;

  return (
    <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <FiCamera className="mr-2" />
        {hasExistingPhoto ? 'Update Profile Photo' : 'Profile Photo'}
      </h3>

      {/* Adjust / preview viewport */}
      <div className="flex flex-col items-center mb-6">
        <div
          className="relative overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100 shadow-inner touch-none"
          style={{
            width: VIEWPORT_SIZE,
            height: VIEWPORT_SIZE,
            cursor: sourceUrl ? (dragging ? 'grabbing' : 'grab') : 'default',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {sourceUrl ? (
            <img
              ref={imageRef}
              src={sourceUrl}
              alt="Adjust"
              draggable={false}
              className="absolute max-w-none select-none"
              style={{
                width: displayW,
                height: displayH,
                left: offset.x,
                top: offset.y,
              }}
              onLoad={(e) => {
                const w = e.target.naturalWidth;
                const h = e.target.naturalHeight;
                const coverZoom = minZoomForCover(w, h);
                setImgNatural({ w, h });
                setZoom(coverZoom);
                // Center the image in the circle
                const dispW = VIEWPORT_SIZE * coverZoom;
                const dispH = (h / w) * dispW;
                setOffset({
                  x: (VIEWPORT_SIZE - dispW) / 2,
                  y: (VIEWPORT_SIZE - dispH) / 2,
                });
              }}
            />
          ) : currentPhotoUrl ? (
            <img
              src={currentPhotoUrl}
              alt="Previous profile photo"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <FiUser className="w-16 h-16 text-gray-400" />
            </div>
          )}

          {sourceUrl && (
            <button
              onClick={resetEditor}
              className="absolute right-6 top-4 rounded-full bg-red-500 p-1 text-white shadow hover:bg-red-600 transition-colors"
              title="Discard selected photo"
            >
              <FiX className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-2">
          {sourceUrl
            ? 'Drag to reposition · zoom to fit'
            : hasExistingPhoto
              ? 'Previous profile photo'
              : 'No photo yet — choose one below'}
        </p>
      </div>

      {/* Zoom slider */}
      {sourceUrl && (
        <label className="mb-4 flex items-center gap-3 text-sm text-slate-600">
          <FiZoomIn className="h-4 w-4 shrink-0" />
          <input
            type="range"
            min={minZoomForCover(imgNatural.w, imgNatural.h)}
            max={Math.max(3, minZoomForCover(imgNatural.w, imgNatural.h) + 2)}
            step="0.05"
            value={zoom}
            onChange={(e) => handleZoomChange(e.target.value)}
            className="w-full accent-emerald-600"
          />
        </label>
      )}

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
            className="w-full bg-theme-secondary hover:bg-theme-primary text-white py-2 px-4 rounded-lg transition duration-300 flex items-center justify-center"
          >
            <FiCamera className="mr-2" />
            Capture Photo
          </button>
        </div>
      )}

      {/* Upload Options */}
      {!cameraMode && (
        <div className="space-y-3">
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
              {hasExistingPhoto ? 'Choose new photo' : 'Choose from Files'}
            </button>
          </div>

          <button
            onClick={startCamera}
            className="w-full bg-theme-secondary hover:bg-theme-primary text-white py-2 px-4 rounded-lg transition duration-300 flex items-center justify-center"
          >
            <FiCamera className="mr-2" />
            {hasExistingPhoto ? 'Take new photo' : 'Take Photo'}
          </button>
        </div>
      )}

      {/* Upload Button */}
      {sourceUrl && !cameraMode && (
        <div className="mt-4">
          <button
            onClick={uploadPhoto}
            disabled={uploading}
            className="w-full bg-theme-primary hover:bg-theme-primary text-white py-2 px-4 rounded-lg transition duration-300 flex items-center justify-center disabled:opacity-50"
          >
            <FiUpload className="mr-2" />
            {uploading
              ? hasExistingPhoto
                ? 'Updating...'
                : 'Uploading...'
              : hasExistingPhoto
                ? 'Update Photo'
                : 'Save Photo'}
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 p-3 bg-theme-secondary/10 rounded-lg">
        <h4 className="text-sm font-medium text-theme-secondary mb-1">Instructions:</h4>
        <ul className="text-xs text-theme-secondary space-y-1">
          <li>• Maximum file size: 5MB</li>
          <li>• Supported formats: JPG, PNG, GIF</li>
          <li>• Drag the photo to reposition, use the slider to zoom</li>
          <li>• Make sure your face is clearly visible</li>
        </ul>
      </div>
    </div>
  );
};

export default ProfilePhotoUpload;
