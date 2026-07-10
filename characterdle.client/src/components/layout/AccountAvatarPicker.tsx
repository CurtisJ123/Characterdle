import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUniverseCharacterOptions } from '../../hooks/useUniverseCharacterOptions';
import { UserAvatar } from '../ui/UserAvatar';

interface AccountAvatarPickerProps {
  isOpen: boolean;
  isSaving?: boolean;
  selectedAvatarUrl: string | null;
  universeId: string;
  onChange: (avatarUrl: string | null) => Promise<void>;
  onOpenChange: (isOpen: boolean) => void;
}

export function AccountAvatarPicker({
  isOpen,
  isSaving = false,
  selectedAvatarUrl,
  universeId,
  onChange,
  onOpenChange,
}: AccountAvatarPickerProps) {
  const [isSelectionPending, setIsSelectionPending] = useState(false);
  const [query, setQuery] = useState('');
  const [selectionError, setSelectionError] = useState<string>();
  const changeButtonRef = useRef<HTMLButtonElement>(null);
  const { data, error, isLoading } = useUniverseCharacterOptions(universeId);
  const normalizedQuery = query.trim().toLowerCase();
  const isBusy = isSaving || isSelectionPending;
  const selectedOption = useMemo(
    () => data.find((option) => option.portraitUrl === selectedAvatarUrl) ?? null,
    [data, selectedAvatarUrl],
  );
  const hasSelectedPortrait = Boolean(selectedAvatarUrl);
  const selectionTitle = selectedOption?.displayName ?? (hasSelectedPortrait ? 'Saved portrait' : 'Use initials');
  const selectionCopy = hasSelectedPortrait ? 'Portrait selected' : 'Using initials';

  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) {
      return data;
    }

    return data.filter((option) => option.displayName.toLowerCase().includes(normalizedQuery));
  }, [data, normalizedQuery]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || isBusy) {
        return;
      }

      setQuery('');
      setSelectionError(undefined);
      onOpenChange(false);
      window.requestAnimationFrame(() => changeButtonRef.current?.focus());
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isBusy, isOpen, onOpenChange]);

  function handleOpenPicker() {
    setQuery('');
    setSelectionError(undefined);
    onOpenChange(true);
  }

  function handleClosePicker() {
    if (isBusy) {
      return;
    }

    setQuery('');
    setSelectionError(undefined);
    onOpenChange(false);
    window.requestAnimationFrame(() => changeButtonRef.current?.focus());
  }

  async function handleAvatarSelect(avatarUrl: string | null) {
    if (isBusy) {
      return;
    }

    setSelectionError(undefined);
    setIsSelectionPending(true);

    try {
      await onChange(avatarUrl);
      setQuery('');
      onOpenChange(false);
      window.requestAnimationFrame(() => changeButtonRef.current?.focus());
    } catch (error) {
      setSelectionError(error instanceof Error ? error.message : 'Unable to update your profile picture.');
    } finally {
      setIsSelectionPending(false);
    }
  }

  return (
    <>
      <div className="account-avatar-picker">
        <div className="account-avatar-picker__header">
          <span className="account-avatar-picker__label">Profile picture</span>
          <button
            ref={changeButtonRef}
            className="account-avatar-picker__change"
            type="button"
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            disabled={isSaving}
            onClick={handleOpenPicker}
          >
            {isSaving ? 'Saving...' : 'Change'}
          </button>
        </div>

        <div className="account-avatar-picker__selection">
          <UserAvatar
            avatarUrl={selectedAvatarUrl}
            displayName={selectedOption?.displayName ?? 'Profile picture'}
            size="card"
            className="account-avatar-picker__selection-avatar"
          />
          <div className="account-avatar-picker__selection-copy">
            <strong>{selectionTitle}</strong>
            <span>{selectionCopy}</span>
          </div>
        </div>
      </div>

      {isOpen && createPortal(
        <div className="account-avatar-picker-modal">
          <button
            className="account-avatar-picker-modal__scrim"
            type="button"
            aria-label="Close profile picture picker"
            disabled={isBusy}
            onClick={handleClosePicker}
          />

          <section
            className="account-avatar-picker-modal__panel glass-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-avatar-picker-title"
            aria-busy={isBusy}
          >
            <header className="account-avatar-picker-modal__header">
              <div>
                <p className="card-kicker">Profile picture</p>
                <h3 id="account-avatar-picker-title">Choose a portrait</h3>
              </div>
              <button
                className="account-avatar-picker-modal__close"
                type="button"
                disabled={isBusy}
                onClick={handleClosePicker}
              >
                Close
              </button>
            </header>

            <div className="account-avatar-picker-modal__controls">
              <div className="account-avatar-picker__actions">
                <button
                  className="account-avatar-picker__clear"
                  type="button"
                  disabled={isBusy}
                  onClick={() => { void handleAvatarSelect(null); }}
                >
                  Use initials
                </button>
              </div>

              <label className="account-avatar-picker__search">
                Search
                <input
                  autoFocus
                  name="avatarSearch"
                  type="text"
                  placeholder="Search character portraits"
                  disabled={isBusy}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>

              {selectionError && (
                <p className="auth-feedback is-error account-avatar-picker-modal__error" role="alert">
                  {selectionError}
                </p>
              )}
            </div>

            <div className="account-avatar-picker-modal__body">
              {error && <p className="auth-feedback is-error">Unable to load character portraits.</p>}
              {!error && isLoading && <p className="muted-copy">Loading character portraits...</p>}
              {!error && !isLoading && filteredOptions.length === 0 && (
                <p className="muted-copy">No portraits match that search.</p>
              )}

              {!error && filteredOptions.length > 0 && (
                <div className="account-avatar-picker__grid" role="list" aria-label="Character portrait choices">
                  {filteredOptions.map((option) => (
                    <button
                      key={option.id}
                      className={`account-avatar-option ${selectedAvatarUrl === option.portraitUrl ? 'is-selected' : ''}`}
                      type="button"
                      role="listitem"
                      disabled={isBusy}
                      aria-pressed={selectedAvatarUrl === option.portraitUrl}
                      onClick={() => { void handleAvatarSelect(option.portraitUrl); }}
                    >
                      <span className="account-avatar-option__media">
                        <img src={option.portraitUrl} alt="" loading="lazy" />
                      </span>
                      <span className="account-avatar-option__name">{option.displayName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
