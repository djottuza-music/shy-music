import { africanGenres, globalGenres, moods, toggleLimitedValue } from '../lib/taxonomy'

interface PickerProps {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  kind: 'genre' | 'mood'
  minimum?: number
  maximum?: number
}

export function MetadataPicker({ label, values, onChange, kind, minimum = 1, maximum = 3 }: PickerProps) {
  const full = values.length >= maximum
  const options = kind === 'genre' ? [
    { label: 'African & Zambian', icon: '🌍', values: africanGenres },
    { label: 'Global', values: globalGenres },
  ] : [{ label: 'Moods', values: moods }]

  return <fieldset className="metadata-picker">
    <legend>{label} <span>{values.length}/{maximum}</span></legend>
    {options.map((group) => <div className="chip-group" key={group.label}>
      {kind === 'genre' && <strong>{'icon' in group && group.icon && <span aria-hidden="true">{group.icon}</span>}{group.label}</strong>}
      <div className="chip-row">{group.values.map((option) => {
        const selected = values.includes(option)
        return <button key={option} type="button" className={`choice-chip ${selected ? 'selected' : ''}`} disabled={full && !selected} aria-pressed={selected} onClick={() => onChange(toggleLimitedValue(values, option, maximum))}>{option}</button>
      })}</div>
    </div>)}
    {full && <small className="picker-help">Maximum {maximum} selected</small>}
    {!full && values.length < minimum && <small className="picker-help">Select at least {minimum}</small>}
  </fieldset>
}

export function MetadataChips({ values, tone = 'violet' }: { values?: string[] | null; tone?: 'violet' | 'neutral' | 'warning' }) {
  if (!values?.length) return null
  return <div className="metadata-chips">{values.map((value) => <span className={`metadata-chip ${tone}`} key={value}>{value}</span>)}</div>
}
