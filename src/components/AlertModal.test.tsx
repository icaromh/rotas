/**
 * @file AlertModal.test.tsx
 *
 * Unit tests for the AlertModal component.
 *
 * AlertModal is a custom modal that replaces the native browser alert() for
 * polygon-area-limit messages in MapContainer. It uses the native <dialog>
 * element with glassmorphism styling, accessibility attributes, and smooth
 * animations.
 *
 * These tests run in a jsdom environment (see vite.config.ts projects[1]).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlertModal } from './AlertModal';

// jsdom does not implement HTMLDialogElement.showModal / close natively.
// We patch the prototype before each test so the component can call them.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    // Dispatch the close event so the component's listener fires
    this.dispatchEvent(new Event('close'));
  });
});

describe('AlertModal', () => {
  it('renders the message and title when isOpen=true', () => {
    render(
      <AlertModal
        isOpen={true}
        message="Test message content"
        title="Test Title"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Test message content')).toBeTruthy();
    expect(screen.getByText('Test Title')).toBeTruthy();
  });

  it('does not render when isOpen=false', () => {
    const { container } = render(
      <AlertModal
        isOpen={false}
        message="Hidden message"
        title="Hidden Title"
        onClose={vi.fn()}
      />
    );

    // The component returns null when isOpen=false
    expect(container.firstChild).toBeNull();
  });

  it('calls onClose when the X button is clicked', () => {
    const onClose = vi.fn();
    render(
      <AlertModal
        isOpen={true}
        message="Some alert"
        onClose={onClose}
      />
    );

    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the OK button is clicked', () => {
    const onClose = vi.fn();
    render(
      <AlertModal
        isOpen={true}
        message="Some alert"
        onClose={onClose}
      />
    );

    const okBtn = screen.getByRole('button', { name: 'OK' });
    fireEvent.click(okBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed (dialog close event)', () => {
    const onClose = vi.fn();
    render(
      <AlertModal
        isOpen={true}
        message="Escape test"
        onClose={onClose}
      />
    );

    const dialog = screen.getByRole('dialog');
    // Simulate the native dialog 'close' event (triggered by Escape in real browsers)
    fireEvent(dialog, new Event('close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('displays the correct message text', () => {
    const msg = 'The polygon covers 5.00 km², exceeding the 4 km² limit.';
    render(
      <AlertModal
        isOpen={true}
        message={msg}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(msg)).toBeTruthy();
  });

  it('has correct accessibility attributes', () => {
    render(
      <AlertModal
        isOpen={true}
        message="Accessible modal"
        title="Accessible Title"
        onClose={vi.fn()}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('alert-modal-title');
    expect(dialog.getAttribute('aria-describedby')).toBe('alert-modal-message');
  });

  it('renders without a title when title prop is omitted', () => {
    render(
      <AlertModal
        isOpen={true}
        message="No title modal"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('No title modal')).toBeTruthy();
    // No h2 heading should be rendered
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
