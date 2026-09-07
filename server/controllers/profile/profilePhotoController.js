import Employee from '../../models/employee.model.js';
import User from '../../models/user.model.js';
import multer from 'multer';
import crypto from 'crypto';
import logger from '../../helpers/logger.js';
import { sendSuccess, sendError, sendNotFound, sendInternalError } from '../../helpers/responseHelper.js';
import { processProfilePhotoBuffer, generateThumbnailBuffer } from '../../helpers/imageOptimizer.js';
import { uploadFile, deleteFile, buildS3Key, getSignedUrl, extractS3Key } from '../../helpers/storageHelper.js';
import { OnboardingWorkflow } from '../../models/onboarding.model.js';
import { emitOnboardingChangedAsync, runInBackground } from '../../helpers/backgroundTasks.js';
import { synchronizeOnboardingWorkflows } from '../../services/onboardingService.js';
import { getOrganizationId } from '../../helpers/organizationHelper.js';
import { resolveEmployeeLeaveBalanceAccess } from '../../helpers/leaveBalanceAccessHelper.js';

export const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed!'), false);
    },
});

async function uploadProfilePhotoToS3(buffer, organizationId, entityId) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    const filename = `${entityId}-${timestamp}-${random}.jpg`;
    const key = buildS3Key('profile-photo', organizationId, filename);

    const optimized = await processProfilePhotoBuffer(buffer, 800);
    const thumbBuffer = await generateThumbnailBuffer(optimized, 200);

    const thumbFilename = `${entityId}-${timestamp}-${random}_thumb.jpg`;
    const thumbKey = buildS3Key('profile-photo', organizationId, thumbFilename);

    // Private upload: profile photos are private S3 objects served via signed URLs.
    await Promise.all([
        uploadFile(optimized, key, 'image/jpeg', false),
        uploadFile(thumbBuffer, thumbKey, 'image/jpeg', false),
    ]);

    return {
        url: key,
        thumbnailUrl: thumbKey,
        s3Key: key,
        thumbS3Key: thumbKey,
        filename,
        uploadedAt: new Date(),
        optimized: true,
        originalSize: buffer.length,
        optimizedSize: optimized.length,
    };
}

/**
 * Resolve the S3 object key for a stored profile photo.
 * New records store `s3Key` directly; legacy records only have `url` (a full
 * public S3 URL that can still be reduced back to the private object key).
 */
function resolvePhotoKey(profilePhoto) {
    if (!profilePhoto) return null;
    return profilePhoto.s3Key || extractS3Key(profilePhoto.url) || null;
}

function resolveThumbKey(profilePhoto) {
    if (!profilePhoto) return null;
    return profilePhoto.thumbS3Key || extractS3Key(profilePhoto.thumbnailUrl) || null;
}

/**
 * Load the photo owner scoped to the requester's organization so a user from
 * organization A can never read/delete a profile photo belonging to org B.
 */
async function loadPhotoOwner(req, userId, userType) {
    const organizationId = getOrganizationId(req);
    const filter = { _id: userId };
    if (organizationId) filter.organizationId = organizationId;
    if (userType === 'employee') return Employee.findOne(filter);
    if (userType === 'admin') return User.findOne(filter);
    return null;
}

/**
 * Authorization for viewing/deleting a profile photo (kept identical for
 * GET and DELETE). Reuses the existing leave-balance access model for
 * employees (self, org admin, HR, executive, or direct manager). Admin photos
 * are limited to the admin themself or other org admin/HR/executive users.
 */
async function canAccessProfilePhoto(req, userId, userType) {
    if (userType === 'employee') {
        const access = await resolveEmployeeLeaveBalanceAccess(req, userId);
        return Boolean(access?.ok);
    }
    const isSelf = String(req.user?._id || req.decoded?.userId) === String(userId);
    if (isSelf) return true;
    return String(req.user?.role || req.decoded?.role || '').toLowerCase() === 'admin';
}

function synchronizeProfilePhotoWithOnboarding(employee) {
    if (!employee?._id || !employee?.organizationId) return;
    runInBackground('onboarding-profile-photo-sync', async () => {
        await synchronizeOnboardingWorkflows(employee.organizationId);
        const workflowIds = await OnboardingWorkflow.find({
            organizationId: employee.organizationId,
            employeeId: employee._id,
            isTemplate: { $ne: true },
        }).distinct('_id');
        workflowIds.forEach((workflowId) =>
            emitOnboardingChangedAsync(employee.organizationId, workflowId));
    });
}

export const uploadEmployeePhoto = async (req, res) => {
    try {
        if (!req.file) return sendError(res, 'No image file provided', 400, 'NO_FILE');

        const employee = await Employee.findById(req.employee._id);
        if (!employee) return sendNotFound(res, 'Employee');

        // Delete old photo from S3
        if (employee.profilePhoto?.s3Key) await deleteFile(employee.profilePhoto.s3Key);
        if (employee.profilePhoto?.thumbS3Key) await deleteFile(employee.profilePhoto.thumbS3Key);

        const photoRecord = await uploadProfilePhotoToS3(
            req.file.buffer,
            employee.organizationId,
            employee._id
        );

        employee.profilePhoto = photoRecord;
        await employee.save();
        synchronizeProfilePhotoWithOnboarding(employee);

        return sendSuccess(res, { profilePhoto: employee.profilePhoto }, 'Profile photo uploaded successfully');
    } catch (error) {
        logger.error('Upload error', { error: error.message });
        return sendInternalError(res, 'Failed to upload profile photo', error);
    }
};

export const uploadEmployeePhotoByAdmin = async (req, res) => {
    try {
        if (!req.file) return sendError(res, 'No image file provided', 400, 'NO_FILE');

        const employee = await Employee.findById(req.params.employeeId);
        if (!employee) return sendNotFound(res, 'Employee');

        if (employee.profilePhoto?.s3Key) await deleteFile(employee.profilePhoto.s3Key);
        if (employee.profilePhoto?.thumbS3Key) await deleteFile(employee.profilePhoto.thumbS3Key);

        const photoRecord = await uploadProfilePhotoToS3(
            req.file.buffer,
            employee.organizationId,
            employee._id
        );

        employee.profilePhoto = photoRecord;
        await employee.save();
        synchronizeProfilePhotoWithOnboarding(employee);

        return sendSuccess(res, { profilePhoto: employee.profilePhoto }, 'Profile photo uploaded successfully');
    } catch (error) {
        logger.error('Admin employee photo upload error', { error: error.message });
        return sendInternalError(res, 'Failed to upload profile photo', error);
    }
};

export const uploadAdminPhoto = async (req, res) => {
    try {
        if (!req.file) return sendError(res, 'No image file provided', 400, 'NO_FILE');

        const user = await User.findById(req.user._id);
        if (!user) return sendNotFound(res, 'User');

        if (user.profilePhoto?.s3Key) await deleteFile(user.profilePhoto.s3Key);
        if (user.profilePhoto?.thumbS3Key) await deleteFile(user.profilePhoto.thumbS3Key);

        const photoRecord = await uploadProfilePhotoToS3(
            req.file.buffer,
            user.organizationId,
            user._id
        );

        user.profilePhoto = photoRecord;
        await user.save();

        return sendSuccess(res, { profilePhoto: user.profilePhoto }, 'Profile photo uploaded successfully');
    } catch (error) {
        logger.error('Upload error', { error: error.message });
        return sendInternalError(res, 'Failed to upload profile photo', error);
    }
};

export const getProfilePhoto = async (req, res) => {
    try {
        const { userId, userType } = req.params;

        const user = await loadPhotoOwner(req, userId, userType);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const allowed = await canAccessProfilePhoto(req, userId, userType);
        if (!allowed) {
            return res.status(403).json({ message: 'You do not have permission to view this profile photo' });
        }

        const photo = user.profilePhoto;
        if (!photo) return res.status(404).json({ message: 'No profile photo found' });

        const key = resolvePhotoKey(photo);
        const thumbKey = resolveThumbKey(photo);
        if (!key) return res.status(404).json({ message: 'No profile photo found' });

        // Short-lived (15 min) signed URLs are generated only when a photo is displayed.
        const [url, thumbnailUrl] = await Promise.all([
            getSignedUrl(key, 900),
            thumbKey ? getSignedUrl(thumbKey, 900) : Promise.resolve(null),
        ]);

        res.json({
            profilePhoto: {
                url,
                thumbnailUrl: thumbnailUrl || url,
                filename: photo.filename,
                uploadedAt: photo.uploadedAt,
            },
        });
    } catch (error) {
        logger.error('Get photo error', { error: error.message });
        res.status(500).json({ message: 'Failed to get profile photo', error: error.message });
    }
};

export const deleteProfilePhoto = async (req, res) => {
    try {
        const { userId, userType } = req.params;

        const user = await loadPhotoOwner(req, userId, userType);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const allowed = await canAccessProfilePhoto(req, userId, userType);
        if (!allowed) {
            return res.status(403).json({ message: 'You do not have permission to delete this profile photo' });
        }

        if (!user.profilePhoto) return res.status(404).json({ message: 'No profile photo found' });

        await deleteFile(resolvePhotoKey(user.profilePhoto));
        await deleteFile(resolveThumbKey(user.profilePhoto));

        user.profilePhoto = undefined;
        await user.save();
        if (userType === 'employee') synchronizeProfilePhotoWithOnboarding(user);

        res.json({ message: 'Profile photo deleted successfully' });
    } catch (error) {
        logger.error('Delete photo error', { error: error.message });
        res.status(500).json({ message: 'Failed to delete profile photo', error: error.message });
    }
};
