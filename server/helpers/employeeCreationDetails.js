// Only profile fields editable during onboarding may supplement registration.
// Never spread the request body into the Employee model (it includes access fields).
export function employeeCreationDetails(body = {}) {
    const details = {};
    for (const key of [
        'birthDate', 'gender', 'phone1', 'phone2', 'personalEmail', 'address', 'city',
        'maritalStatus', 'spouseName', 'marriageDate', 'nationalIdType', 'nationalId',
        'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship',
    ]) {
        if (typeof body[key] === 'string' && body[key].trim()) details[key] = body[key].trim();
    }
    const financial = {};
    for (const key of ['bankName', 'accountName', 'accountNo', 'ifsc', 'panNumber', 'epfUan', 'taxRegime']) {
        const value = body.financialDetails?.[key];
        if (typeof value === 'string' && value.trim()) financial[key] = value.trim();
    }
    if (Object.keys(financial).length) details.financialDetails = financial;
    return details;
}
