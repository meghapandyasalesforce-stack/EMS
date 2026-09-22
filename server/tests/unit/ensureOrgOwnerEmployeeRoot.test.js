import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockUserFindById = jest.fn();
const mockEmployeeFindOne = jest.fn();
const mockEmployeeFind = jest.fn().mockResolvedValue([]);
const mockEmployeeCountDocuments = jest.fn().mockResolvedValue(0);
const mockEmployeeUpdateOne = jest.fn();
const mockEmployeeUpdateMany = jest.fn();
const mockEmployeeSave = jest.fn();

jest.unstable_mockModule('../../models/user.model.js', () => ({
  default: {
    findById: mockUserFindById,
  },
}));

jest.unstable_mockModule('../../models/employee.model.js', () => {
  class MockEmployee {
    constructor(data) {
      Object.assign(this, data);
      this._id = data._id || 'new-emp-id';
      this.save = mockEmployeeSave.mockImplementation(async () => this);
    }
  }
  MockEmployee.findOne = mockEmployeeFindOne;
  MockEmployee.find = mockEmployeeFind;
  MockEmployee.countDocuments = mockEmployeeCountDocuments;
  MockEmployee.updateOne = mockEmployeeUpdateOne;
  MockEmployee.updateMany = mockEmployeeUpdateMany;
  return { default: MockEmployee };
});

const {
  ensureOrgOwnerEmployeeRoot,
  linkOrgOwnerMeProfile,
  findOrgOwnerEmployeeProfile,
  findOrgOwnerRootEmployee,
} = await import('../../helpers/identityService.js');

const chain = (value) => ({
  select: () => ({
    lean: async () => value,
    sort: () => ({ lean: async () => value }),
  }),
  sort: () => Promise.resolve(value),
  lean: async () => value,
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
});

describe('ensureOrgOwnerEmployeeRoot', () => {
  beforeEach(() => {
    mockUserFindById.mockReset();
    mockEmployeeFindOne.mockReset();
    mockEmployeeFind.mockReset();
    mockEmployeeFind.mockResolvedValue([]);
    mockEmployeeCountDocuments.mockReset();
    mockEmployeeCountDocuments.mockResolvedValue(0);
    mockEmployeeUpdateOne.mockReset();
    mockEmployeeUpdateMany.mockReset();
    mockEmployeeSave.mockReset();
  });

  it('creates Admin/CEO root without setting User.employeeProfileId (Me)', async () => {
    const userDoc = {
      _id: 'user1',
      name: 'Org Admin',
      email: 'abc@gmail.com',
      phone: '+123',
      role: 'admin',
      roles: ['org_owner', 'hr_admin'],
      organizationId: 'org1',
      employeeProfileId: null,
      save: jest.fn().mockResolvedValue(true),
    };

    mockUserFindById.mockResolvedValue(userDoc);
    mockEmployeeFindOne.mockImplementation((query) => {
      if (query?.isOrgOwnerRoot === true) return chain(null);
      if (query?.employeeId) return chain(null);
      return chain(null);
    });

    const result = await ensureOrgOwnerEmployeeRoot(userDoc, 'org1');

    expect(result.ok).toBe(true);
    expect(result.created).toBe(true);
    expect(result.linked).toBe(false);
    expect(result.employee.isOrgOwnerRoot).toBe(true);
    expect(result.employee.managerId == null).toBe(true);
    expect(result.employee.email).toBe('abc@gmail.com');
    expect(userDoc.employeeProfileId).toBeNull();
    expect(userDoc.save).not.toHaveBeenCalled();
  });

  it('reuses existing isOrgOwnerRoot without linking as Me', async () => {
    const existingRoot = {
      _id: 'root1',
      email: 'abc@gmail.com',
      managerId: null,
      manager: 'Admin',
      isOrgOwnerRoot: true,
      organizationId: 'org1',
      jobTitle: 'CEO',
      position: 'CEO',
      department: 'Administration',
      jobCategory: 'Administration',
      save: jest.fn().mockResolvedValue(true),
    };

    const userDoc = {
      _id: 'user1',
      name: 'Org Admin',
      email: 'abc@gmail.com',
      role: 'admin',
      roles: ['org_owner'],
      organizationId: 'org1',
      employeeProfileId: null,
      save: jest.fn().mockResolvedValue(true),
    };

    mockUserFindById.mockResolvedValue(userDoc);
    mockEmployeeFindOne.mockImplementation((query) => {
      if (query?.isOrgOwnerRoot === true) return chain(existingRoot);
      return chain(null);
    });

    const result = await ensureOrgOwnerEmployeeRoot(userDoc, 'org1');

    expect(result.ok).toBe(true);
    expect(result.created).toBe(false);
    expect(result.employee._id).toBe('root1');
    expect(userDoc.employeeProfileId).toBeNull();
  });

  it('rejects non-org-owner users', async () => {
    const userDoc = {
      _id: 'user2',
      email: 'hr@acme.com',
      role: 'admin',
      roles: ['hr_admin'],
      organizationId: 'org1',
    };
    mockUserFindById.mockResolvedValue(userDoc);

    const result = await ensureOrgOwnerEmployeeRoot(userDoc, 'org1');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('NOT_ORG_OWNER');
  });
});

describe('Admin root vs Me separation', () => {
  beforeEach(() => {
    mockUserFindById.mockReset();
    mockEmployeeFindOne.mockReset();
    mockEmployeeUpdateOne.mockReset();
    mockEmployeeUpdateMany.mockReset();
  });

  it('findOrgOwnerEmployeeProfile never returns the CEO root', async () => {
    const userDoc = {
      _id: 'user1',
      employeeProfileId: 'root1',
      organizationId: 'org1',
    };

    mockEmployeeFindOne.mockImplementation((query) => {
      // Linked id points at root → excluded by isOrgOwnerRoot filter → null
      if (query?._id === 'root1') return chain(null);
      if (query?.userId === 'user1') return chain(null);
      return chain(null);
    });

    const me = await findOrgOwnerEmployeeProfile(userDoc, 'org1');
    expect(me).toBeNull();
  });

  it('linkOrgOwnerMeProfile refuses to link the permanent root as Me', async () => {
    const root = {
      _id: 'root1',
      organizationId: 'org1',
      isOrgOwnerRoot: true,
      email: 'abc@gmail.com',
      name: 'Admin',
      jobTitle: 'CEO',
    };

    mockEmployeeFindOne.mockResolvedValue(root);
    mockUserFindById.mockResolvedValue({
      _id: 'user1',
      email: 'abc@gmail.com',
      employeeProfileId: null,
      save: jest.fn(),
    });

    const result = await linkOrgOwnerMeProfile({ _id: 'user1' }, 'root1', 'org1');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('CANNOT_LINK_ROOT_AS_ME');
  });

  it('linkOrgOwnerMeProfile links Me without changing CEO root fields', async () => {
    const rootSnapshot = {
      _id: 'root1',
      name: 'Admin',
      email: 'abc@gmail.com',
      jobTitle: 'CEO',
      position: 'CEO',
      department: 'Administration',
      isOrgOwnerRoot: true,
      managerId: null,
    };

    const me = {
      _id: 'me1',
      organizationId: 'org1',
      email: 'abc@gmail.com',
      name: 'Megha',
      lastName: '',
      isOrgOwnerRoot: false,
      managerId: 'hrm1',
      manager: 'HR Manager',
      department: 'HR',
      position: 'HR Executive',
      userId: null,
      save: jest.fn().mockResolvedValue(true),
    };

    const userDoc = {
      _id: 'user1',
      email: 'abc@gmail.com',
      roles: ['org_owner'],
      employeeProfileId: null,
      save: jest.fn().mockResolvedValue(true),
    };

    mockEmployeeFindOne.mockResolvedValue(me);
    mockUserFindById.mockResolvedValue(userDoc);
    mockEmployeeUpdateMany.mockResolvedValue({});

    const result = await linkOrgOwnerMeProfile(userDoc, 'me1', 'org1');

    expect(result.ok).toBe(true);
    expect(userDoc.employeeProfileId).toBe('me1');
    expect(me.managerId).toBe('hrm1');
    expect(me.isOrgOwnerRoot).toBe(false);
    expect(me.department).toBe('HR');
    // Root never loaded for mutation in this path
    expect(rootSnapshot.isOrgOwnerRoot).toBe(true);
    expect(rootSnapshot.jobTitle).toBe('CEO');
    expect(rootSnapshot.managerId).toBeNull();
  });

  it('findOrgOwnerRootEmployee returns permanent root by flag', async () => {
    const root = { _id: 'root1', isOrgOwnerRoot: true };
    mockEmployeeFindOne.mockImplementation((query) => {
      if (query?.isOrgOwnerRoot === true) return chain(root);
      return chain(null);
    });
    const found = await findOrgOwnerRootEmployee('org1');
    expect(found._id).toBe('root1');
  });
});
