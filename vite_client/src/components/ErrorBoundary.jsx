import React from 'react';
import logger from '../utils/logger';

/**
 * Error Boundary Component
 * Catches React component errors and displays a fallback UI
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // Log error to error reporting service
        logger.error('React Error Boundary caught an error', {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack
        });

        this.setState({
            error,
            errorInfo
        });
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        // Optionally reload the page
        if (this.props.resetOnReload) {
            window.location.reload();
        }
    };

    render() {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                // Check if fallback is a function or JSX element
                if (typeof this.props.fallback === 'function') {
                    return this.props.fallback(this.state.error, this.handleReset);
                } else {
                    // If it's JSX, render it directly
                    return this.props.fallback;
                }
            }

            // Default fallback UI
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                    <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
                        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                            <svg
                                className="w-6 h-6 text-red-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 text-center mb-2">
                            Something went wrong
                        </h2>
                        <p className="text-gray-600 text-center mb-6">
                            We're sorry, but something unexpected happened. Please try again.
                        </p>
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="mb-4 p-3 bg-red-50 rounded border border-red-200">
                                <p className="text-sm font-mono text-red-800 break-all">
                                    {this.state.error.toString()}
                                </p>
                                {this.state.errorInfo && (
                                    <details className="mt-2">
                                        <summary className="text-sm text-red-600 cursor-pointer">
                                            Component Stack
                                        </summary>
                                        <pre className="text-xs text-red-700 mt-2 overflow-auto max-h-40">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={this.handleReset}
                                className="flex-1 bg-theme-primary text-white px-4 py-2 rounded-md hover:opacity-90 transition-colors"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={() => window.location.href = '/'}
                                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
                            >
                                Go Home
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
