import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SettingsSectionPicker from './SettingsSectionPicker';

const sections = [{ id: 'email', name: 'Email Configuration' }, { id: 'notifications', name: 'Notification Settings' }, { id: 'attendance', name: 'Attendance Rules' }];
const groups = [{ id: 'workforce', name: 'Workforce', sections: ['attendance'] }, { id: 'communication', name: 'Communication', sections: ['email', 'notifications'] }];
function Picker() {
    const [value, setValue] = useState('email');
    return <SettingsSectionPicker groups={groups} sections={sections} value={value} onChange={setValue} />;
}

describe('settings section picker', () => {
    it('opens a grouped searchable dialog and selects a section', () => {
        render(<Picker />);
        fireEvent.click(screen.getByRole('button', { name: 'Settings section Email Configuration' }));
        expect(screen.getByRole('dialog', { name: 'Choose a section' })).toBeInTheDocument();
        fireEvent.change(screen.getByRole('searchbox', { name: 'Search settings' }), { target: { value: 'attendance' } });
        expect(screen.queryByRole('button', { name: 'Email Configuration', exact: true })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Attendance Rules', exact: true }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Settings section Attendance Rules' })).toHaveFocus();
    });

    it('dismisses with Escape and restores focus and scrolling', () => {
        document.body.style.overflow = 'auto';
        render(<Picker />);
        const trigger = screen.getByRole('button', { name: 'Settings section Email Configuration' });
        fireEvent.click(trigger);
        expect(document.body.style.overflow).toBe('hidden');
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        expect(trigger).toHaveFocus();
        expect(document.body.style.overflow).toBe('auto');
    });

    it('handles empty search results and resets the search when reopened', () => {
        render(<Picker />);
        const trigger = screen.getByRole('button', { name: 'Settings section Email Configuration' });
        fireEvent.click(trigger);
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'unmatched' } });
        expect(screen.getByRole('status')).toHaveTextContent('No matching settings');
        fireEvent.click(screen.getByRole('button', { name: 'Close settings picker' }));
        fireEvent.click(trigger);
        expect(screen.getByRole('searchbox')).toHaveValue('');
        expect(screen.getByRole('button', { name: 'Email Configuration', exact: true })).toHaveAttribute('aria-current', 'page');
    });

    it('supports arrow navigation and keeps keyboard focus inside the picker', () => {
        render(<Picker />);
        fireEvent.click(screen.getByRole('button', { name: 'Settings section Email Configuration' }));
        const search = screen.getByRole('searchbox'); search.focus();
        fireEvent.keyDown(search, { key: 'ArrowDown' });
        expect(screen.getByRole('button', { name: 'Attendance Rules', exact: true })).toHaveFocus();
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowUp' });
        expect(screen.getByRole('button', { name: 'Notification Settings', exact: true })).toHaveFocus();
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
        expect(screen.getByRole('button', { name: 'Close settings picker' })).toHaveFocus();
    });

    it('dismisses when the backdrop is tapped without changing the section', () => {
        render(<Picker />);
        fireEvent.click(screen.getByRole('button', { name: 'Settings section Email Configuration' }));
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss settings picker' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Settings section Email Configuration' })).toHaveAttribute('aria-expanded', 'false');
    });
});
