const GATES = [
  { label: 'Details',  sub: 'Pre-Gate' },
  { label: 'Payment',  sub: 'Gate 1'   },
  { label: 'Identity', sub: 'Gate 2'   },
  { label: 'Wallet',   sub: 'Gate 3'   },
  { label: 'Activate', sub: 'Gate 4'   },
]

export function GateProgress({ currentGate }: { currentGate: number }) {
  return (
    <div className="w-full">
      <div className="flex items-center">
        {GATES.map((gate, i) => {
          const done    = i < currentGate
          const active  = i === currentGate
          const future  = i > currentGate
          const isLast  = i === GATES.length - 1
          return (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  done   ? 'bg-emerald-500 text-white' :
                  active ? 'bg-[#1A3A5C] text-white ring-4 ring-[#1A3A5C]/20' :
                           'bg-slate-100 text-slate-400'
                }`}>
                  {done
                    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    : i + 1
                  }
                </div>
                <div className="text-center hidden sm:block">
                  <p className={`text-[10px] font-bold tracking-wide ${active ? 'text-[#1A3A5C]' : done ? 'text-emerald-600' : 'text-slate-400'}`}>{gate.label}</p>
                  <p className={`text-[9px] ${active || done ? 'text-slate-400' : 'text-slate-300'}`}>{gate.sub}</p>
                </div>
              </div>
              {!isLast && (
                <div className={`h-0.5 flex-1 mx-2 rounded transition-all ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
