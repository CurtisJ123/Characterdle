import type { CharacterAttribute } from '../types/game';
import type {
  UniverseAttributeDefinition,
  UniverseAttributeValue,
  UniverseCharacter,
} from '../types/universeGame';

export function getCharacterAttributeValue(
  character: UniverseCharacter,
  definition: UniverseAttributeDefinition,
): UniverseAttributeValue | undefined {
  return character.attributes[definition.key];
}

export function formatAttributeValue(
  definition: UniverseAttributeDefinition,
  value: UniverseAttributeValue | undefined,
): string {
  if (definition.kind === 'list') {
    const values = Array.isArray(value)
      ? value.map((item) => String(item).trim()).filter(Boolean)
      : [];

    return values.length > 0
      ? values.join(', ')
      : definition.emptyLabel ?? 'ERROR';
  }

  if (definition.kind === 'boolean') {
    if (typeof value !== 'boolean') {
      return definition.emptyLabel ?? 'ERROR';
    }

    return value
      ? definition.trueLabel ?? 'True'
      : definition.falseLabel ?? 'False';
  }

  if (definition.kind === 'number') {
    return typeof value === 'number'
      ? String(value)
      : definition.emptyLabel ?? 'ERROR';
  }

  return typeof value === 'string' && value.trim()
    ? value
    : definition.emptyLabel ?? 'ERROR';
}

export function compareAttributeValue(
  definition: UniverseAttributeDefinition,
  currentValue: UniverseAttributeValue | undefined,
  answerValue: UniverseAttributeValue | undefined,
): CharacterAttribute {
  if (definition.kind === 'list') {
    const currentValues = Array.isArray(currentValue)
      ? currentValue.map((value) => String(value).trim()).filter(Boolean)
      : [];
    const answerValues = Array.isArray(answerValue)
      ? answerValue.map((value) => String(value).trim()).filter(Boolean)
      : [];
    const fallback = definition.emptyLabel ?? 'ERROR';
    const normalizedCurrentValues = currentValues.length > 0 ? currentValues : [fallback];
    const normalizedAnswerValues = answerValues.length > 0 ? answerValues : [fallback];
    const currentSet = new Set(normalizedCurrentValues.map((value) => value.toLowerCase()));
    const answerSet = new Set(normalizedAnswerValues.map((value) => value.toLowerCase()));
    const hasOverlap = normalizedCurrentValues.some((value) => answerSet.has(value.toLowerCase()));
    const isExactMatch =
      currentSet.size === answerSet.size &&
      [...currentSet].every((value) => answerSet.has(value));

    return {
      label: normalizedCurrentValues.join(', '),
      tone: isExactMatch ? 'correct' : hasOverlap ? 'partial' : 'neutral',
    };
  }

  if (definition.kind === 'number') {
    if (typeof currentValue === 'number' && typeof answerValue === 'number') {
      if (currentValue === answerValue) {
        return {
          displayVariant: 'numeric',
          label: String(currentValue),
          tone: 'correct',
        };
      }

      return {
        displayVariant: 'numeric',
        label: currentValue < answerValue
          ? `${currentValue}. Answer is later.`
          : `${currentValue}. Answer is earlier.`,
        indicator: {
          direction: currentValue < answerValue ? 'up' : 'down',
          value: String(currentValue),
        },
        tone: 'neutral',
      };
    }

    return {
      displayVariant: 'numeric',
      label: definition.emptyLabel ?? 'ERROR',
      tone: 'neutral',
    };
  }

  if (definition.kind === 'boolean') {
    if (typeof currentValue !== 'boolean' || typeof answerValue !== 'boolean') {
      return {
        label: definition.emptyLabel ?? 'ERROR',
        tone: 'neutral',
      };
    }

    return {
      label: currentValue
        ? definition.trueLabel ?? 'True'
        : definition.falseLabel ?? 'False',
      tone: currentValue === answerValue ? 'correct' : 'neutral',
    };
  }

  const label = typeof currentValue === 'string' && currentValue.trim()
    ? currentValue
    : definition.emptyLabel ?? 'ERROR';
  const tone =
    typeof currentValue === 'string' &&
    typeof answerValue === 'string' &&
    currentValue === answerValue
      ? 'correct'
      : 'neutral';

  return {
    label,
    tone,
  };
}
