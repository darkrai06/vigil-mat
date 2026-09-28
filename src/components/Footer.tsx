export function Footer() {
  return (
    <footer className="mt-auto border-t border-line/70 bg-panel/30 backdrop-blur-sm">
      <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col items-center gap-3 sm:items-start">
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-ink font-display text-xs font-semibold text-panel">
                V
              </div>
              <div>
                <p className="font-display text-sm font-semibold leading-none">Vigil</p>
                <p className="text-[11px] text-ink-faint">Exam Center</p>
              </div>
            </div>
            <p className="text-xs text-ink-faint">Copyright © @animeguybd</p>
          </div>
          <div className="flex flex-col items-center gap-1.5 text-xs text-ink-soft sm:items-end">
            <a
              href="mailto:mmalmahin@gmail.com"
              className="flex items-center gap-1.5 transition-colors hover:text-brand"
            >
              <svg
                className="size-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
                />
              </svg>
              mmalmahin@gmail.com
            </a>
            <a
              href="tel:01705409857"
              className="flex items-center gap-1.5 transition-colors hover:text-brand"
            >
              <svg
                className="size-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
                />
              </svg>
              01705409857
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
