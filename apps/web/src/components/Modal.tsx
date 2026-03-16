import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import {
  clampSheetOffset,
  shouldDismissSheet,
} from './modalSheetGesture';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [sheetOffset, setSheetOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartYRef = useRef<number | null>(null);

  const isMobileSheet =
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : false;

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setSheetOffset(0);
      setIsDragging(false);
      touchStartYRef.current = null;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'flex min-h-screen px-4 pb-20 pt-4 text-center sm:block sm:p-0',
          isMobileSheet ? 'items-end justify-stretch' : 'items-center justify-center'
        )}
      >
        <div
          className="fixed inset-0 bg-text/45 transition-opacity app-sheet-backdrop"
          aria-hidden="true"
          onClick={onClose}
        />

        <span
          className="hidden sm:inline-block sm:align-middle sm:h-screen"
          aria-hidden="true"
        >
          &#8203;
        </span>

        <div
          ref={modalRef}
          className={cn(
            'inline-block w-full overflow-hidden border border-line text-left text-text shadow-panel transition-all sm:my-8 sm:align-middle',
            isMobileSheet
              ? 'app-mobile-sheet rounded-t-[28px] rounded-b-none border-b-0'
              : 'rounded-[28px]',
            sizeStyles[size]
          )}
          style={{
            backgroundColor: 'var(--app-shell-background)',
            transform: isMobileSheet ? `translateY(${sheetOffset}px)` : undefined,
            transitionDuration: isDragging ? '0ms' : undefined,
          }}
        >
          {isMobileSheet ? (
            <div
              className="flex justify-center px-4 pt-3"
              onTouchStart={(event) => {
                touchStartYRef.current = event.touches[0]?.clientY ?? null;
                setIsDragging(true);
              }}
              onTouchMove={(event) => {
                if (touchStartYRef.current === null) {
                  return;
                }

                const nextY = event.touches[0]?.clientY ?? touchStartYRef.current;
                setSheetOffset(clampSheetOffset(nextY - touchStartYRef.current));
              }}
              onTouchEnd={() => {
                const shouldDismiss = shouldDismissSheet(sheetOffset);
                setIsDragging(false);
                touchStartYRef.current = null;
                if (shouldDismiss) {
                  setSheetOffset(0);
                  onClose();
                  return;
                }

                setSheetOffset(0);
              }}
              onTouchCancel={() => {
                setIsDragging(false);
                touchStartYRef.current = null;
                setSheetOffset(0);
              }}
            >
              <div className="h-1.5 w-12 rounded-full bg-line" />
            </div>
          ) : null}
          <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <h3
                  className="mb-4 border-b border-line pb-4 text-lg font-semibold leading-6 text-text"
                  id="modal-title"
                >
                  {title}
                </h3>
                <div className="mt-2">{children}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Modal;
