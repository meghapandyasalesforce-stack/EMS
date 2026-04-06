import express from "express";
import {
    updateEmployeeInfo,
    addAcademicRecord,
    addProfessionalQualification,
    addFamilyDetail,
    updateFamilyDetail,
    updateFinancialDetails,
    addGuarantorDetails,
    addNextOfKin,
    getEmployeeInfoByAdmin,
    getEmployeeInfoByEmployee,
    getUpcomingBirthdays,
    sendBirthdayWishes,
    updateLocationPermission
} from "../../controllers/employee/profileDetailsController.js";
import isAuthenticated from "../../middlewares/isAuthenticated.js";
import isAdminOrHROrExecutiveAuthenticated from './../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import { updateEmployeeStatus } from "../../controllers/admin/employeeManagementController.js";



const router = express.Router();



router.route("/update-info").put(isAuthenticated, updateEmployeeInfo);
router.route("/admin/get-info/:employeeId").get(isAdminOrHROrExecutiveAuthenticated, getEmployeeInfoByAdmin);
router.route("/get-my-details").get(isAuthenticated, getEmployeeInfoByEmployee);
router.route("/add-academic-record").post(isAuthenticated, addAcademicRecord);
router.route("/add-professional-qualification").post(isAuthenticated, addProfessionalQualification);
router.route("/add-family-detail").post(isAuthenticated, addFamilyDetail);
router.route("/update-family-detail").put(isAuthenticated, updateFamilyDetail);
router.route("/add-guarantor-detail").post(isAuthenticated, addGuarantorDetails);
router.route("/add-nok-detail").post(isAuthenticated, addNextOfKin);
router.route("/update-financial-details").put(isAuthenticated, updateFinancialDetails);
router.route("/update-location-permission").put(isAuthenticated, updateLocationPermission);
router.route("/upcoming-birthdays").get(isAuthenticated, getUpcomingBirthdays);
router.route("/send-birthday-wish").post(isAdminOrHROrExecutiveAuthenticated, sendBirthdayWishes);

// update status(active or inactive)
router.route("/admin/update-status/:employeeId").patch(isAdminOrHROrExecutiveAuthenticated, updateEmployeeStatus);



export default router;