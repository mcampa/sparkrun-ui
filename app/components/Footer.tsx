import Link from "next/link";
import Image from "next/image";

const REPO_URL = "https://github.com/mcampa/sparkrun-ui";
const SPARKRUN_URL = "https://github.com/mcampa/sparkrun";

export function Footer() {
  return (
    <footer className="mt-12 border-t border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-6 text-sm sm:flex-row">
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
          <Image src="/logo.svg" alt="" width={16} height={16} />
          <span>
            <span className="font-medium text-zinc-700 dark:text-zinc-300">sparkrun-ui</span> · web
            UI for{" "}
            <Link
              href={SPARKRUN_URL}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-zinc-400 decoration-dotted underline-offset-2 hover:text-sky-600 dark:hover:text-sky-400"
            >
              sparkrun
            </Link>
          </span>
        </div>
        <Link
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label="View source on GitHub"
        >
          <GithubMark />
          <span>GitHub</span>
        </Link>
      </div>
    </footer>
  );
}

function GithubMark() {
  // Public-domain GitHub mark (https://github.com/logos), 24×24.
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-1.96c-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.28-1.67-1.28-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.34.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.27-5.24-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18A11 11 0 0 1 12 6.8c.97 0 1.95.13 2.86.38 2.18-1.49 3.14-1.18 3.14-1.18.63 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.7 5.37-5.26 5.65.41.35.77 1.05.77 2.11v3.13c0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}
