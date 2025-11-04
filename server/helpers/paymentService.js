import crypto from 'crypto';

export async function transferToBank({
    amount,
    currency = 'INR',
    beneficiary
}) {
    // Mock payment transfer: validate minimal fields and simulate success
    if (!beneficiary?.accountNo || !beneficiary?.ifsc || !beneficiary?.accountName || !beneficiary?.bankName) {
        return {
            success: false,
            error: 'Missing bank details (accountNo, ifsc, accountName, bankName)'
        };
    }

    if (amount <= 0) {
        return { success: false, error: 'Invalid payout amount' };
    }

    // Simulate async provider call
    await new Promise(r => setTimeout(r, 50));

    const reference = 'MOCK-' + crypto.randomBytes(6).toString('hex').toUpperCase();
    return {
        success: true,
        provider: 'mock-bank',
        reference,
        currency
    };
}


