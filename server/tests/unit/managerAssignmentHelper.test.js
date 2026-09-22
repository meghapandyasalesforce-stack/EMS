import { describe, it, expect, jest, beforeEach } from '@jest/globals';



const mockFind = jest.fn();

const mockFindOne = jest.fn();



jest.unstable_mockModule('../../models/employee.model.js', () => ({

  default: {

    find: mockFind,

    findOne: mockFindOne,

  },

}));



const {

  validateManagerAssignment,

  getEmployeeDescendantIds,

  isTopLevelManagerLabel,

} = await import('../../helpers/managerAssignmentHelper.js');



describe('managerAssignmentHelper', () => {

  beforeEach(() => {

    mockFind.mockReset();

    mockFindOne.mockReset();

  });



  it('rejects self-reporting', async () => {

    const result = await validateManagerAssignment({

      organizationId: 'org1',

      employeeId: 'emp1',

      managerId: 'emp1',

    });

    expect(result.valid).toBe(false);

  });



  it('allows Admin root when no other top-level employee exists', async () => {

    mockFind.mockReturnValue({

      select: () => ({

        lean: async () => [],

      }),

    });



    const result = await validateManagerAssignment({

      organizationId: 'org1',

      employeeId: null,

      managerId: null,

    });

    expect(result.valid).toBe(true);

    expect(result.managerId).toBeNull();

    expect(result.manager).toBe('Admin');

  });



  it('rejects a second top-level employee when Admin root already exists', async () => {

    mockFind.mockReturnValue({

      select: () => ({

        lean: async () => [{ _id: 'admin1', managerId: null }],

      }),

    });



    const result = await validateManagerAssignment({

      organizationId: 'org1',

      employeeId: null,

      managerId: null,

    });

    expect(result.valid).toBe(false);

    expect(result.message).toMatch(/Admin/i);

  });



  it('allows keeping managerId null on the existing Admin root', async () => {

    mockFind.mockReturnValue({

      select: () => ({

        lean: async () => [{ _id: 'admin1', managerId: null }],

      }),

    });



    const result = await validateManagerAssignment({

      organizationId: 'org1',

      employeeId: 'admin1',

      managerId: null,

    });

    expect(result.valid).toBe(true);

    expect(result.managerId).toBeNull();

  });



  it('recognizes Admin and CEO as top-level labels', () => {

    expect(isTopLevelManagerLabel('Admin')).toBe(true);

    expect(isTopLevelManagerLabel('CEO')).toBe(true);

    expect(isTopLevelManagerLabel('')).toBe(true);

    expect(isTopLevelManagerLabel('Jane Doe')).toBe(false);

  });



  it('collects descendants for cycle checks', async () => {

    mockFind.mockReturnValue({

      select: () => ({

        lean: async () => [

          { _id: 'mgr', managerId: null },

          { _id: 'emp1', managerId: 'mgr' },

          { _id: 'emp2', managerId: 'emp1' },

        ],

      }),

    });



    const descendants = await getEmployeeDescendantIds('org1', 'mgr');

    expect(descendants.has('emp1')).toBe(true);

    expect(descendants.has('emp2')).toBe(true);

  });



  it('rejects assigning a descendant as manager', async () => {

    mockFind.mockReturnValue({

      select: () => ({

        lean: async () => [

          { _id: 'mgr', managerId: null },

          { _id: 'emp1', managerId: 'mgr' },

          { _id: 'emp2', managerId: 'emp1' },

        ],

      }),

    });



    mockFindOne.mockReturnValue({

      select: () => ({

        lean: async () => ({

          _id: 'emp2',

          name: 'Child',

          lastName: 'User',

          employeeId: 'E2',

          organizationId: 'org1',

          managerId: 'emp1',

        }),

      }),

    });



    const result = await validateManagerAssignment({

      organizationId: 'org1',

      employeeId: 'mgr',

      managerId: 'emp2',

    });

    expect(result.valid).toBe(false);

  });

});

