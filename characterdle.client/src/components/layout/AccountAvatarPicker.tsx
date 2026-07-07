import { useMemo, useState } from 'react';
import { useUniverseCharacterOptions } from '../../hooks/useUniverseCharacterOptions';
import { UserAvatar } from '../ui/UserAvatar';

interface AccountAvatarPickerProps {
  isSaving?: boolean;
  selectedAvatarUrl: string | null;
  universeId: string;
  onChange: (avatarUrl: string | null) => void;
}

export function AccountAvatarPicker({
  isSaving = false,
  selectedAvatarUrl,
  universeId,
  onChange,
}: AccountAvatarPickerProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data, error, isLoading } = useUniverseCharacterOptions(universeId);
  const normalizedQuery = query.trim().toLowerCase();
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

  function handleTogglePicker() {
    setIsPickerOpen((currentValue) => !currentValue);

    if (isPickerOpen) {
      setQuery('');
    }
  }

  function handleAvatarSelect(avatarUrl: string | null) {
    onChange(avatarUrl);
    setIsPickerOpen(false);
    setQuery('');
  }

  return (
    <div className="account-avatar-picker">
      <div className="account-avatar-picker__header">
        <div>
          <span className="account-avatar-picker__label">Profile picture</span>
        </div>
        <button className="account-avatar-picker__change" type="button" disabled={isSaving} onClick={handleTogglePicker}>
          {isSaving ? 'Saving...' : isPickerOpen ? 'Hide' : 'Change'}
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

      {isPickerOpen && (
        <div className="account-avatar-picker__chooser">
          <div className="account-avatar-picker__actions">
            <button
              className="account-avatar-picker__clear"
              type="button"
              disabled={isSaving}
              onClick={() => handleAvatarSelect(null)}
            >
              Use initials
            </button>
          </div>

          <label className="account-avatar-picker__search">
            Search
            <input
              name="avatarSearch"
              type="text"
              placeholder="Search character portraits"
              disabled={isSaving}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

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
                  disabled={isSaving}
                  aria-pressed={selectedAvatarUrl === option.portraitUrl}
                  onClick={() => handleAvatarSelect(option.portraitUrl)}
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
      )}
    </div>
  );
}
