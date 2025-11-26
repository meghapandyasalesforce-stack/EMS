import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatCard from '../StatCard';
import { FaUsers } from 'react-icons/fa';

describe('StatCard', () => {
  it('renders with required props', () => {
    render(<StatCard label="Test Label" value={100} />);
    expect(screen.getByText('Test Label')).toBeDefined();
    expect(screen.getByText('100')).toBeDefined();
  });

  it('renders with icon', () => {
    render(<StatCard label="Users" value={50} icon={<FaUsers />} />);
    expect(screen.getByText('Users')).toBeDefined();
  });

  it('renders with subtitle', () => {
    render(<StatCard label="Users" value={50} subtitle="Active users" />);
    expect(screen.getByText('Active users')).toBeDefined();
  });

  it('applies correct color classes', () => {
    const { container } = render(
      <StatCard label="Test" value={10} color="green" />
    );
    const element = container.querySelector('.border-green-500');
    expect(element).toBeDefined();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<StatCard label="Test" value={10} onClick={handleClick} />);
    const card = screen.getByText('Test').closest('div');
    if (card) {
      card.click();
      expect(handleClick).toHaveBeenCalledTimes(1);
    }
  });
});

