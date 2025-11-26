/**
 * Swagger/OpenAPI Configuration
 * API Documentation setup for EMS-Paarsiv
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'EMS-Paarsiv API',
            version: '1.0.0',
            description: 'Employee Management System API Documentation',
            contact: {
                name: 'API Support',
                email: 'support@paarsiv.com'
            },
            license: {
                name: 'ISC',
                url: 'https://opensource.org/licenses/ISC'
            }
        },
        servers: [
            {
                url: process.env.API_URL || 'http://localhost:10000/api/v1',
                description: 'Development server'
            },
            {
                url: process.env.PRODUCTION_API_URL || 'https://api.paarsiv.com/api/v1',
                description: 'Production server'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT token obtained from login endpoint'
                },
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'jwt',
                    description: 'JWT token stored in httpOnly cookie'
                }
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: false
                        },
                        message: {
                            type: 'string',
                            example: 'Error message'
                        },
                        code: {
                            type: 'string',
                            example: 'ERROR_CODE'
                        }
                    }
                },
                Success: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: true
                        },
                        message: {
                            type: 'string',
                            example: 'Success message'
                        }
                    }
                },
                Organization: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011'
                        },
                        name: {
                            type: 'string',
                            example: 'Acme Corporation'
                        },
                        email: {
                            type: 'string',
                            example: 'contact@acme.com'
                        },
                        phone: {
                            type: 'string',
                            example: '+1234567890'
                        },
                        domain: {
                            type: 'string',
                            example: 'acme.com'
                        },
                        subscriptionPlan: {
                            type: 'string',
                            enum: ['free', 'basic', 'premium', 'enterprise'],
                            example: 'premium'
                        },
                        maxEmployees: {
                            type: 'number',
                            example: 200
                        }
                    }
                },
                User: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011'
                        },
                        name: {
                            type: 'string',
                            example: 'John Doe'
                        },
                        email: {
                            type: 'string',
                            example: 'john@example.com'
                        },
                        role: {
                            type: 'string',
                            enum: ['admin', 'employee'],
                            example: 'admin'
                        },
                        organizationId: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011'
                        }
                    }
                },
                Employee: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                        name: { type: 'string', example: 'John' },
                        lastName: { type: 'string', example: 'Doe' },
                        email: { type: 'string', example: 'john.doe@example.com' },
                        employeeId: { type: 'string', example: 'EMP-JOH-2025-1234' },
                        department: { type: 'string', example: 'Engineering' },
                        jobTitle: { type: 'string', example: 'Software Engineer' },
                        status: { type: 'string', enum: ['active', 'inactive', 'suspended', 'terminated'], example: 'active' }
                    }
                }
            },
            responses: {
                ValidationError: {
                    description: 'Validation error',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            },
                            example: {
                                success: false,
                                message: 'Validation failed',
                                code: 'VALIDATION_ERROR',
                                errors: [
                                    { field: 'email', message: 'Invalid email format' }
                                ]
                            }
                        }
                    }
                },
                UnauthorizedError: {
                    description: 'Unauthorized',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            },
                            example: {
                                success: false,
                                message: 'Unauthorized',
                                code: 'UNAUTHORIZED'
                            }
                        }
                    }
                },
                ForbiddenError: {
                    description: 'Forbidden',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            },
                            example: {
                                success: false,
                                message: 'Access forbidden',
                                code: 'FORBIDDEN'
                            }
                        }
                    }
                },
                NotFoundError: {
                    description: 'Resource not found',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            },
                            example: {
                                success: false,
                                message: 'Resource not found',
                                code: 'NOT_FOUND'
                            }
                        }
                    }
                }
            }
        },
        security: [
            {
                bearerAuth: []
            },
            {
                cookieAuth: []
            }
        ]
    },
    apis: [
        './routes/**/*.js',
        './controllers/**/*.js',
        './server.js'
    ]
};

const swaggerSpec = swaggerJsdoc(options);

/**
 * Swagger UI setup middleware
 */
export const swaggerUiSetup = swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'EMS-Paarsiv API Documentation'
});

/**
 * Swagger UI serve middleware
 */
export const swaggerUiServe = swaggerUi.serve;

/**
 * Swagger specification
 */
export const swaggerSpecification = swaggerSpec;

export default {
    swaggerUiSetup,
    swaggerUiServe,
    swaggerSpecification
};

