import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import ErrorBoundary from '../ErrorBoundary';
import RouteErrorBoundary from '../RouteErrorBoundary';

describe('ErrorBoundary', () => {
    const ThrowError = ({ shouldThrow }) => {
        if (shouldThrow) {
            throw new Error('Test error');
        }
        return <div>No error</div>;
    };

    it('should render children when there is no error', () => {
        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={false} />
            </ErrorBoundary>
        );

        expect(screen.getByText('No error')).toBeInTheDocument();
    });

    it('should render error message when error occurs', () => {
        // Suppress console.error for this test
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
        
        consoleSpy.mockRestore();
    });
    it('clears a route error when navigation reaches another page', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            render(
                <MemoryRouter initialEntries={['/broken']}>
                    <Link to="/working">Working page</Link>
                    <RouteErrorBoundary>
                        <Routes>
                            <Route path="/broken" element={<ThrowError shouldThrow />} />
                            <Route path="/working" element={<ThrowError shouldThrow={false} />} />
                        </Routes>
                    </RouteErrorBoundary>
                </MemoryRouter>
            );

            expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
            fireEvent.click(screen.getByRole('link', { name: 'Working page' }));
            expect(screen.getByText('No error')).toBeInTheDocument();
        } finally {
            consoleSpy.mockRestore();
        }
    });
});
