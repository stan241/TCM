/**
 * Gate progress indicator — shown on all onboarding screens
 * Doc10 §IV UX: progressive disclosure, each gate unlocks when prior gate passes.
 */

const GATES = ['Purchase', 'Identity', 'Wallet', 'Mint', 'Confirm']

export function GateProgress({ currentGate }: { currentGate: number }) {
  return (
    <nav aria-label="Onboarding progress">
      <ol className="flex gap-1.5">
        {GATES.map((label, i) => {
          const isDone    = i < currentGate
          const isCurrent = i === currentGate
          return (
            <li
              key={label}
              className={[
                'flex-1 text-center py-1.5 px-1 rounded text-xs font-medium transition-colors',
                isDone    ? 'bg-tcm-green text-white'      : '',
                isCurrent ? 'bg-tcm-blue text-white'       : '',
                !isDone && !isCurrent ? 'bg-gray-100 text-gray-400' : '',
              ].join(' ')}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {isDone ? '✓ ' : ''}{label}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
