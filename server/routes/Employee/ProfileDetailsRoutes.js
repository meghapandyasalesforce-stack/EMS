import express from "express";
import {
    updateEmployeeInfo,
    addAcademicRecord,
    addProfessionalQualification,
    addFamilyDetail,
    updateFinancialDetails,
    addGuarantorDetails,
    addNextOfKin,
    getEmployeeInfoByAdmin,
    getEmployeeInfoByEmployee,
    getUpcomingBirthdays,
    updateLocationPermission
} from "../../controllers/employee/profileDetailsController.js";
import isAuthenticated from "../../middlewares/isAuthenticated.js";
import isAdminOrHRAuthenticated from './../../middlewares/isAdminOrHRAuthenticated.js';
import { updateEmployeeStatus } from "../../controllers/admin/employeeManagementController.js";



const router = express.Router();


router.route("/update-info").put(isAuthenticated, updateEmployeeInfo);
router.route("/admin/get-info/:employeeId").get(isAdminOrHRAuthenticated, getEmployeeInfoByAdmin);
router.route("/get-my-details").get(isAuthenticated, getEmployeeInfoByEmployee);
router.route("/add-academic-record").post(isAuthenticated, addAcademicRecord);
router.route("/add-professional-qualification").post(isAuthenticated, addProfessionalQualification);
router.route("/add-family-detail").post(isAuthenticated, addFamilyDetail);
router.route("/add-guarantor-detail").post(isAuthenticated, addGuarantorDetails);
router.route("/add-nok-detail").post(isAuthenticated, addNextOfKin);
router.route("/update-financial-details").put(isAuthenticated, updateFinancialDetails);
router.route("/update-location-permission").put(isAuthenticated, updateLocationPermission);
router.route("/upcoming-birthdays").get(isAuthenticated, getUpcomingBirthdays);

// update status(active or inactive)
router.route("/admin/update-status/:employeeId").patch(isAdminOrHRAuthenticated, updateEmployeeStatus);



export default router;