import express from "express";
import {
    updateEmployeeInfo,
    addAcademicRecord,
    updateAcademicRecord,
    deleteAcademicRecord,
    addProfessionalQualification,
    uploadProfessionalQualification,
    updateProfessionalQualification,
    deleteProfessionalQualification,
    addProfessionalExperience,
    updateProfessionalExperience,
    deleteProfessionalExperience,
    addFamilyDetail,
    updateFamilyDetail,
    updateFinancialDetails,
    getTaxDeclaration,
    updateTaxDeclaration,
    getTaxDeclarationByAdmin,
    addGuarantorDetails,
    addNextOfKin,
    getEmployeeInfoByAdmin,
    getEmployeeInfoByEmployee,
    getUpcomingBirthdays,
    getUpcomingAnniversaries,
    sendBirthdayWishes,
    updateLocationPermission,
    acknowledgeOfferLetterLoginRedirect
} from "../../controllers/employee/profileDetailsController.js";
import isAuthenticated from "../../middlewares/isAuthenticated.js";
import isAuthenticatedBoth from "../../middlewares/isAuthenticatedBoth.js";
import isAdminOrHROrExecutiveAuthenticated from './../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import isAdminOrManagerOrHRAuthenticated from './../../middlewares/isAdminOrManagerOrHRAuthenticated.js';
import { terminateEmployee, updateEmployeeStatus } from "../../controllers/admin/employeeManagementController.js";
import { requireEmployeeLifecycleManage } from "../../middlewares/requirePermission.js";
import upload from "../../middlewares/upload.js";



const router = express.Router();



router.route("/update-info").put(isAuthenticated, updateEmployeeInfo);
router.route("/admin/get-info/:employeeId").get(isAdminOrManagerOrHRAuthenticated, getEmployeeInfoByAdmin);
router.route("/get-my-details").get(isAuthenticatedBoth, getEmployeeInfoByEmployee);
router.route("/add-academic-record").post(isAuthenticated, addAcademicRecord);
router.route("/update-academic-record").put(isAuthenticated, updateAcademicRecord);
router.route("/delete-academic-record").delete(isAuthenticated, deleteAcademicRecord);
router.route("/add-professional-qualification").post(isAuthenticated, addProfessionalQualification);
router.route("/upload-professional-qualification").post(isAuthenticated, upload.array('documents', 20), uploadProfessionalQualification);
router.route("/update-professional-qualification").put(isAuthenticated, updateProfessionalQualification);
router.route("/delete-professional-qualification").delete(isAuthenticated, deleteProfessionalQualification);
router.route("/add-professional-experience").post(isAuthenticated, addProfessionalExperience);
router.route("/update-professional-experience").put(isAuthenticated, updateProfessionalExperience);
router.route("/delete-professional-experience").delete(isAuthenticated, deleteProfessionalExperience);
router.route("/add-family-detail").post(isAuthenticated, addFamilyDetail);
router.route("/update-family-detail").put(isAuthenticated, updateFamilyDetail);
router.route("/add-guarantor-detail").post(isAuthenticated, addGuarantorDetails);
router.route("/add-nok-detail").post(isAuthenticated, addNextOfKin);
router.route("/update-financial-details").put(isAuthenticated, updateFinancialDetails);
router.route("/tax-declaration").get(isAuthenticated, getTaxDeclaration);
router.route("/tax-declaration").put(isAuthenticated, updateTaxDeclaration);
router.route("/admin/tax-declaration/:employeeId").get(isAdminOrManagerOrHRAuthenticated, getTaxDeclarationByAdmin);
router.route("/update-location-permission").put(isAuthenticated, updateLocationPermission);
router.route("/ack-offer-letter-login-redirect").post(isAuthenticated, acknowledgeOfferLetterLoginRedirect);
router.route("/upcoming-birthdays").get(isAuthenticatedBoth, getUpcomingBirthdays);
router.route("/upcoming-anniversaries").get(isAuthenticatedBoth, getUpcomingAnniversaries);
router.route("/send-birthday-wish").post(isAdminOrHROrExecutiveAuthenticated, sendBirthdayWishes);

// update status(active or inactive)
router.route("/admin/update-status/:employeeId").patch(requireEmployeeLifecycleManage, updateEmployeeStatus);
router.route("/admin/terminate/:employeeId").patch(requireEmployeeLifecycleManage, terminateEmployee);



export default router;